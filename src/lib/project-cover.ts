import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photos/storage-paths";

/**
 * A project's cover photograph lives at a fixed storage path inside the
 * organisation's folder, so no extra column is needed and existing storage
 * policies (organisation-scoped by first folder) apply unchanged.
 */
export function projectCoverPath(organisationId: string, projectId: string): string {
  return `${organisationId}/projects/${projectId}/cover.jpg`;
}

export async function uploadProjectCover(
  organisationId: string,
  projectId: string,
  file: Blob,
): Promise<void> {
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(projectCoverPath(organisationId, projectId), file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
      cacheControl: "60",
    });
  if (error) throw new Error(error.message);
}

export async function projectCoverUrl(
  organisationId: string,
  projectId: string,
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(projectCoverPath(organisationId, projectId), 3600);
  return data?.signedUrl ?? null;
}
