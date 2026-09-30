/**
 * MANUAL-REPORT UPLOAD IMAGE — used only by templates flagged `manualOnly`,
 * whose photographs are never read by AI. Shares no code with the display
 * thumbnail or the analysis derivative modules.
 *
 * Reduces a photograph to a 2000px long edge JPEG so it uploads quickly on a
 * site connection while staying sharp in the report and PDF. EXIF is read by
 * the caller from the original bytes BEFORE this runs.
 */
export const MANUAL_LONG_EDGE = 2000;
const QUALITY = 0.85;

let busy: Promise<unknown> = Promise.resolve();

export type ReducedImage = { blob: Blob; width: number; height: number };

async function reduce(file: Blob): Promise<ReducedImage | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  try {
    const long = Math.max(bitmap.width, bitmap.height);
    const scale = long > MANUAL_LONG_EDGE ? MANUAL_LONG_EDGE / long : 1;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    canvas.width = 0;
    canvas.height = 0;
    return blob ? { blob, width, height } : null;
  } finally {
    bitmap.close();
  }
}

/** One image at a time — decoding several full-size photos stalls phones. */
export function reduceForManualReport(file: Blob): Promise<ReducedImage | null> {
  const run = busy.then(() => reduce(file)).catch(() => null);
  busy = run;
  return run;
}
