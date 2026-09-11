/**
 * Display order for findings.
 *
 * Findings are numbered when the AI finishes reading a photograph, and several
 * photographs are read at once, so completion order is not upload order. The
 * stored `ref` and `sequence` are never rewritten (invariant 4) — instead the
 * screen and the document sort by the photograph the finding belongs to, so
 * item 1 is the first photograph the user added.
 */
export type OrderableFinding = {
  /** Sequence of the finding's primary photograph, when it has one. */
  photoSequence: number | null;
  /** The finding's own stored sequence — the tie-break. */
  sequence: number;
};

export function compareFindingOrder(a: OrderableFinding, b: OrderableFinding): number {
  const aPhoto = a.photoSequence ?? Number.MAX_SAFE_INTEGER;
  const bPhoto = b.photoSequence ?? Number.MAX_SAFE_INTEGER;
  if (aPhoto !== bPhoto) return aPhoto - bPhoto;
  return a.sequence - b.sequence;
}

export function sortByPhotoOrder<T>(
  items: T[],
  read: (item: T) => OrderableFinding,
): T[] {
  return [...items].sort((a, b) => compareFindingOrder(read(a), read(b)));
}
