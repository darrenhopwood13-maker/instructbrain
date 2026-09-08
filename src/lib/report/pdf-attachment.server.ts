/**
 * Turns a report into an email attachment.
 *
 * A build failure is fatal to the send: an email that claims to carry the
 * report and carries nothing is worse than an error the sender can see. An
 * oversized file is not fatal — the recipient still gets the link, and the
 * template says plainly that the PDF was too large.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadReportDocument } from "@/lib/report/document.server";
import { buildReportPdf, type BuildPdfOptions } from "@/lib/report/pdf.server";
import type { EmailAttachment } from "@/lib/email/templates";

type Db = SupabaseClient<any, any, any>;

/** Resend refuses anything much beyond 40MB once base64-encoded. */
const MAX_ATTACHMENT_BYTES = 22 * 1024 * 1024;

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export async function buildEmailPdf(
  db: Db,
  reportId: string,
  options: BuildPdfOptions,
): Promise<EmailAttachment | null> {
  const document = await loadReportDocument(db, reportId);
  if (!document) throw new Error("That report could not be read, so nothing was sent.");

  let built = await buildReportPdf(document, options);

  if (built.bytes.byteLength > MAX_ATTACHMENT_BYTES) {
    // Drop the photographs before giving up on attaching anything at all.
    built = await buildReportPdf(document, { ...options, includePhotos: false });
  }
  if (built.bytes.byteLength > MAX_ATTACHMENT_BYTES) return null;

  return {
    filename: built.filename,
    content: toBase64(built.bytes),
    contentType: "application/pdf",
  };
}
