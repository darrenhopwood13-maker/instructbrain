import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photos/storage-paths";

import { PROJECT_COVER_FILENAME, projectCoverPath } from "@/lib/project-cover-path";

export { projectCoverPath };

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

/**
 * Whether a project actually has a cover uploaded.
 *
 * A cover is a bare object at a fixed path and nothing in the database records
 * whether one was ever uploaded, so the folder has to be asked. Signing a path
 * that was never uploaded answers 400 and logs a console error every single
 * time a report containing that project is opened.
 */
export async function projectCoverExists(
  organisationId: string,
  projectId: string,
): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .list(`${organisationId}/projects/${projectId}`, { limit: 100, search: "cover" });
  // If the folder cannot be read at all - no access, a transient failure - do
  // not hide a cover that may genuinely be there. Signing it is the old
  // behaviour and the safe direction to fail in.
  if (error) return true;
  return (data ?? []).some((entry) => entry.name === PROJECT_COVER_FILENAME);
}

export async function projectCoverUrl(
  organisationId: string,
  projectId: string,
): Promise<string | null> {
  if (!(await projectCoverExists(organisationId, projectId))) return null;
  const { data } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(projectCoverPath(organisationId, projectId), 3600);
  return data?.signedUrl ?? null;
}
