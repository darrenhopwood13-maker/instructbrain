/**
 * Findings are stored with a persisted `ref` (Invariant 4 — assigned once,
 * never recomputed from position). Everywhere a person reads it, it is shown
 * as "Item 1", "Item 2". Only the presentation changes; the stored reference
 * is untouched, so an issued report keeps the numbers it was issued with.
 */
export function itemLabel(ref: string | null | undefined): string {
  if (!ref) return "Item";
  const match = /(\d+)\s*$/.exec(ref);
  if (!match) return ref;
  return `Item ${Number.parseInt(match[1]!, 10)}`;
}

/** Comma-separated item labels, for blocker lists and email bodies. */
export function itemLabels(refs: Array<string | null | undefined>): string {
  return refs.map(itemLabel).join(", ");
}
