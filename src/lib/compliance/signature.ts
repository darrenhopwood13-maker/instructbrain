/**
 * Sign-off on a completed check.
 *
 * What is stored is a record: a name typed by the person signing, an optional drawn
 * signature, and the time. The drawn part lives in the same bucket as the photographs
 * because the storage policy reads the organisation id from the first path segment, and a
 * signature is evidence about the same site as the photos around it. It is kept under its
 * own `signatures` segment so it never turns up in the photo grid or the AI queue.
 */

import { supabase } from "@/integrations/supabase/client";
import { PHOTO_BUCKET } from "@/lib/photos/storage-paths";

export const SIGNATURE_SEGMENT = "signatures";

/** `<organisation_id>/<report_id>/signatures/<run_id>.png` - the policy reads the first segment. */
export function signaturePath(
  organisationId: string,
  reportId: string,
  runId: string,
): string {
  if (!organisationId) throw new Error("You are not a member of an organisation yet.");
  if (!reportId) {
    throw new Error(
      "This check has no report attached yet, so there is nowhere to keep the signature.",
    );
  }
  return `${organisationId}/${reportId}/${SIGNATURE_SEGMENT}/${runId}.png`;
}

export async function uploadSignature(input: {
  blob: Blob;
  organisationId: string;
  reportId: string;
  runId: string;
}): Promise<string> {
  const path = signaturePath(input.organisationId, input.reportId, input.runId);
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, input.blob, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`The signature could not be saved: ${error.message}`);
  return path;
}

/** Signed links for display, keyed by storage path. Missing objects are simply absent. */
export async function signatureUrls(
  paths: string[],
  expiresIn = 3600,
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(unique, expiresIn);
  const result = new Map<string, string>();
  if (error || !data) return result;
  data.forEach((entry, index) => {
    const path = unique[index];
    if (path && entry.signedUrl) result.set(path, entry.signedUrl);
  });
  return result;
}

/**
 * One line describing a sign-off, for the register row and the report footer.
 *
 * Checks completed before signatures were recorded hold a timestamp and nothing else, and
 * saying so is better than printing a timestamp that looks like it came with a name.
 */
export function describeSignOff(run: {
  signedAt: string | null;
  signerName: string | null;
  performedByName: string | null;
}): string | null {
  if (!run.signedAt) return null;
  const when = new Date(run.signedAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const who = run.signerName ?? run.performedByName;
  if (!who) return `Completed and timed at ${when} - no signer was recorded on this one`;
  return `Signed electronically by ${who} on ${when}`;
}
