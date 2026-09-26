/**
 * Android's camera and gallery hand the page a file *reference*, not the bytes.
 * That reference can be revoked while a large batch is still queued, and the
 * browser then throws `NotReadableError` ("The requested file could not be
 * read..."). Taking the bytes into memory the moment the photographs are
 * chosen removes that whole failure class.
 *
 * This is NOT an optimisation path: the bytes are copied verbatim, so the
 * original camera file — full resolution, EXIF intact — is what reaches storage
 * and the model (invariant 3). No canvas, no resize, no recompression.
 */

/** Total bytes held in memory at once; beyond this the reference is kept. */
const MEMORY_BUDGET_BYTES = 192 * 1024 * 1024;

export function isUnreadableFileError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    name === "NotReadableError" ||
    name === "NotFoundError" ||
    /could not be read|permission problems|NotReadableError/i.test(message)
  );
}

/**
 * Copy each file's bytes into memory, in selection order. A file that cannot be
 * read, or that would push the batch past the memory budget, is returned
 * untouched so the upload can still try the reference.
 */
export async function snapshotFiles(files: File[]): Promise<File[]> {
  let held = 0;
  const snapshots: File[] = [];
  for (const file of files) {
    if (held + file.size > MEMORY_BUDGET_BYTES) {
      snapshots.push(file);
      continue;
    }
    try {
      const bytes = await file.arrayBuffer();
      held += bytes.byteLength;
      const copy = new File([bytes], file.name, {
        type: file.type,
        lastModified: file.lastModified,
      });
      const stamp = deviceProvenanceOf(file);
      if (stamp) stampFile(copy, stamp); // keep the camera's time and place
      snapshots.push(copy);
    } catch {
      snapshots.push(file);
    }
  }
  return snapshots;
}
