import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photos/storage-paths";
import { nextSequence, uploadPhoto } from "@/lib/photos/photo-service";
import { brandingPath, organisationLogoPath } from "@/lib/report/logo";

export { brandingPath, resolveLogoPath, organisationLogoPath } from "@/lib/report/logo";

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

/**
 * Upload (or replace) the organisation's saved logo and record its path.
 * Owners/admins only — enforced both by the `report-photos` storage
 * policies and by the `orgs_update_admin` RLS policy on `organisations`.
 */
export async function uploadOrganisationLogo(file: File, organisationId: string): Promise<string> {
  const path = organisationLogoPath(organisationId, file.name || "logo.png");
  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { error: updateError } = await supabase
    .from("organisations")
    .update({ logo_path: path })
    .eq("id", organisationId);
  if (updateError) throw new Error(updateError.message);

  return path;
}
