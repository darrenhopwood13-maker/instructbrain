/**
 * Saving a built PDF from the browser.
 *
 * Desktop Chrome/Edge get a real Save-as window so the person choosing where
 * the report lands actually gets to choose. Everything else falls back to the
 * ordinary download, and phones can hand the file to the share sheet instead
 * (Drive, Files, WhatsApp, email).
 */

type SaveOutcome = "saved" | "downloaded" | "cancelled" | "shared";

type SavePicker = (options: {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}) => Promise<{
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
}>;

/** Decode the base64 payload the server function returns. */
export function pdfBytesFromBase64(content: string): Uint8Array {
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

function pdfFile(bytes: Uint8Array, filename: string): File {
  return new File([bytes as unknown as BlobPart], filename, { type: "application/pdf" });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** True when the device can hand a PDF file to its own share sheet. */
export function canSharePdf(): boolean {
  if (typeof navigator === "undefined") return false;
  const share = (navigator as Navigator & { canShare?: (data: unknown) => boolean }).canShare;
  if (typeof navigator.share !== "function" || typeof share !== "function") return false;
  try {
    return share({ files: [pdfFile(new Uint8Array([37, 80, 68, 70]), "check.pdf")] });
  } catch {
    return false;
  }
}

/** Ask where to save when the browser allows it, otherwise download. */
export async function savePdfBytes(bytes: Uint8Array, filename: string): Promise<SaveOutcome> {
  const blob = pdfBlob(bytes);
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (typeof picker === "function") {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: "PDF report", accept: { "application/pdf": [".pdf"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Anything else (permission, unsupported context) falls back below.
    }
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

/** Hand the PDF to the device share sheet; falls back to a download. */
export async function sharePdfBytes(
  bytes: Uint8Array,
  filename: string,
  title: string,
): Promise<SaveOutcome> {
  if (canSharePdf()) {
    try {
      await navigator.share({ files: [pdfFile(bytes, filename)], title });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  downloadBlob(pdfBlob(bytes), filename);
  return "downloaded";
}
