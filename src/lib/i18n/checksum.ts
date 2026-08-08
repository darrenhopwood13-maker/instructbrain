/** Stable checksum of the English source, so a translation invalidates the moment the record copy changes. */
export async function checksumOf(source: Record<string, string>): Promise<string> {
  const canonical = JSON.stringify(
    Object.keys(source)
      .sort()
      .map((key) => [key, source[key]]),
  );
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
