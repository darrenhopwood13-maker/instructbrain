/**
 * Report analysis orchestration. Runs server-side, as the signed-in user, so
 * RLS decides what can be read and written.
 *
 * Every failure — provider error, timeout, rate limit exhaustion, malformed
 * JSON, schema validation failure, abstention, low confidence, an unknown
 * status, an empty array on a single-finding type — becomes a `not_assessed`
 * finding. Never a pass, and never silence. The raw model response is written
 * to findings.ai_raw_output in every case, including failures.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiConfig, AiNotConfiguredError } from "@/lib/ai/config";
import {
  assertWithinBudget,
  logUsage,
  AiBudgetExceededError,
  usageSummary,
  type UsageSummary,
} from "@/lib/ai/cost.server";
import {
  draftsFromEnvelope,
  notAssessedDraft,
  type DraftFinding,
  type Envelope,
} from "@/lib/ai/observation";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt";
import { coerceBrief, toneById } from "@/lib/report/brief";
import { applyToneRules } from "@/lib/report/tone-post-process";
import { SURVEY_TYPE_FIELD } from "@/lib/report/sections";
import { getDefinition } from "@/lib/survey-definitions";
import { analysePhotograph, type TierAttempt } from "@/lib/ai/provider.server";
import { nextRef } from "@/lib/finding-refs";

/**
 * Allocate the next item reference for a report. The database serialises this
 * per report, so two photographs analysed at the same moment can never be
 * handed the same number. Falls back to the read-then-derive path only if the
 * helper is unavailable.
 */
