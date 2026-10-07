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
import type { ReportDocument } from "@/lib/report/document";
import { PHOTO_BUCKET } from "@/lib/photos/storage-paths";

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
  const loaded = await loadReportDocument(db, reportId);
  if (!loaded) throw new Error("That report could not be read, so nothing was sent.");
  // Sent in the report's own issue language; English if that ever fails.
  const { documentForOutput } = await import("@/lib/i18n/report-translation.server");
  const document = await documentForOutput(db, loaded);

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

export async function buildIssuedEmailPdf(
  db: Db,
  reportId: string,
  options: BuildPdfOptions,
): Promise<EmailAttachment | null> {
  const built = await buildIssuedPdfBytes(db, reportId, options);
  if (!built) return null;
  return { filename: built.filename, content: toBase64(built.bytes), contentType: "application/pdf" };
}

/**
 * The frozen finalised PDF of a report — shared by the email attachment and the
 * PDF-only share link. Confidential items never leave the server.
 */
export async function buildIssuedPdfBytes(
  db: Db,
  reportId: string,
  options: BuildPdfOptions,
  maxBytes: number = MAX_ATTACHMENT_BYTES,
): Promise<{ filename: string; bytes: Uint8Array } | null> {
  const { data: report } = await db
    .from("reports")
    .select("current_version, status")
    .eq("id", reportId)
    .single();
  const current = report as { current_version?: number; status?: string } | null;
  if (!current || current.status !== "issued" || !current.current_version) {
    throw new Error("Issue this report before emailing its PDF.");
  }
  const { data: version } = await db
    .from("report_versions")
    .select("document")
    .eq("report_id", reportId)
    .eq("version", current.current_version)
    .single();
  const snapshot = (version as { document?: ReportDocument } | null)?.document;
  if (!snapshot) throw new Error("The issued report copy could not be read, so nothing was sent.");

  const paths = snapshot.photos.flatMap((photo) =>
    [photo.storagePath, photo.thumbnailPath].filter((path): path is string => !!path),
  );
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await db.storage.from(PHOTO_BUCKET).createSignedUrls([...new Set(paths)], 900);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
    }
  }
  const photos = snapshot.photos.map((photo) => ({
    ...photo,
    url: photo.storagePath ? (signed.get(photo.storagePath) ?? null) : photo.url,
    thumbUrl: photo.thumbnailPath
      ? (signed.get(photo.thumbnailPath) ?? signed.get(photo.storagePath ?? "") ?? null)
      : photo.storagePath
        ? (signed.get(photo.storagePath) ?? null)
        : photo.thumbUrl,
  }));
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const issued: ReportDocument = {
    ...snapshot,
    photos,
    findings: snapshot.findings
      .filter((finding) => !finding.isConfidential)
      .map((finding) => ({
        ...finding,
        photos: finding.photos.flatMap((linked) => {
          const photo = byId.get(linked.photo.id);
          return photo ? [{ ...linked, photo }] : [];
        }),
      })),
  };
  const { documentForOutput } = await import("@/lib/i18n/report-translation.server");
  const output = await documentForOutput(db, issued);
  let built = await buildReportPdf(output, options);
  if (built.bytes.byteLength > maxBytes) {
    built = await buildReportPdf(output, { ...options, includePhotos: false });
  }
  if (built.bytes.byteLength > maxBytes) return null;
  return built;
}
