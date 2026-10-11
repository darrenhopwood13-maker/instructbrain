/**
 * PRINT DERIVATIVE.
 *
 * Why this exists. The PDF used to embed the display thumbnail — 480px on its
 * long edge — because embedding full-resolution originals exhausted the
 * document's byte budget and left the back half of a long report with no
 * photographs at all. Both horns of that choice are wrong. A plate prints
 * 5.5in wide, so 480px is about 87dpi and reads as mush, while a 12.5MP
 * original is 4MB of paper that nobody can email.
 *
 * The answer is a third object sized for the paper: 1600px on the long edge is
 * ~290dpi across a plate, at roughly 300KB, so a 40-photograph report stays a
 * sendable 12MB.
 *
 * This is a DISPLAY artifact, and deliberately not the original:
 *   - the original object is never modified, re-encoded or replaced;
 *   - nothing produced here is ever sent to a vision model. Analysis reads
 *     `storage_path`, or the full-resolution analysis derivative for formats
 *     the model cannot decode. See `analysis-derivative.ts`, which must never
 *     downscale — a 2mm sealant gap is the whole product;
 *   - it is only ever produced by DOWNSCALING. A source smaller than the
 *     target is left at its own size, never upscaled into false detail.
 *
 * Deliberately shares no helper with `thumbnail.ts`: that module exists to make
 * a small picture for a grid, and if the two ever shared a function someone
 * would "unify" them and silently set the print size to the grid size.
 */

/** Long edge of the print copy. Sized so a plate lands near 290dpi. */
export const PRINT_LONG_EDGE = 1600;

/** Never lower this. JPEG artifacts on a hairline crack are indistinguishable
 *  from the crack. */
const PRINT_QUALITY = 0.85;

export type PrintDerivative = { blob: Blob; width: number; height: number };

function scaled(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

async function toBlob(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality: PRINT_QUALITY });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Print encoding failed"))),
      "image/jpeg",
      PRINT_QUALITY,
    );
  });
}

/**
 * Build the print-sized JPEG for a photograph. Returns null when the browser
 * cannot decode the source — a missing print copy degrades the plate, it must
 * never block the upload of the original.
 */
export async function createPrintDerivative(
  file: Blob,
  maxEdge = PRINT_LONG_EDGE,
): Promise<PrintDerivative | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  try {
    const size = scaled(bitmap.width, bitmap.height, maxEdge);
    const canvas =
      typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(size.width, size.height)
        : Object.assign(document.createElement("canvas"), size);
    const context = (canvas as HTMLCanvasElement).getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await toBlob(canvas as HTMLCanvasElement);
    return { blob, width: size.width, height: size.height };
  } catch {
    return null;
  } finally {
    bitmap.close?.();
  }
}