async function allocateRef(
  client: AnyClient,
  reportId: string,
): Promise<{ ref: string; sequence: number } | null> {
  const { data, error } = await (client as any).rpc("next_finding_ref", {
    _report_id: reportId,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!error && row?.ref) {
    return { ref: row.ref as string, sequence: Number(row.sequence ?? 0) };
  }

  const { data: existingRows } = await table(client, "findings")
    .select("ref, sequence")
    .eq("report_id", reportId);
  const existing = (existingRows ?? []) as Array<{ ref: string; sequence: number | null }>;
  if (!existing) return null;
  return {
    ref: nextRef(existing.map((row) => row.ref)),
    sequence: existing.reduce((max, row) => Math.max(max, row.sequence ?? 0), 0) + 1,
  };
}

import { PHOTO_BUCKET, analysisSourcePath } from "@/lib/photos/storage-paths";
import { NOT_ASSESSED_ID, type SurveyTypeSnapshot } from "@/lib/survey-types";

export { AiBudgetExceededError, AiNotConfiguredError };

type AnyClient = SupabaseClient<any, any, any>;

function table(client: AnyClient, name: string) {
  return client.from(name as never) as any;
}

type PhotoRecord = {
  id: string;
  report_id: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  analysis_path: string | null;
  original_filename: string | null;
  captured_at: string | null;
  capture_fields: Record<string, string> | null;
  checksum: string | null;
  sequence: number | null;
};

export type PhotoAnalysisState = {
  photoId: string;
  filename: string | null;
  sequence: number | null;
  analysed: boolean;
};

export type PhotoAnalysisResult = {
  photoId: string;
  filename: string | null;
  findingsCreated: number;
  notAssessed: number;
  confidential: number;
  cached: boolean;
  tier: string;
  costUsd: number;
  error: string | null;
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

/** Cache identity: the same photograph under the same definition and models. */
/**
 * Which survey type assesses this photograph. Defaults to the report's own
 * snapshot; a per-photograph type is honoured only when the report's brief
 * lists it, so one discipline's vocabulary can never reach another's items.
 */
function resolvePhotoSnapshot(
  primary: SurveyTypeSnapshot,
  brief: ReturnType<typeof coerceBrief>,
  captureFields: Record<string, string> | null,
): SurveyTypeSnapshot {
  const wanted = captureFields?.[SURVEY_TYPE_FIELD];
  if (!wanted || wanted === primary.id) return primary;
  const listed = brief?.surveyTypes?.some((type) => type.id === wanted);
  if (!listed) return primary;
  const definition = getDefinition(wanted);
  return definition ? coerceSnapshot(definition) : primary;
}

function snapshotKey(
  snapshot: SurveyTypeSnapshot,
  models: { triage: string; escalation: string },
  briefKey = "",
) {
  // The brief changes the prompt, so a cached answer written under a different
  // tone or special request must not be reused.
  return `${snapshot.id}@${snapshot.version ?? 0}|${models.triage}|${models.escalation}${briefKey ? `|${briefKey}` : ""}`;
}

async function loadReport(client: AnyClient, reportId: string) {
  const { data, error } = await table(client, "reports")
    .select(
      "id, organisation_id, survey_type_snapshot, brief, project:projects(name, client_name, address)",
    )
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That report could not be found, or you cannot access it.");
  return data as {
    id: string;
    organisation_id: string;
    survey_type_snapshot: unknown;
    brief: unknown;
    project: { name: string | null; client_name: string | null; address: string | null } | null;
  };
}

/** Photographs on a report, and whether each already carries a finding. */
export async function photoAnalysisStates(
  client: AnyClient,
  reportId: string,
): Promise<PhotoAnalysisState[]> {
  const [{ data: photoRows, error }, { data: coverRows }] = await Promise.all([
    table(client, "photos")
      .select("id, original_filename, sequence")
      .eq("report_id", reportId)
      .order("sequence", { ascending: true }),
    table(client, "reports").select("cover_photo_id").eq("id", reportId).limit(1),
  ]);
  if (error) throw new Error(error.message);
  // A dedicated cover photograph carries no finding and is never analysed.
  const coverPhotoId =
    ((coverRows ?? [])[0] as { cover_photo_id?: string | null } | undefined)?.cover_photo_id ??
    null;
  const photos = (photoRows ?? []) as Array<{
    id: string;
    original_filename: string | null;
    sequence: number | null;
  }>;

  const { data: findingRows } = await table(client, "findings")
    .select("id")
    .eq("report_id", reportId);
  const findingIds = ((findingRows ?? []) as Array<{ id: string }>).map((row) => row.id);

  let analysed = new Set<string>();
  if (findingIds.length > 0) {
    const { data: linkRows } = await table(client, "finding_photos")
      .select("photo_id")
      .in("finding_id", findingIds);
    analysed = new Set(((linkRows ?? []) as Array<{ photo_id: string }>).map((row) => row.photo_id));
  }

  return photos.map((photo) => ({
    photoId: photo.id,
    filename: photo.original_filename,
    sequence: photo.sequence,
    analysed: analysed.has(photo.id) || photo.id === coverPhotoId,
  }));
}

async function readCache(
  client: AnyClient,
  organisationId: string,
  checksum: string | null,
  key: string,
): Promise<{ envelope: Envelope; raw: unknown; tier: string } | null> {
  if (!checksum) return null;
  const { data } = await table(client, "ai_analysis_cache")
    .select("envelope, raw_output, tier")
    .eq("organisation_id", organisationId)
    .eq("checksum", checksum)
    .eq("snapshot_key", key)
    .maybeSingle();
  if (!data?.envelope) return null;
  return {
    envelope: data.envelope as Envelope,
    raw: data.raw_output ?? null,
    tier: (data.tier as string) ?? "cache",
  };
}

async function writeCache(
  client: AnyClient,
  row: {
    organisationId: string;
    checksum: string | null;
    key: string;
    provider: string;
    model: string;
    tier: string;
    envelope: Envelope;
    raw: unknown;
  },
): Promise<void> {
  if (!row.checksum) return;
  await table(client, "ai_analysis_cache").upsert(
    {
      organisation_id: row.organisationId,
      checksum: row.checksum,
      snapshot_key: row.key,
      provider: row.provider,
      model: row.model,
      tier: row.tier,
      envelope: row.envelope,
      raw_output: row.raw,
    },
    { onConflict: "organisation_id,checksum,snapshot_key" },
  );
}

/** Prior AI drafts for a photograph, cleared before a re-analysis. */
async function clearPreviousDrafts(
  client: AnyClient,
  reportId: string,
  photoId: string,
): Promise<void> {
  const { data: linkRows } = await table(client, "finding_photos")
    .select("finding_id")
    .eq("photo_id", photoId);
  const ids = ((linkRows ?? []) as Array<{ finding_id: string }>).map((row) => row.finding_id);
  if (ids.length === 0) return;

  const { data: findingRows } = await table(client, "findings")
    .select("id")
    .eq("report_id", reportId)
    .eq("human_edited", false)
    .is("confirmed_at", null)
    .in("id", ids);
  const removable = ((findingRows ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (removable.length === 0) return;

  await table(client, "finding_photos").delete().in("finding_id", removable);
  await table(client, "findings").delete().in("id", removable);
}

/**
 * Analyses ONE photograph. The unit of work for the batch runner, so a run is
 * cancellable and resumable: cancelling mid-run leaves completed findings
 * intact, and resuming picks up whatever is still unanalysed.
 */
export async function analysePhotoForReport(
  client: AnyClient,
  input: { reportId: string; photoId: string; force?: boolean },
): Promise<PhotoAnalysisResult> {
  const baseConfig = aiConfig();
  const report = await loadReport(client, input.reportId);
  await assertWithinBudget(client, report.organisation_id);

  const brief = coerceBrief(report.brief);
  const tone = toneById(brief?.tone ?? null);
  // Speed comes from a tighter answer and, on the fastest tone, from skipping
  // the second-opinion pass. The photograph itself is never touched.
  const config = brief
    ? {
        ...baseConfig,
        maxOutputTokens: Math.min(baseConfig.maxOutputTokens, tone.maxOutputTokens),
        escalationEnabled: baseConfig.escalationEnabled && tone.escalate,
      }
    : baseConfig;

  const primarySnapshot = coerceSnapshot(report.survey_type_snapshot);

  const { data: photoRow, error: photoError } = await table(client, "photos")
    .select(
      "id, report_id, storage_path, thumbnail_path, analysis_path, original_filename, captured_at, capture_fields, checksum, sequence",
    )
    .eq("id", input.photoId)
    .eq("report_id", input.reportId)
    .maybeSingle();
  if (photoError) throw new Error(photoError.message);
  if (!photoRow) throw new Error("That photograph could not be found on this report.");
  const photo = photoRow as PhotoRecord;

  // A report may cover several survey types. The type recorded on the
  // photograph decides which snapshot assesses it — and only a type the
  // report itself lists is ever honoured, so vocabulary cannot leak in.
  const snapshot = resolvePhotoSnapshot(primarySnapshot, brief, photo.capture_fields);

  const key = snapshotKey(
    snapshot,
    config.models,
    brief ? `${tone.id}:${brief.specialRequest}` : "",
  );

  if (input.force) await clearPreviousDrafts(client, input.reportId, photo.id);

  const result: PhotoAnalysisResult = {
    photoId: photo.id,
    filename: photo.original_filename,
    findingsCreated: 0,
    notAssessed: 0,
    confidential: 0,
    cached: false,
    tier: "triage",
    costUsd: 0,
    error: null,
  };

  let envelope: Envelope | null = null;
  let raw: unknown = null;
  let failure: string | null = null;
  let attempts: TierAttempt[] = [];

  const cached = await readCache(client, report.organisation_id, photo.checksum, key);
  if (cached) {
    envelope = cached.envelope;
    raw = cached.raw;
    result.cached = true;
    result.tier = cached.tier;
  } else {
    let imageUrl: string | null = null;
    try {
      // Invariant 3: the full-resolution object. analysisSourcePath throws on a thumbnail.
      const path = analysisSourcePath(photo);
      const { data, error } = await client.storage.from(PHOTO_BUCKET).createSignedUrl(path, 900);
      if (error || !data?.signedUrl) throw error ?? new Error("the image could not be opened.");
      imageUrl = data.signedUrl;
    } catch (error) {
      failure = error instanceof Error ? error.message : "the image could not be opened.";
    }

    if (imageUrl) {
      const outcome = await analysePhotograph(
        {
          snapshot,
          systemPrompt: buildSystemPrompt(snapshot, brief),
          userPrompt: buildUserPrompt(
            {
              captureFields: photo.capture_fields ?? {},
              capturedAt: photo.captured_at,
              filename: photo.original_filename,
            },
            {
              name: report.project?.name ?? null,
              client: report.project?.client_name ?? null,
              address: report.project?.address ?? null,
            },
          ),
          imageUrl,
        },
        config,
      );

      envelope = outcome.envelope;
      failure = outcome.failure;
      attempts = outcome.attempts;
      raw = { attempts: outcome.attempts.map((a) => ({ tier: a.tier, model: a.model, response: a.raw, error: a.error })) };
      result.tier = outcome.tier;
      result.costUsd = outcome.totalCostUsd;

      for (const attempt of attempts) {
        await logUsage(client, {
          organisationId: report.organisation_id,
          reportId: input.reportId,
          photoId: photo.id,
          tier: attempt.tier,
          provider: attempt.provider,
          model: attempt.model,
          inputTokens: attempt.usage.inputTokens,
          outputTokens: attempt.usage.outputTokens,
          costUsd: attempt.costUsd,
          cached: false,
          outcome: attempt.error ? "error" : "ok",
        });
      }

      if (envelope) {
        await writeCache(client, {
          organisationId: report.organisation_id,
          checksum: photo.checksum,
          key,
          provider: config.provider,
          model: config.models[outcome.tier],
          tier: outcome.tier,
          envelope,
          raw,
        });
      }
    }
  }

  const rawDrafts: DraftFinding[] = envelope
    ? draftsFromEnvelope(envelope, snapshot, {
        confidenceThreshold: config.confidenceThreshold,
        tradeConfidenceThreshold: config.tradeConfidenceThreshold,
        tier: result.tier,
      })
    : [notAssessedDraft(failure ?? "the AI call failed.", result.tier, null)];

  // Wording only. Status, severity id, ref and confidence are never touched
  // here, so invariants 1 and 4 hold whatever the brief asks for.
  const dropFix = brief ? brief.reportType === "identifier" || !brief.includeFix : false;
  const dropSeverity = brief ? brief.reportType === "identifier" || !brief.includeSeverity : false;
  const drafts: DraftFinding[] = rawDrafts.map((draft) => ({
    ...draft,
    ...(draft.finding_text
      ? { finding_text: applyToneRules(draft.finding_text, tone.rules) }
      : {}),
    ...(dropFix
      ? { remedial_text: "" }
      : draft.remedial_text
        ? { remedial_text: applyToneRules(draft.remedial_text, tone.rules) }
        : {}),
    ...(dropSeverity ? { severity: null, severity_rationale: null } : {}),
  }));

  result.error = failure;

  if (drafts.length === 0) return result;

  for (const draft of drafts) {
    // Invariant 4: the database hands out the next ref under a per-report lock,
    // so photographs analysed concurrently can never claim the same number.
    const allocated = await allocateRef(client, input.reportId);
    if (!allocated) {
      result.error = "the item number could not be allocated.";
      continue;
    }
    const { ref, sequence } = allocated;

    const insertDraft = async (payload: DraftFinding) =>
      (await table(client, "findings")
        .insert({
          report_id: input.reportId,
          ref,
          sequence,
          capture_fields: {
            ...(photo.capture_fields ?? {}),
            // Records which survey type assessed this item, so a report
            // covering several types can be sectioned in the document.
            [SURVEY_TYPE_FIELD]: String((snapshot as { id?: unknown }).id ?? ""),
          },
          ai_raw_output: (raw ?? null) as never,
          ...payload,
        })
        .select("id")
        .single()) as { data: { id: string } | null; error: { message: string } | null };

    let { data: inserted, error } = await insertDraft(draft);

    if (error) {
      // Invariant 1: a save failure must never lose the observation. It is
      // written as not_assessed for a person to resolve, never discarded.
      const fallback = notAssessedDraft(
        `the observation could not be saved (${error.message}).`,
        result.tier,
        null,
      );
      const retry = await insertDraft(fallback);
      if (retry.error) {
        result.error = "the observation could not be saved. Try analysing this photograph again.";
        continue;
      }
      inserted = retry.data;
      error = null;
      result.error = "one observation could not be saved and is marked Not assessed.";
      result.findingsCreated += 1;
      result.notAssessed += 1;
    } else {
      result.findingsCreated += 1;
      if (draft.status === NOT_ASSESSED_ID) result.notAssessed += 1;
      if (draft.is_confidential) result.confidential += 1;
    }

    if (!inserted) continue;

    const { error: linkError } = await table(client, "finding_photos").insert({
      finding_id: inserted.id,
      photo_id: photo.id,
      role: "primary",
    });
    if (linkError) result.error = "the photograph could not be linked to its item.";
  }


  return result;
}

export async function organisationUsage(
  client: AnyClient,
  organisationId: string,
): Promise<UsageSummary> {
  return usageSummary(client, organisationId);
}

export async function reportUsage(
  client: AnyClient,
  reportId: string,
): Promise<{ costUsd: number; inputTokens: number; outputTokens: number; assessments: number }> {
  const { data, error } = await table(client, "ai_usage_events")
    .select("cost_usd, input_tokens, output_tokens")
    .eq("report_id", reportId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    cost_usd: number | string | null;
    input_tokens: number | null;
    output_tokens: number | null;
  }>;
  return {
    costUsd: Math.round(rows.reduce((t, r) => t + Number(r.cost_usd ?? 0), 0) * 10_000) / 10_000,
    inputTokens: rows.reduce((t, r) => t + (r.input_tokens ?? 0), 0),
    outputTokens: rows.reduce((t, r) => t + (r.output_tokens ?? 0), 0),
    assessments: rows.length,
  };
}
