/**
 * DISPLAY THUMBNAILS ONLY.
 *
 * Invariant 3: this file exists solely to produce a small derivative for the
 * grid and list UI. Nothing here ever touches the object that is uploaded as
 * the original, and nothing produced here is ever sent to an AI model. There
 * is deliberately no shared `processImage()` helper: a 2mm sealant gap or a
 * hairline crack does not survive downscaling, and that is the whole product.
 */

export const THUMBNAIL_MAX_EDGE = 480;
const THUMBNAIL_QUALITY = 0.72;

export type Thumbnail = { blob: Blob; width: number; height: number };

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
    return canvas.convertToBlob({ type: "image/jpeg", quality: THUMBNAIL_QUALITY });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Thumbnail encoding failed"))),
      "image/jpeg",
      THUMBNAIL_QUALITY,
    );
  });
}

/**
 * Build a small JPEG preview from a source file. Returns null when the browser
 * cannot decode the format — a missing thumbnail degrades the grid, it must
 * never block the original upload.
 */
export async function createDisplayThumbnail(
  file: Blob,
  maxEdge = THUMBNAIL_MAX_EDGE,
): Promise<Thumbnail | null> {
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
