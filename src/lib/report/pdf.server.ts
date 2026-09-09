/**
 * The PDF the recipient actually receives.
 *
 * One builder, three variants: the full report, a single trade's extract and a
 * single item chase. It reads the same assembled document model the screen
 * reads, so an emailed PDF and a shared link can never disagree.
 *
 * Runs in the serverless worker, so it is pure JavaScript (pdf-lib): there is
 * no headless browser available here. Photographs are fetched from storage and
 * embedded as they are — nothing in this file touches the analysis path.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { DocFinding, ReportDocument } from "@/lib/report/document";
import { formatDocumentDate } from "@/lib/report/document";
import { groupResults, safeResultView, type ResultView } from "@/lib/report/grouping";
import { itemLabel } from "@/lib/item-label";
import { recordCopyNotice } from "@/lib/i18n/record-copy";

import { NOT_ASSESSED_ID, resolveSeverity, resolveStatus } from "@/lib/survey-types";

export type PdfVariant = "full" | "trade" | "item";

export type BuildPdfOptions = {
  variant: PdfVariant;
  view?: ResultView;
  /** Trade extract: null means the unassigned fallback set. */
  trade?: string | null;
  /** Item chase: the single finding. */
  findingIds?: string[] | null;
  includePhotos?: boolean;
};

export type BuiltPdf = { bytes: Uint8Array; filename: string };

/* ------------------------------------------------------------------ */
/* Page geometry                                                        */
/* ------------------------------------------------------------------ */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const CONTENT_WIDTH = A4.width - MARGIN * 2;

const INK = rgb(0.06, 0.11, 0.2);
const MUTED = rgb(0.35, 0.39, 0.47);
const RULE = rgb(0.85, 0.87, 0.91);
const ACCENT = rgb(1, 0.37, 0);

const TONE_COLOURS: Record<string, ReturnType<typeof rgb>> = {
  pass: rgb(0.11, 0.45, 0.25),
  fail: rgb(0.68, 0.11, 0.13),
  warn: rgb(0.65, 0.42, 0.03),
  flag: rgb(0.45, 0.2, 0.6),
  neutral: MUTED,
};

/** Photo bytes budget, so a photo-heavy report cannot exhaust worker memory. */
const PHOTO_BUDGET_BYTES = 14 * 1024 * 1024;
const SINGLE_PHOTO_LIMIT_BYTES = 2.5 * 1024 * 1024;

type Cursor = { page: PDFPage; y: number; pageNumber: number };

type Writer = {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  cursor: Cursor;
  footer: string;
};

function newPage(writer: Writer): void {
  const page = writer.doc.addPage([A4.width, A4.height]);
  writer.cursor = { page, y: A4.height - MARGIN, pageNumber: writer.cursor.pageNumber + 1 };
}

function ensure(writer: Writer, needed: number): void {
  if (writer.cursor.y - needed < MARGIN + 30) newPage(writer);
}

