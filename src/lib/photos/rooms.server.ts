/**
 * Loading a report's photographs and asking for a room proposal.
 *
 * Runs as the signed-in user, so RLS decides what can be read. Nothing is
 * written: the proposal is applied only by a person pressing Apply.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiConfig } from "@/lib/ai/config";
import { assertWithinBudget } from "@/lib/ai/cost.server";
import { loadAnalysableImage } from "@/lib/photos/analysis-image.server";
import { analysisSourcePath } from "@/lib/photos/storage-paths";
import { proposeRooms, type SuggestImage } from "@/lib/photos/room-suggest.server";
import type { RoomProposal } from "@/lib/photos/room-suggest";
import { photoWorkflowOf, roleIsOutsideSections, type SurveyTypeSnapshot } from "@/lib/survey-types";

type AnyClient = SupabaseClient<any, any, any>;

function table(client: AnyClient, name: string) {
  return client.from(name as never) as any;
}

export async function suggestRoomsForReport(
  client: AnyClient,
  reportId: string,
): Promise<RoomProposal> {
  const config = aiConfig();

  const { data: reportRow, error: reportError } = await table(client, "reports")
    .select("id, organisation_id, cover_photo_id, survey_type_snapshot")
    .eq("id", reportId)
    .maybeSingle();
  if (reportError) throw new Error(reportError.message);
  if (!reportRow) throw new Error("That report could not be found, or you cannot access it.");
  const report = reportRow as {
    organisation_id: string;
    cover_photo_id: string | null;
    survey_type_snapshot: unknown;
  };

  await assertWithinBudget(client, report.organisation_id);

  const workflow = photoWorkflowOf(report.survey_type_snapshot as SurveyTypeSnapshot | null);
  if (!workflow?.sectionField) {
    throw new Error("This report template does not organise photographs into sections.");
  }

  const { data: photoRows, error: photoError } = await table(client, "photos")
    .select("id, storage_path, thumbnail_path, analysis_path, sequence, capture_fields")
    .eq("report_id", reportId)
    .order("sequence", { ascending: true });
  if (photoError) throw new Error(photoError.message);

  const photos = ((photoRows ?? []) as Array<{
    id: string;
    storage_path: string | null;
    thumbnail_path: string | null;
    analysis_path: string | null;
    sequence: number | null;
    capture_fields: Record<string, string> | null;
  }>).filter(
    (photo) =>
      photo.id !== report.cover_photo_id && !roleIsOutsideSections(workflow, photo.capture_fields),
  );

  if (photos.length === 0) {
    throw new Error("There are no photographs to sort into rooms yet.");
  }

  const images: SuggestImage[] = [];
  for (const photo of photos) {
    try {
      // Invariant 3: the stored full-resolution source, never a thumbnail.
      const image = await loadAnalysableImage(client, analysisSourcePath(photo));
      images.push({ photoId: photo.id, dataUrl: image.dataUrl });
    } catch {
      // A photograph that cannot be opened is simply not grouped — it stays in
      // the not-in-a-room list rather than being guessed at.
    }
  }

  if (images.length === 0) {
    throw new Error("None of the photographs could be opened, so nothing was grouped.");
  }

  return proposeRooms(images, workflow, config);
}
