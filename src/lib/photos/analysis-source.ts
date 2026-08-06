import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET, analysisSourcePath } from "@/lib/photos/storage-paths";

/**
 * The single entry point for handing a photograph to an AI model.
 *
 * Invariant 3: this resolves the ORIGINAL, full-resolution object. It never
 * resolves a thumbnail — `analysisSourcePath` throws if asked to.
 */
export type AnalysableSource = { path: string; signedUrl: string };

export async function analysisSourceFor(
  photo: { storage_path?: string | null; thumbnail_path?: string | null },
  expiresIn = 900,
): Promise<AnalysableSource> {
  const path = analysisSourcePath(photo);
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    throw error ?? new Error(`Could not sign the original object at ${path}`);
  }
  return { path, signedUrl: data.signedUrl };
}