function sanitise(value: string): string {
  // The standard PDF fonts are WinAnsi: replace the typography that survey text
  // routinely carries so a smart quote can never break a send.
  return (value ?? "")
    .replace(/[\u2018\u2019\u201A\u2039\u203A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of sanitise(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

type TextOptions = {
  size?: number;
  bold?: boolean;
  colour?: ReturnType<typeof rgb>;
  width?: number;
  x?: number;
  lineGap?: number;
  gapAfter?: number;
};

function drawText(writer: Writer, text: string, options: TextOptions = {}): void {
  const size = options.size ?? 10;
  const font = options.bold ? writer.bold : writer.regular;
  const width = options.width ?? CONTENT_WIDTH;
  const x = options.x ?? MARGIN;
  const lineHeight = size + (options.lineGap ?? 3);
  for (const line of wrap(text, font, size, width)) {
    ensure(writer, lineHeight);
    writer.cursor.page.drawText(line, {
      x,
      y: writer.cursor.y - size,
      size,
      font,
      color: options.colour ?? INK,
    });
    writer.cursor.y -= lineHeight;
  }
  writer.cursor.y -= options.gapAfter ?? 0;
}

function drawRule(writer: Writer, gapBefore = 6, gapAfter = 8): void {
  ensure(writer, gapBefore + gapAfter + 2);
  writer.cursor.y -= gapBefore;
  writer.cursor.page.drawLine({
    start: { x: MARGIN, y: writer.cursor.y },
    end: { x: A4.width - MARGIN, y: writer.cursor.y },
    thickness: 0.75,
    color: RULE,
  });
  writer.cursor.y -= gapAfter;
}

function eyebrow(writer: Writer, text: string): void {
  drawText(writer, text.toUpperCase(), { size: 8, bold: true, colour: ACCENT, gapAfter: 2 });
}

/* ------------------------------------------------------------------ */
/* Photographs                                                          */
/* ------------------------------------------------------------------ */

type PhotoFetcher = {
  spent: number;
  cache: Map<string, PDFImage | null>;
};

function imageKind(bytes: Uint8Array): "jpg" | "png" | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  return null;
}

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function embedPhoto(
  writer: Writer,
  fetcher: PhotoFetcher,
  photo: { id: string; url: string | null; thumbUrl: string | null },
): Promise<PDFImage | null> {
  if (fetcher.cache.has(photo.id)) return fetcher.cache.get(photo.id) ?? null;

  const candidates = [photo.url, photo.thumbUrl].filter((url): url is string => !!url);
  let embedded: PDFImage | null = null;

  for (const url of candidates) {
    if (fetcher.spent >= PHOTO_BUDGET_BYTES) break;
    const bytes = await fetchBytes(url);
    if (!bytes) continue;
    // An oversized original falls back to the display copy rather than
    // blowing the attachment size out.
    if (bytes.byteLength > SINGLE_PHOTO_LIMIT_BYTES && url !== candidates[candidates.length - 1]) {
      continue;
    }
    const kind = imageKind(bytes);
    if (!kind) continue;
    try {
      embedded = kind === "jpg" ? await writer.doc.embedJpg(bytes) : await writer.doc.embedPng(bytes);
      fetcher.spent += bytes.byteLength;
      break;
    } catch {
      /* an unreadable object is skipped, never fatal to the send */
    }
  }

  fetcher.cache.set(photo.id, embedded);
  return embedded;
}

function drawImage(writer: Writer, image: PDFImage, maxWidth: number, maxHeight: number): void {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  ensure(writer, height + 8);
  writer.cursor.page.drawImage(image, {
    x: MARGIN,
    y: writer.cursor.y - height,
    width,
    height,
  });
  writer.cursor.y -= height + 8;
}

/* ------------------------------------------------------------------ */
/* Findings                                                             */
/* ------------------------------------------------------------------ */

function locationOf(finding: DocFinding): string {
  const fields = finding.captureFields;
  return fields["location"] ?? fields["zone"] ?? fields["area"] ?? fields["room"] ?? "";
}

async function drawFinding(
  writer: Writer,
  document: ReportDocument,
  finding: DocFinding,
  fetcher: PhotoFetcher | null,
): Promise<void> {
  const status = resolveStatus(document.snapshot, finding.statusId);
  const severity = resolveSeverity(document.snapshot, finding.severityId);
  const notAssessed = status.id === NOT_ASSESSED_ID;

  ensure(writer, 90);
  drawRule(writer, 10, 8);

  drawText(writer, `${itemLabel(finding.ref)}${locationOf(finding) ? ` — ${locationOf(finding)}` : ""}`, {
    size: 12,
    bold: true,
  });

  const chips = [
    `Status: ${status.label}`,
    severity ? `Severity: ${severity.label}` : null,
    finding.assignedTrade ? `Trade: ${finding.assignedTrade}` : null,
    finding.dueDate ? `Target: ${formatDocumentDate(finding.dueDate)}` : null,
  ].filter((entry): entry is string => !!entry);
  drawText(writer, chips.join("   ·   "), {
    size: 9,
    bold: true,
    colour: TONE_COLOURS[status.tone] ?? MUTED,
    gapAfter: 4,
  });

  if (notAssessed) {
    drawText(
      writer,
      "Not assessed. This item was not resolved by a person and is included here unchanged." +
        (finding.abstainReason ? ` Reason recorded: ${finding.abstainReason}` : ""),
      { size: 9, colour: TONE_COLOURS["flag"] ?? MUTED, gapAfter: 4 },
    );
  }

  if (finding.findingText) drawText(writer, finding.findingText, { size: 10, gapAfter: 4 });
  if (finding.remedialText) {
    drawText(writer, "Required action", { size: 8, bold: true, colour: MUTED });
    drawText(writer, finding.remedialText, { size: 10, gapAfter: 4 });
  }
  if (finding.likelyCause) {
    drawText(writer, `Likely cause: ${finding.likelyCause}`, { size: 9, colour: MUTED });
  }
  if (finding.regulatoryReference) {
    drawText(writer, `Reference: ${finding.regulatoryReference}`, { size: 9, colour: MUTED });
  }

  const extras = Object.entries(finding.captureFields).filter(
    ([key]) => !["location", "zone", "area", "room"].includes(key),
  );
  if (extras.length > 0) {
    drawText(
      writer,
      extras.map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}`).join("   ·   "),
      { size: 9, colour: MUTED },
    );
  }

  if (fetcher) {
    for (const attached of finding.photos.slice(0, 3)) {
      const image = await embedPhoto(writer, fetcher, attached.photo);
      if (image) drawImage(writer, image, CONTENT_WIDTH * 0.62, 260);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Build                                                                */
/* ------------------------------------------------------------------ */

export function selectFindings(document: ReportDocument, options: BuildPdfOptions): DocFinding[] {
  if (options.variant === "item") {
    const ids = new Set(options.findingIds ?? []);
    return document.findings.filter((finding) => ids.has(finding.id) && !finding.isConfidential);
  }
  if (options.variant === "trade") {
    const trade = options.trade ?? null;
    return document.findings.filter(
      (finding) =>
        !finding.isConfidential &&
        (trade === null
          ? !finding.assignedTrade
          : (finding.assignedTrade ?? "").trim() === trade.trim()),
    );
  }
  return document.findings;
}

function safeName(value: string): string {
  const cleaned = sanitise(value)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "report";
}

export function pdfFilename(document: ReportDocument, options: BuildPdfOptions): string {
  const base = safeName(document.report.reference || document.report.title);
  if (options.variant === "trade") return `${base}-${safeName(options.trade ?? "unassigned")}.pdf`;
  if (options.variant === "item") return `${base}-item.pdf`;
  return `${base}.pdf`;
}

export async function buildReportPdf(
  document: ReportDocument,
  options: BuildPdfOptions,
): Promise<BuiltPdf> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([A4.width, A4.height]);

  const writer: Writer = {
    doc,
    regular,
    bold,
    cursor: { page, y: A4.height - MARGIN, pageNumber: 1 },
    footer: [document.report.reference, document.report.title].filter(Boolean).join(" · "),
  };

  const findings = selectFindings(document, options);
  const fetcher: PhotoFetcher | null =
    options.includePhotos === false ? null : { spent: 0, cache: new Map() };

  doc.setTitle(sanitise(document.report.title));
  doc.setProducer("instructBrain");
  doc.setCreator("instructBrain");

  /* Cover */
  eyebrow(writer, document.organisation?.name ?? "instructBrain");
  drawText(writer, document.report.title, { size: 24, bold: true, lineGap: 6, gapAfter: 4 });
  if (document.report.subtitle) {
    drawText(writer, document.report.subtitle, { size: 13, colour: MUTED, gapAfter: 6 });
  }
  if (options.variant === "trade") {
    drawText(writer, `Extract for ${options.trade ?? "items not yet assigned to a trade"}`, {
      size: 12,
      bold: true,
      colour: ACCENT,
      gapAfter: 4,
    });
  }
  drawRule(writer, 10, 12);

  const facts: Array<[string, string]> = [
    ["Project", document.project?.name ?? "Custom report"],
    ["Client", document.project?.clientName ?? ""],
    ["Address", document.project?.address ?? ""],
    ["Reference", document.report.reference ?? ""],
    ["Report date", formatDocumentDate(document.report.reportDate)],
    [
      "Status",
      document.report.status === "issued"
        ? `Issued as version ${document.report.currentVersion}${
            document.report.issuedAt ? ` on ${formatDocumentDate(document.report.issuedAt)}` : ""
          }`
        : "Draft — not yet issued",
    ],
    ["Items included", String(findings.length)],
  ];
  const notice = recordCopyNotice(document.report.outputLanguage);
  for (const [label, value] of facts) {
    if (!value) continue;
    ensure(writer, 14);
    writer.cursor.page.drawText(sanitise(label), {
      x: MARGIN,
      y: writer.cursor.y - 9,
      size: 9,
      font: bold,
      color: MUTED,
    });
    const lines = wrap(value, regular, 10, CONTENT_WIDTH - 110);
    lines.forEach((line, index) => {
      writer.cursor.page.drawText(line, {
        x: MARGIN + 110,
        y: writer.cursor.y - 9 - index * 12,
        size: 10,
        font: regular,
        color: INK,
      });
    });
    writer.cursor.y -= 12 * lines.length + 2;
  }

  if (notice) {
    drawRule(writer, 10, 8);
    drawText(writer, notice, { size: 9, colour: MUTED, gapAfter: 2 });
  }



  /* Summary */
  const summary = document.report.executiveSummary ?? document.synthesis?.executiveSummary ?? "";
  if (options.variant === "full" && summary.trim()) {
    drawRule(writer, 14, 10);
    eyebrow(writer, "Report summary");
    drawText(writer, summary, { size: 10, gapAfter: 4 });
  }

  if (options.variant === "full" && document.report.scopeText) {
    drawRule(writer, 12, 10);
    eyebrow(writer, "Scope and limitations");
    drawText(writer, document.report.scopeText, { size: 10 });
  }
  if (options.variant === "full" && document.report.methodologyText) {
    drawRule(writer, 12, 10);
    eyebrow(writer, "Methodology");
    drawText(writer, document.report.methodologyText, { size: 10 });
  }

  /* Contents — only where the report covers more than one survey type. */
  const sections = sectionsFor(findings, document.surveyTypes ?? [], "Results");
  const sectioned = options.variant === "full" && sections.length > 1;

  if (sectioned) {
    drawRule(writer, 14, 10);
    eyebrow(writer, "Contents");
    for (const section of sections) {
      const refs = section.findings.map((finding) => finding.ref).filter(Boolean);
      const range =
        refs.length === 0
          ? "no items"
          : refs.length === 1
            ? `item ${refs[0]}`
            : `items ${refs[0]} to ${refs[refs.length - 1]}`;
      ensure(writer, 16);
      drawText(writer, `${section.label} — ${section.findings.length} (${range})`, {
        size: 10,
        gapAfter: 1,
      });
    }
  }

  /* Results */
  drawRule(writer, 14, 10);
  eyebrow(writer, options.variant === "item" ? "Item" : "Results");

  if (findings.length === 0) {
    drawText(writer, "There are no items in this selection.", { size: 10, colour: MUTED });
  } else if (options.variant === "full") {
    const view = safeResultView(options.view);
    for (const section of sectioned ? sections : [{ id: "all", label: "", findings }]) {
      if (sectioned) {
        ensure(writer, 70);
        drawText(writer, section.label, { size: 14, bold: true, gapAfter: 4 });
      }
      const groups = groupResults({ ...document, findings: section.findings }, view);
      for (const group of groups) {
        ensure(writer, 60);
        drawText(writer, group.label, { size: 12, bold: true, colour: ACCENT, gapAfter: 2 });
        for (const finding of group.findings) {
          await drawFinding(writer, document, finding, fetcher);
        }
        writer.cursor.y -= 6;
      }
    }
  } else {
    for (const finding of findings) {
      await drawFinding(writer, document, finding, fetcher);
    }
  }

  /* Footers */
  const pages = doc.getPages();
  pages.forEach((sheet, index) => {
    sheet.drawText(sanitise(writer.footer).slice(0, 90), {
      x: MARGIN,
      y: MARGIN - 18,
      size: 8,
      font: regular,
      color: MUTED,
    });
    const label = `Page ${index + 1} of ${pages.length}`;
    sheet.drawText(label, {
      x: A4.width - MARGIN - regular.widthOfTextAtSize(label, 8),
      y: MARGIN - 18,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });

  const bytes = await doc.save();
  return { bytes, filename: pdfFilename(document, options) };
}
