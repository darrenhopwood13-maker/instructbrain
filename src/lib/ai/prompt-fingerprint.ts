/**
 * A short, stable fingerprint of the system prompt, for the analysis cache key.
 *
 * WHY THIS EXISTS. The analysis cache is keyed on the survey snapshot, the
 * models and the brief (see snapshotKey in analyse.server.ts). The prompt is not
 * keyed — but the prompt is built from the code, so changing the prompt changes
 * what the model is asked while leaving the key identical. Photographs already
 * in the cache are then answered under the old prompt indefinitely, and a
 * verified prompt fix looks like it never shipped.
 *
 * Measured 4 Oct 2026. A report created at 11:45 was served a cache row written
 * at 10:03 — the same 2,619 characters, byte for byte — from before a field-name
 * fix. That stale copy lost 3 of 5 findings; a report an hour earlier, whose key
 * happened to differ, read 15 of 15 perfectly. That is the intermittency this
 * closes.
 *
 * Deriving the version from the prompt itself rather than a hand-bumped constant
 * means it cannot be forgotten: any change to the voice, the rules, the field
 * guide, the regulation index or the tone wording changes the fingerprint, which
 * changes the key, which retires the stale rows.
 */
export async function promptFingerprint(prompt: string): Promise<string> {
  const bytes = new TextEncoder().encode(prompt);

  // Web Crypto is present in the Cloudflare worker and in Node; photo-service
  // already relies on it for the photo checksum. The fallback below exists so a
  // missing crypto cannot silently collapse every prompt to one key — it is
  // still a deterministic function of the prompt.
  if (typeof crypto === "undefined" || !crypto.subtle) {
    let hash = 2166136261;
    for (const byte of bytes) {
      hash ^= byte;
      hash = Math.imul(hash, 16777619);
    }
    return `fnv${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
