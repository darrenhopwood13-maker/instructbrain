import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET, collisionSafeFilename } from "@/lib/photos/storage-paths";
import { nextSequence, uploadPhoto } from "@/lib/photos/photo-service";

/**
 * Branding files live under the report's own folder, alongside its
 * photographs — never in a shared or cross-organisation location.
 */
export function brandingPath(
  organisationId: string,
  reportId: string,
  filename: string,
): string {
  return `${organisationId}/${reportId}/branding/${collisionSafeFilename(filename)}`;
}

/**
 * A per-report logo wins; otherwise the organisation's saved logo is used;
 * otherwise there is no logo. Everything that renders a report — screen,
 * PDF and shared link — resolves through this one rule.
 */
export function resolveLogoPath(
  reportLogoPath: string | null | undefined,
  organisationLogoPath: string | null | undefined,
): string | null {
  return reportLogoPath ?? organisationLogoPath ?? null;
}

/** Upload a logo (or other branding image) into the report's branding folder. */
export async function uploadBrandingImage(
  file: File,
  organisationId: string,
  reportId: string,
): Promise<string> {
  const path = brandingPath(organisationId, reportId, file.name || "image.png");
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Apply the cover and logo chosen at report creation.
 *
 * A dedicated cover photograph goes through the normal photo pipeline — it is
 * a real photo row, stored at full resolution with its EXIF read first — and
 * is then set as the report's cover. It is excluded from AI analysis by
 * `photoAnalysisStates` (a cover carries no finding).
 */
export async function applyBranding(input: {
  organisationId: string;
  reportId: string;
  coverFile: File | null;
  logoFile: File | null;
}): Promise<void> {
  const patch: { logo_path?: string; cover_photo_id?: string } = {};

  if (input.logoFile) {
    patch.logo_path = await uploadBrandingImage(
      input.logoFile,
      input.organisationId,
      input.reportId,
    );
  }

  if (input.coverFile) {
    const sequence = await nextSequence(input.reportId);
    const outcome = await uploadPhoto(
      input.coverFile,
      {
        organisationId: input.organisationId,
        reportId: input.reportId,
        captureFields: {},
      },
      sequence,
      () => {},
    );
    patch.cover_photo_id = outcome.photo.id;
  }

  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("reports").update(patch).eq("id", input.reportId);
  if (error) throw new Error(error.message);
}

/** Set (or clear) which stored photograph appears on the title page. */
export async function setCoverPhoto(reportId: string, photoId: string | null): Promise<void> {
  const { error } = await supabase
    .from("reports")
    .update({ cover_photo_id: photoId })
    .eq("id", reportId);
  if (error) throw new Error(error.message);
}
