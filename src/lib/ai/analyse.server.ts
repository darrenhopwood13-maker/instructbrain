import type { SupabaseClient } from "@supabase/supabase-js";
import { aiConfig } from "@/lib/ai/config";
import {
  notAssessedDraft,
  toDraftFinding,
  type DraftFinding,
  type Observation,
} from "@/lib/ai/observation";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt";
import { analyseImage, mapWithConcurrency } from "@/lib/ai/provider.server";
import { nextRef } from "@/lib/finding-refs";
import { PHOTO_BUCKET, analysisSourcePath } from "@/lib/photos/storage-paths";
import {
  allowsMultipleFindingsPerPhoto,
  NOT_ASSESSED_ID,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";

type AnyClient = SupabaseClient<any, any, any>;

export type AnalyseSummary = {
  photosAnalysed: number;
  findingsCreated: number;
  notAssessed: number;
  confidential: number;
  errors: string[];
};

type PhotoRecord = {
  id: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  analysis_path: string | null;
  original_filename: string | null;
  captured_at: string | null;
  capture_fields: Record<string, string> | null;
};

/** A snapshot that cannot be read must not borrow another discipline's words. */
function coerceSnapshot(value: unknown): SurveyTypeSnapshot {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SurveyTypeSnapshot).id === "string" &&
    Array.isArray((value as SurveyTypeSnapshot).statuses)
  ) {
    return value as SurveyTypeSnapshot;
  }
  return { id: "unavailable", version: 0, label: "Survey type unavailable", statuses: [] };
}

function table(client: AnyClient, name: string) {
  return client.from(name as never) as any;
}

/**
 * Drafts findings for a report's photographs.
 *
 * Every call runs as the signed-in user, so RLS decides what can be read and
 * written. A failure of any kind — provider error, timeout, unparseable output,
 * low confidence — becomes a `not_assessed` finding, never a pass and never
 * silence.
 */
export async function analyseReportPhotos(
  client: AnyClient,
  input: { reportId: string; photoIds?: string[] },
): Promise<AnalyseSummary> {
  const config = aiConfig();

  const { data: reportRow, error: reportError } = await table(client, "reports")
    .select("id, organisation_id, survey_type_snapshot")
    .eq("id", input.reportId)
    .maybeSingle();
  if (reportError) throw new Error(reportError.message);
  if (!reportRow) throw new Error("That report could not be found, or you cannot access it.");

  const snapshot = coerceSnapshot(reportRow.survey_type_snapshot);
  const multiple = allowsMultipleFindingsPerPhoto(snapshot);
  const systemPrompt = buildSystemPrompt(snapshot);

  let photoQuery = table(client, "photos")
    .select(
      "id, storage_path, thumbnail_path, analysis_path, original_filename, captured_at, capture_fields",
    )
    .eq("report_id", input.reportId)
    .order("sequence", { ascending: true });
  if (input.photoIds && input.photoIds.length > 0) {
    photoQuery = photoQuery.in("id", input.photoIds);
  }
  const { data: photoRows, error: photoError } = await photoQuery;
  if (photoError) throw new Error(photoError.message);
  const photos = (photoRows ?? []) as PhotoRecord[];

  const { data: findingRows, error: findingError } = await table(client, "findings")
    .select("id, ref, sequence")
    .eq("report_id", input.reportId);
  if (findingError) throw new Error(findingError.message);
  const existing = (findingRows ?? []) as Array<{ id: string; ref: string; sequence: number }>;

  // Photographs that already carry a finding are left alone unless named.
  let candidates = photos;
  if (!input.photoIds?.length && existing.length > 0) {
    const { data: linkRows } = await table(client, "finding_photos")
      .select("photo_id, finding_id")
      .in(
        "finding_id",
        existing.map((finding) => finding.id),
      );
    const analysed = new Set(
      ((linkRows ?? []) as Array<{ photo_id: string }>).map((link) => link.photo_id),
    );
    candidates = photos.filter((photo) => !analysed.has(photo.id));
  }

  if (candidates.length === 0) {
    return {
      photosAnalysed: 0,
      findingsCreated: 0,
      notAssessed: 0,
      confidential: 0,
      errors: [],
    };
  }

  // Invariant 3: the full-resolution object, never a display thumbnail.
  const signed = await mapWithConcurrency(candidates, config.concurrency, async (photo) => {
    try {
      const path = analysisSourcePath(photo);
      const { data, error } = await client.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path, 900);
      if (error || !data?.signedUrl) throw error ?? new Error("no signed url");
      return { photo, url: data.signedUrl, error: null as string | null };
    } catch (error) {
      return {
        photo,
        url: null,
        error: error instanceof Error ? error.message : "the image could not be opened.",
      };
    }
  });

  const drafted = await mapWithConcurrency(signed, config.concurrency, async (entry) => {
    if (!entry.url) {
      return {
        photo: entry.photo,
        drafts: [notAssessedDraft(entry.error ?? "the image could not be opened.")],
        raw: null as unknown,
        error: entry.error,
      };
    }
    try {
      const result = await analyseImage(
        {
          snapshot,
          systemPrompt,
          userPrompt: buildUserPrompt({
            captureFields: entry.photo.capture_fields ?? {},
            capturedAt: entry.photo.captured_at,
            filename: entry.photo.original_filename,
          }),
          imageUrl: entry.url,
        },
        config,
      );

      // One code path, one schema: single-finding types validate to <= 1.
      const observations: Observation[] = multiple
        ? result.observations
        : result.observations.slice(0, 1);

      const drafts: DraftFinding[] =
        observations.length === 0
          ? [notAssessedDraft("the model returned no observation for this photograph.")]
          : observations.map((observation) =>
              toDraftFinding(observation, snapshot, {
                confidenceThreshold: config.confidenceThreshold,
                tradeConfidenceThreshold: config.tradeConfidenceThreshold,
              }),
            );

      return { photo: entry.photo, drafts, raw: result.raw, error: null as string | null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "the AI call failed.";
      return {
        photo: entry.photo,
        drafts: [notAssessedDraft(message)],
        raw: null as unknown,
        error: message,
      };
    }
  });

  // Invariant 4: refs and sequences continue from the highest ever issued.
  const refs = existing.map((finding) => finding.ref);
  let sequence = existing.reduce((max, finding) => Math.max(max, finding.sequence ?? 0), 0);

  const summary: AnalyseSummary = {
    photosAnalysed: candidates.length,
    findingsCreated: 0,
    notAssessed: 0,
    confidential: 0,
    errors: [],
  };

  for (const entry of drafted) {
    if (entry.error) summary.errors.push(`${entry.photo.original_filename ?? entry.photo.id}: ${entry.error}`);

    for (const draft of entry.drafts) {
      const ref = nextRef(refs);
      refs.push(ref);
      sequence += 1;

      const { data: inserted, error } = await table(client, "findings")
        .insert({
          report_id: input.reportId,
          ref,
          sequence,
          capture_fields: entry.photo.capture_fields ?? {},
          ai_raw_output: entry.raw ?? null,
          ...draft,
        })
        .select("id")
        .single();

      if (error) {
        summary.errors.push(`${ref}: ${error.message}`);
        continue;
      }

      summary.findingsCreated += 1;
      if (draft.status === NOT_ASSESSED_ID) summary.notAssessed += 1;
      if (draft.is_confidential) summary.confidential += 1;

      const { error: linkError } = await table(client, "finding_photos").insert({
        finding_id: (inserted as { id: string }).id,
        photo_id: entry.photo.id,
      });
      if (linkError) summary.errors.push(`${ref}: ${linkError.message}`);
    }
  }

  return summary;
}
