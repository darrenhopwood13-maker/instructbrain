/**
 * FULL-RESOLUTION ANALYSIS DERIVATIVE.
 *
 * WHY THIS IS ITS OWN MODULE, DELIBERATELY SHARING NOTHING WITH thumbnail.ts:
 * the thumbnail module exists to DOWNSCALE. This module must NEVER downscale.
 * If the two ever shared a helper, someone would later add a max-edge
 * parameter "for consistency" and silently destroy the analysis path — a 2mm
 * sealant gap does not survive a resize, and that is the entire product.
 *
 * Nothing in this file may import the thumbnail module, and a test asserts
 * that stays true.
 *
 * This derivative exists for one reason only: vision models cannot read HEIC /
 * HEIF / AVIF. A JPEG source is NEVER re-encoded — it is passed through
 * untouched. The archival original is always retained in storage_path; this
 * object is a convenience for the model, not the photograph.
 */

/** Quality floor for the derivative. Never lower this. */
export const ANALYSIS_JPEG_QUALITY = 0.95;

export type AnalysisDerivative = { blob: Blob; width: number; height: number };

/**
 * Formats a vision model can read directly. Anything else needs a derivative.
 * Judged from the bytes, never from the filename — iOS Safari sometimes hands
 * back JPEG bytes under a .heic name and sometimes hands back HEIC bytes under
 * a .jpg name, depending on version and how the photo was picked.
 */
export function modelReadableFromBytes(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 12) return false;
  const view = new DataView(bytes);
  if (view.getUint16(0, false) === 0xffd8) return true; // JPEG
  if (view.getUint32(0, false) === 0x89504e47) return true; // PNG
  // WebP: "RIFF"…"WEBP"
  const riff = view.getUint32(0, false) === 0x52494646;
  const webp = view.getUint32(8, false) === 0x57454250;
  return riff && webp;
}

async function encodeFullResolution(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality: ANALYSIS_JPEG_QUALITY });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Analysis encoding failed"))),
      "image/jpeg",
      ANALYSIS_JPEG_QUALITY,
    );
  });
}

/**
 * Transcode a source the model cannot read into a JPEG of IDENTICAL pixel
 * dimensions. No max edge. No max file size. No cap of any kind.
 *
 * Returns null when the browser cannot decode the source at all — the original
 * is still stored and the photograph is still usable; only the model
 * convenience copy is missing.
 */
export async function createAnalysisDerivative(file: Blob): Promise<AnalysisDerivative | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  try {
    // Source dimensions, verbatim. This is the line that must never gain a cap.
    const width = bitmap.width;
    const height = bitmap.height;
    if (width < 1 || height < 1) return null;

    const canvas =
      typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(width, height)
        : Object.assign(document.createElement("canvas"), { width, height });
    const context = (canvas as HTMLCanvasElement).getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    const blob = await encodeFullResolution(canvas as HTMLCanvasElement);
    return { blob, width, height };
  } catch {
    return null;
  } finally {
    bitmap.close?.();
  }
}
