/**
 * Reads the full-resolution stored object and hands it to a model inline.
 *
 * Invariant 3: the bytes are the stored analysis source, untouched — this
 * module has no resize step and shares no code path with `thumbnail.ts`.
 *
 * Why inline rather than a signed link: given a link, the provider fetches the
 * object itself and gives up on a large full-resolution file
 * ("Unable to download content from the provided URL before the timeout"),
 * which then had to resolve to `not_assessed`. Sending the bytes with the
 * request removes that failure entirely.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET } from "@/lib/photos/storage-paths";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export type InlineImage = { dataUrl: string; mimeType: string; bytes: number };

export async function loadAnalysableImage(
  client: SupabaseClient<any, any, any>,
  path: string,
): Promise<InlineImage> {
  const { data, error } = await client.storage.from(PHOTO_BUCKET).download(path);
  if (error || !data) {
    throw error ?? new Error("the image could not be opened.");
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.length === 0) throw new Error("the image could not be opened.");
  const mimeType = data.type && data.type.startsWith("image/") ? data.type : "image/jpeg";
  return {
    dataUrl: `data:${mimeType};base64,${toBase64(bytes)}`,
    mimeType,
    bytes: bytes.length,
  };
}

/** Splits a `data:` URL back into parts, for providers that want raw base64. */
export function dataUrlParts(url: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(url);
  return match ? { mimeType: match[1] as string, data: match[2] as string } : null;
}
