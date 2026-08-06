import type { Finding } from "@/lib/mock-data";

/**
 * Invariant 4: `ref` is assigned once at creation and persisted. Deleting a
 * photo detaches it from findings and never renumbers anything.
 */
export function detachPhoto(findings: Finding[], photoId: string): Finding[] {
  return findings.map((finding) =>
    finding.photoIds.includes(photoId)
      ? { ...finding, photoIds: finding.photoIds.filter((id) => id !== photoId) }
      : finding,
  );
}

/** Next ref for a new finding: derived from the highest ref ever issued, not from length. */
export function nextRef(existingRefs: string[], prefix = "F"): string {
  const highest = existingRefs.reduce((max, ref) => {
    const match = /(\d+)\s*$/.exec(ref);
    const value = match ? Number.parseInt(match[1]!, 10) : 0;
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}
