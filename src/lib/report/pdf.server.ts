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
import { BRAND_CREDIT } from "@/lib/brand";
import type { DocFinding, DocPhoto, ReportDocument } from "@/lib/report/document";
import { formatDocumentDate } from "@/lib/report/document";
import { groupResults, safeResultView, type ResultView } from "@/lib/report/grouping";
import { itemLabel } from "@/lib/item-label";
import { recordCopyNotice } from "@/lib/i18n/record-copy";
import { sectionsFor } from "@/lib/report/sections";
import {
  inventoryCheckoutComment,
  inventoryConditionLabel,
  inventoryCoverPhoto,
  inventoryItemTableLabel,
  inventoryLayout,
  inventoryRoomPhotoGroups,
  inventoryRooms,
  isInventoryLayout,
  type InventoryAppendixEntry,
} from "@/lib/report/inventory-layout";
import {
  coerceHandover,
  handoverLayoutOf,
  keyPhotos,
  meterPhotoFor,
  meterReadingText,
  meterSlots,
} from "@/lib/report/handover";
import { NOT_ASSESSED_ID, photoWorkflowOf, resolveSeverity, resolveStatus } from "@/lib/survey-types";

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
const LANDSCAPE_LETTER = { width: 792, height: 612 };
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
const PHOTO_BUDGET_BYTES = 40 * 1024 * 1024;
const SINGLE_PHOTO_LIMIT_BYTES = 2.5 * 1024 * 1024;

type Cursor = { page: PDFPage; y: number; pageNumber: number };

type Writer = {
  doc: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  cursor: Cursor;
  footer: string;
  pageSize: { width: number; height: number };
  margin: number;
  contentWidth: number;
};

function newPage(writer: Writer): void {
  const page = writer.doc.addPage([writer.pageSize.width, writer.pageSize.height]);
  writer.cursor = {
    page,
    y: writer.pageSize.height - writer.margin,
    pageNumber: writer.cursor.pageNumber + 1,
  };
}

function ensure(writer: Writer, needed: number): void {
  if (writer.cursor.y - needed < writer.margin + 30) newPage(writer);
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
  align?: "left" | "center" | "justify";
};

function drawText(writer: Writer, text: string, options: TextOptions = {}): void {
  const size = options.size ?? 10;
  const font = options.bold ? writer.bold : writer.regular;
  const width = options.width ?? writer.contentWidth;
  const x = options.x ?? writer.margin;
  const lineHeight = size + (options.lineGap ?? 3);
  const lines = wrap(text, font, size, width);
  const alignment = options.align ?? "left";
  lines.forEach((line, index) => {
    ensure(writer, lineHeight);
    const lineWidth = font.widthOfTextAtSize(line, size);
    const isFinalLine = index === lines.length - 1;
    const words = line.split(/\s+/).filter(Boolean);
    if (alignment === "justify" && !isFinalLine && words.length > 1 && lineWidth < width) {
      const wordsWidth = words.reduce((total, word) => total + font.widthOfTextAtSize(word, size), 0);
      const gap = (width - wordsWidth) / (words.length - 1);
      let wordX = x;
      for (const word of words) {
        writer.cursor.page.drawText(word, {
          x: wordX,
          y: writer.cursor.y - size,
          size,
          font,
          color: options.colour ?? INK,
        });
        wordX += font.widthOfTextAtSize(word, size) + gap;
      }
    } else {
      writer.cursor.page.drawText(line, {
        x: alignment === "center" ? x + Math.max(0, (width - lineWidth) / 2) : x,
        y: writer.cursor.y - size,
        size,
        font,
        color: options.colour ?? INK,
      });
    }
    writer.cursor.y -= lineHeight;
  });
  writer.cursor.y -= options.gapAfter ?? 0;
}

function drawRule(writer: Writer, gapBefore = 6, gapAfter = 8): void {
  ensure(writer, gapBefore + gapAfter + 2);
  writer.cursor.y -= gapBefore;
  writer.cursor.page.drawLine({
    start: { x: writer.margin, y: writer.cursor.y },
    end: { x: writer.pageSize.width - writer.margin, y: writer.cursor.y },
    thickness: 0.75,
    color: RULE,
  });
  writer.cursor.y -= gapAfter;
}

function eyebrow(writer: Writer, text: string): void {
  drawText(writer, text.toUpperCase(), {
    size: 8,
    bold: true,
    colour: ACCENT,
    gapAfter: 2,
    align: "center",
  });
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

  // Print-sized copy first: a photo drawn in a small box never needs the
  // full-resolution original, and using originals exhausted the budget after
  // a handful of photos, leaving the rest of the report without pictures.
  // (Display copy only — the AI analysis path is separate and untouched.)
  const candidates = [photo.thumbUrl, photo.url].filter((url): url is string => !!url);
  let embedded: PDFImage | null = null;

  for (const url of candidates) {
    if (fetcher.spent >= PHOTO_BUDGET_BYTES) break;
    const bytes = await fetchBytes(url);
    if (!bytes) continue;
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
    x: writer.margin,
    y: writer.cursor.y - height,
    width,
    height,
  });
  writer.cursor.y -= height + 8;
}

function drawImageAt(
  page: PDFPage,
  image: PDFImage,
  x: number,
  top: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, { x, y: top - height, width, height });
  return { width, height };
}

function drawFooters(writer: Writer): void {
  const pages = writer.doc.getPages();
  const credit = sanitise(BRAND_CREDIT);
  pages.forEach((sheet, index) => {
    sheet.drawText(sanitise(writer.footer).slice(0, 90), {
      x: writer.margin,
      y: writer.margin - 18,
      size: 8,
      font: writer.regular,
      color: MUTED,
    });
    // One faint credit, centred beneath the footer line, identical on every page.
    sheet.drawText(credit, {
      x: writer.pageSize.width / 2 - writer.regular.widthOfTextAtSize(credit, 6.5) / 2,
      y: writer.margin - 29,
      size: 6.5,
      font: writer.regular,
      color: MUTED,
      opacity: 0.7,
    });
    // Subtle brand touch: a thin orange rule across the top of every page.
    sheet.drawRectangle({
      x: writer.margin,
      y: writer.pageSize.height - writer.margin / 2,
      width: writer.pageSize.width - writer.margin * 2,
      height: 1.2,
      color: ACCENT,
    });
    const label = `Page ${index + 1} of ${pages.length}`;
    sheet.drawText(label, {
      x: writer.pageSize.width - writer.margin - writer.regular.widthOfTextAtSize(label, 8),
      y: writer.margin - 18,
      size: 8,
      font: writer.regular,
      color: MUTED,
    });
  });
}

function drawCellText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  top: number,
  width: number,
  size: number,
  colour = INK,
): number {
  const lineHeight = size + 3;
  const lines = wrap(text, font, size, width);
  lines.forEach((line, index) => {
    page.drawText(line, { x, y: top - size - index * lineHeight, size, font, color: colour });
  });
  return lines.length * lineHeight;
}

function estimatedTextHeight(text: string, font: PDFFont, size: number, width: number): number {
  return wrap(text, font, size, width).length * (size + 3);
}

function drawCenteredText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  y: number,
  size: number,
  pageWidth: number,
  colour = INK,
  maxWidth = pageWidth - 120,
): number {
  const lines = wrap(text, font, size, maxWidth);
  const lineHeight = size + 6;
  lines.forEach((line, index) => {
    const width = font.widthOfTextAtSize(line, size);
    page.drawText(line, {
      x: (pageWidth - width) / 2,
      y: y - index * lineHeight,
      size,
      font,
      color: colour,
    });
  });
  return y - lines.length * lineHeight;
}

function drawInventoryHeader(writer: Writer, title = "Property inventory"): void {
  const safeTitle = sanitise(title);
  writer.cursor.page.drawText(safeTitle, {
    x: (writer.pageSize.width - writer.bold.widthOfTextAtSize(safeTitle, 14)) / 2,
    y: writer.pageSize.height - writer.margin - 3,
    size: 14,
    font: writer.bold,
    color: INK,
  });
  // No product branding across the top: the page header carries the report or
  // room title only. The credit sits once in the page footer.
  writer.cursor.page.drawLine({
    start: { x: writer.margin, y: writer.pageSize.height - writer.margin - 16 },
    end: { x: writer.pageSize.width - writer.margin, y: writer.pageSize.height - writer.margin - 16 },
    thickness: 0.85,
    color: ACCENT,
  });
  writer.cursor.y = writer.pageSize.height - writer.margin - 34;
}

type InventoryIndexEntry = { label: string; page: number; detail?: string };

function drawInventoryIndexPage(
  writer: Writer,
  page: PDFPage,
  entries: InventoryIndexEntry[],
): void {
  page.drawText("Index", {
    x: (writer.pageSize.width - writer.bold.widthOfTextAtSize("Index", 16)) / 2,
    y: writer.pageSize.height - writer.margin - 3,
    size: 16,
    font: writer.bold,
    color: INK,
  });
  page.drawLine({
    start: { x: writer.margin, y: writer.pageSize.height - writer.margin - 18 },
    end: { x: writer.pageSize.width - writer.margin, y: writer.pageSize.height - writer.margin - 18 },
    thickness: 0.85,
    color: ACCENT,
  });

  let y = writer.pageSize.height - writer.margin - 58;
  for (const [index, entry] of entries.entries()) {
    if (y < writer.margin + 24) break;
    const number = String(index + 1).padStart(2, "0");
    const pageLabel = String(entry.page);
    page.drawText(number, { x: writer.margin, y, size: 9, font: writer.bold, color: ACCENT });
    page.drawText(sanitise(entry.label), {
      x: writer.margin + 38,
      y,
      size: 10,
      font: writer.bold,
      color: INK,
    });
    if (entry.detail) {
      page.drawText(sanitise(entry.detail), {
        x: writer.margin + 255,
        y,
        size: 8,
        font: writer.regular,
        color: MUTED,
      });
    }
    page.drawText(pageLabel, {
      x: writer.pageSize.width - writer.margin - writer.regular.widthOfTextAtSize(pageLabel, 9),
      y,
      size: 9,
      font: writer.regular,
      color: MUTED,
    });
    y -= 24;
  }
}

async function drawInventoryOverviewPhotos(
  writer: Writer,
  fetcher: PhotoFetcher | null,
  photos: DocPhoto[],
): Promise<void> {
  if (!fetcher || photos.length === 0) return;
  const gap = 12;
  const width = (writer.contentWidth - gap * 2) / 3;
  const height = 116;
  ensure(writer, height + 18);
  const top = writer.cursor.y;
  for (const [index, photo] of photos.slice(0, 3).entries()) {
    const x = writer.margin + index * (width + gap);
    writer.cursor.page.drawRectangle({
      x,
      y: top - height,
      width,
      height,
      borderColor: RULE,
      borderWidth: 0.75,
    });
    const image = await embedPhoto(writer, fetcher, photo);
    if (image) drawImageAt(writer.cursor.page, image, x + 4, top - 4, width - 8, height - 8);
    else
      writer.cursor.page.drawText("Photo unavailable", { x: x + 6, y: top - height / 2, size: 8, font: writer.regular, color: MUTED });
    writer.cursor.page.drawText(`Photo ${photo.sequence}`, {
      x: x + 6,
      y: top - height + 6,
      size: 7,
      font: writer.bold,
      color: MUTED,
    });
  }
  writer.cursor.y -= height + 18;
}

function drawInventoryTableHeader(
  writer: Writer,
  columns: [number, number, number, number],
  labels: [string, string, string, string],
): void {
  const x = writer.margin;
  const height = 22;
  ensure(writer, height);
  writer.cursor.page.drawRectangle({ x, y: writer.cursor.y - height, width: writer.contentWidth, height, color: rgb(0.94, 0.96, 0.98) });
  let cellX = x;
  for (const [index, label] of labels.entries()) {
    const columnWidth = columns[index] ?? 0;
    writer.cursor.page.drawText(sanitise(label), {
      x: cellX + 5,
      y: writer.cursor.y - 14,
      size: 8,
      font: writer.bold,
      color: MUTED,
    });
    if (index < labels.length - 1) {
      writer.cursor.page.drawLine({
        start: { x: cellX + columnWidth, y: writer.cursor.y },
        end: { x: cellX + columnWidth, y: writer.cursor.y - height },
        thickness: 0.5,
        color: RULE,
      });
    }
    cellX += columnWidth;
  }
  writer.cursor.page.drawRectangle({
    x,
    y: writer.cursor.y - height,
    width: writer.contentWidth,
    height,
    borderColor: RULE,
    borderWidth: 0.5,
  });
  writer.cursor.y -= height;
}

async function drawInventoryPhotoPages(
  writer: Writer,
  document: ReportDocument,
  entries: InventoryAppendixEntry[],
  fetcher: PhotoFetcher | null,
  heading: string,
  caption: string,
): Promise<InventoryIndexEntry | null> {
  if (entries.length === 0) return null;

  let firstPage: number | null = null;
  const gap = 16;
  const cardWidth = (writer.contentWidth - gap) / 2;
  const cardHeight = 205;
  const imageHeight = 150;

  for (let index = 0; index < entries.length; index += 4) {
    newPage(writer);
    if (firstPage === null) firstPage = writer.cursor.pageNumber;
    drawInventoryHeader(writer, heading);
    drawText(writer, caption, { size: 9, colour: MUTED, gapAfter: 4 });
    const pageTop = writer.cursor.y;
    for (const [slot, entry] of entries.slice(index, index + 4).entries()) {
      const column = slot % 2;
      const row = Math.floor(slot / 2);
      const x = writer.margin + column * (cardWidth + gap);
      const top = pageTop - row * (cardHeight + 18);
      if (top - cardHeight < writer.margin + 24) continue;
      const { photo, findings, room } = entry;
      const linkedItems = findings.map((finding) => inventoryItemTableLabel(finding, document)).join(", ") || "No item linked";
      writer.cursor.page.drawText(sanitise(`Photo ${photo.sequence} - ${room}`), {
        x,
        y: top - 10,
        size: 10,
        font: writer.bold,
        color: INK,
      });
      writer.cursor.page.drawText(sanitise(linkedItems), {
        x,
        y: top - 24,
        size: 9,
        font: writer.regular,
        color: MUTED,
      });

      writer.cursor.page.drawRectangle({
        x,
        y: top - 36 - imageHeight,
        width: cardWidth,
        height: imageHeight,
        borderColor: RULE,
        borderWidth: 0.75,
      });
      if (fetcher) {
        const image = await embedPhoto(writer, fetcher, photo);
        if (image) drawImageAt(writer.cursor.page, image, x + 6, top - 42, cardWidth - 12, imageHeight - 12);
        else
          writer.cursor.page.drawText("Photo unavailable", { x: x + 10, y: top - 36 - imageHeight / 2, size: 8, font: writer.regular, color: MUTED });
      }
    }
  }
  return firstPage === null
    ? null
    : { label: heading, page: firstPage, detail: `${entries.length} photo${entries.length === 1 ? "" : "s"}` };
}

function drawBoxedPhoto(
  writer: Writer,
  image: PDFImage | null,
  x: number,
  top: number,
  width: number,
  height: number,
  emptyText: string,
): void {
  writer.cursor.page.drawRectangle({ x, y: top - height, width, height, borderColor: RULE, borderWidth: 0.75 });
  if (image) drawImageAt(writer.cursor.page, image, x + 4, top - 4, width - 8, height - 8);
  else
    writer.cursor.page.drawText(sanitise(emptyText), {
      x: x + 6,
      y: top - height / 2,
      size: 8,
      font: writer.regular,
      color: MUTED,
    });
}

/** Meter readings and keys: always printed, blank where nothing was recorded. */
async function drawInventoryHandoverPages(
  writer: Writer,
  document: ReportDocument,
  fetcher: PhotoFetcher | null,
): Promise<InventoryIndexEntry[]> {
  const layout = handoverLayoutOf(document.snapshot);
  const workflow = photoWorkflowOf(document.snapshot);
  if (!layout || !workflow) return [];
  const record = coerceHandover(document.report.handover);
  const entries: InventoryIndexEntry[] = [];
  const photoOf = async (photo: DocPhoto | null) =>
    photo && fetcher ? embedPhoto(writer, fetcher, photo) : null;

  // Meters: photos in a row, captioned; then the start / end table.
  newPage(writer);
  entries.push({ label: layout.meterTitle, page: writer.cursor.pageNumber });
  drawInventoryHeader(writer, layout.meterTitle);
  const slots = meterSlots(layout, record);
  const perRow = Math.min(3, Math.max(1, slots.length));
  const gap = 12;
  const boxWidth = (writer.contentWidth - gap * (perRow - 1)) / perRow;
  const boxHeight = slots.length > 3 ? 110 : 150;
  for (let start = 0; start < slots.length; start += perRow) {
    const row = slots.slice(start, start + perRow);
    ensure(writer, boxHeight + 40);
    const top = writer.cursor.y;
    for (const [index, slot] of row.entries()) {
      const x = writer.margin + index * (boxWidth + gap);
      const photo = meterPhotoFor(layout, workflow.roleField, document.photos, slot.id);
      drawBoxedPhoto(writer, await photoOf(photo), x, top, boxWidth, boxHeight, "no photo");
      const entry = record.meters[slot.id];
      const caption = [
        `${slot.label}: ${meterReadingText(layout, entry) || " "}`,
        entry?.serial?.trim() ? `${layout.serialLabel}: ${entry.serial.trim()}` : "",
      ].filter(Boolean);
      caption.forEach((line, lineIndex) => {
        writer.cursor.page.drawText(sanitise(line), {
          x,
          y: top - boxHeight - 12 - lineIndex * 11,
          size: 8.5,
          font: lineIndex === 0 ? writer.bold : writer.regular,
          color: lineIndex === 0 ? INK : MUTED,
        });
      });
    }
    writer.cursor.y = top - boxHeight - 40;
  }

  const labelWidth = 200;
  const columnWidth = (writer.contentWidth - labelWidth) / 2;
  const rowHeight = 24;
  const drawRow = (cells: [string, string, string], header: boolean) => {
    ensure(writer, rowHeight);
    const top = writer.cursor.y;
    if (header) {
      writer.cursor.page.drawRectangle({
        x: writer.margin,
        y: top - rowHeight,
        width: writer.contentWidth,
        height: rowHeight,
        color: rgb(0.94, 0.96, 0.98),
      });
    }
    writer.cursor.page.drawRectangle({
      x: writer.margin,
      y: top - rowHeight,
      width: writer.contentWidth,
      height: rowHeight,
      borderColor: RULE,
      borderWidth: 0.5,
    });
    const widths = [labelWidth, columnWidth, columnWidth];
    let x = writer.margin;
    cells.forEach((cell, index) => {
      if (index > 0) {
        writer.cursor.page.drawLine({ start: { x, y: top }, end: { x, y: top - rowHeight }, thickness: 0.5, color: RULE });
      }
      drawCellText(writer.cursor.page, header || index === 0 ? writer.bold : writer.regular, cell, x + 6, top - 5, (widths[index] ?? 0) - 12, 8.5, header ? MUTED : INK);
      x += widths[index] ?? 0;
    });
    writer.cursor.y -= rowHeight;
  };
  drawRow(["", layout.startLabel, layout.endLabel], true);
  for (const slot of slots) drawRow([slot.label, meterReadingText(layout, record.meters[slot.id]), ""], false);
  writer.cursor.y -= 12;
  if (layout.meterNotice) drawText(writer, layout.meterNotice, { size: 8.5, colour: MUTED });

  // Keys: photos, the list, then the yes / no answers.
  newPage(writer);
  entries.push({ label: layout.keysTitle, page: writer.cursor.pageNumber });
  drawInventoryHeader(writer, layout.keysTitle);
  const keys = keyPhotos(layout, workflow.roleField, document.photos).sort((a, b) => a.sequence - b.sequence);
  const keyBoxes = Math.max(1, Math.min(3, keys.length));
  const keyWidth = (writer.contentWidth - gap * (keyBoxes - 1)) / keyBoxes;
  const keyHeight = 150;
  for (let start = 0; start < Math.max(1, keys.length); start += keyBoxes) {
    ensure(writer, keyHeight + 16);
    const top = writer.cursor.y;
    for (let index = 0; index < keyBoxes; index += 1) {
      const photo = keys[start + index] ?? null;
      if (start + index >= Math.max(1, keys.length)) break;
      drawBoxedPhoto(writer, await photoOf(photo), writer.margin + index * (keyWidth + gap), top, keyWidth, keyHeight, "no photo");
    }
    writer.cursor.y = top - keyHeight - 16;
  }
  if (layout.keysIntro) drawText(writer, layout.keysIntro, { size: 10, bold: true, gapAfter: 6 });
  const listed = record.keys.filter((key) => key.label.trim() !== "");
  drawRow([layout.keyItemLabel, layout.keyQuantityLabel, ""], true);
  if (listed.length === 0) {
    drawRow([" ", " ", ""], false);
    drawRow([" ", " ", ""], false);
  }
  for (const key of listed) drawRow([key.label.trim(), key.quantity.trim(), ""], false);
  writer.cursor.y -= 12;
  for (const question of layout.questions) {
    const answer = record.answers[question.id];
    drawText(writer, `${question.label}: ${answer === "yes" ? "Yes" : answer === "no" ? "No" : "__________"}`, {
      size: 10,
      gapAfter: 4,
    });
  }
  return entries;
}

function drawInventoryBackingPages(writer: Writer, document: ReportDocument): InventoryIndexEntry[] {
  const pages = inventoryLayout(document)?.backingPages ?? [];
  if (pages.length === 0) return [];

  const entries: InventoryIndexEntry[] = [];
  for (const pageDefinition of pages) {
    newPage(writer);
    entries.push({ label: pageDefinition.title, page: writer.cursor.pageNumber });
    drawInventoryHeader(writer, pageDefinition.title);
    for (const paragraph of pageDefinition.body) {
      drawText(writer, paragraph, { size: 10, lineGap: 4, gapAfter: 8, align: "justify" });
    }
  }
  return entries;
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
    align: "center",
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

  if (finding.findingText) drawText(writer, finding.findingText, { size: 10, gapAfter: 4, align: "justify" });
  if (finding.remedialText) {
    drawText(writer, "Required action", { size: 8, bold: true, colour: MUTED });
    drawText(writer, finding.remedialText, { size: 10, gapAfter: 4, align: "justify" });
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
      if (image) drawImage(writer, image, writer.contentWidth * 0.62, 260);
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

async function buildInventoryReportPdf(
  document: ReportDocument,
  options: BuildPdfOptions,
): Promise<BuiltPdf> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([LANDSCAPE_LETTER.width, LANDSCAPE_LETTER.height]);
  const margin = 36;
  const writer: Writer = {
    doc,
    regular,
    bold,
    cursor: { page, y: LANDSCAPE_LETTER.height - margin, pageNumber: 1 },
    footer: [document.report.reference, document.report.title].filter(Boolean).join(" · "),
    pageSize: LANDSCAPE_LETTER,
    margin,
    contentWidth: LANDSCAPE_LETTER.width - margin * 2,
  };
  const fetcher: PhotoFetcher | null =
    options.includePhotos === false ? null : { spent: 0, cache: new Map() };

  doc.setTitle(sanitise(document.report.title));
  doc.setProducer("instructBrain");
  doc.setCreator("instructBrain");

  const cover = inventoryCoverPhoto(document);
  const coverPage = writer.cursor.page;
  const organisationName = document.organisation?.name ?? "instructBrain";
  let coverY = 430;
  coverY = drawCenteredText(coverPage, bold, organisationName.toUpperCase(), coverY, 27, LANDSCAPE_LETTER.width);
  coverPage.drawLine({
    start: { x: LANDSCAPE_LETTER.width / 2 - 88, y: coverY - 12 },
    end: { x: LANDSCAPE_LETTER.width / 2 + 88, y: coverY - 12 },
    thickness: 0.85,
    color: ACCENT,
  });
  coverY -= 66;
  coverY = drawCenteredText(coverPage, bold, "INVENTORY", coverY, 21, LANDSCAPE_LETTER.width);
  coverY -= 10;
  coverY = drawCenteredText(coverPage, regular, "AT", coverY, 14, LANDSCAPE_LETTER.width, MUTED);
  const address = document.project?.address ?? document.project?.name ?? "Property not recorded";
  coverY -= 15;
  coverY = drawCenteredText(coverPage, regular, address, coverY, 16, LANDSCAPE_LETTER.width);
  if (document.project?.reference) {
    coverY = drawCenteredText(coverPage, regular, document.project.reference, coverY - 5, 12, LANDSCAPE_LETTER.width, MUTED);
  }
  if (document.project?.clientName) {
    drawCenteredText(coverPage, regular, `Client:  ${document.project.clientName}`, coverY - 7, 12, LANDSCAPE_LETTER.width, MUTED);
  }
  coverPage.drawText(formatDocumentDate(document.report.reportDate), {
    x: LANDSCAPE_LETTER.width / 2 - regular.widthOfTextAtSize(formatDocumentDate(document.report.reportDate), 11) / 2,
    y: 95,
    size: 11,
    font: regular,
    color: INK,
  });
  const footerLine = [document.organisation?.address, document.report.reference ? `Ref: ${document.report.reference}` : null]
    .filter((value): value is string => !!value)
    .join(" — ");
  if (footerLine) {
    coverPage.drawText(sanitise(footerLine).slice(0, 110), {
      x: LANDSCAPE_LETTER.width / 2 - regular.widthOfTextAtSize(sanitise(footerLine).slice(0, 110), 8) / 2,
      y: 62,
      size: 8,
      font: regular,
      color: MUTED,
    });
  }
  if (cover && fetcher) {
    const image = await embedPhoto(writer, fetcher, cover);
    if (image) {
      drawImageAt(
        coverPage,
        image,
        LANDSCAPE_LETTER.width - margin - 150,
        166,
        150,
        82,
      );
    }
  }

  const rooms = inventoryRooms(document);
  newPage(writer);
  const indexPage = writer.cursor.page;
  const indexEntries: InventoryIndexEntry[] = [];

  const layout = inventoryLayout(document);
  const labels: [string, string, string, string] = [
    layout?.columns?.item ?? "Item",
    layout?.columns?.description ?? "Description",
    layout?.columns?.condition ?? "Condition",
    layout?.columns?.checkoutComment ?? "Check Out Comment",
  ];
  const columns: [number, number, number, number] = [92, 336, 124, writer.contentWidth - 92 - 336 - 124];

  const photoGroups = inventoryRoomPhotoGroups(document);

  // Fetch every photo a few at a time up front (in page order, so the budget
  // is spent in reading order) instead of one after another while drawing.
  if (fetcher) {
    const queue = [
      ...rooms.flatMap((room) => room.overviewPhotos.slice(0, 3)),
      ...photoGroups.rooms.flatMap((group) => group.entries.map((entry) => entry.photo)),
      ...photoGroups.unallocated.map((entry) => entry.photo),
    ];
    let next = 0;
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        while (next < queue.length) {
          const photo = queue[next++];
          if (photo) await embedPhoto(writer, fetcher, photo);
        }
      }),
    );
  }

  for (const room of rooms) {
    newPage(writer);
    indexEntries.push({
      label: room.label,
      page: writer.cursor.pageNumber,
      detail: `${room.findings.length} item${room.findings.length === 1 ? "" : "s"}`,
    });
    drawInventoryHeader(writer, room.label);
    drawText(writer, `${room.findings.length} item${room.findings.length === 1 ? "" : "s"}`, {
      size: 9,
      colour: MUTED,
      gapAfter: 4,
    });
    await drawInventoryOverviewPhotos(writer, fetcher, room.overviewPhotos);
    drawInventoryTableHeader(writer, columns, labels);
    if (room.findings.length === 0) {
      drawText(writer, "No inventory items recorded in this room yet.", { size: 10, colour: MUTED });
    }
    for (const finding of room.findings) {
      const values: [string, string, string, string] = [
        inventoryItemTableLabel(finding, document),
        finding.findingText || "Not recorded",
        inventoryConditionLabel(document, finding),
        inventoryCheckoutComment(document, finding),
      ];
      const heights = values.map((value, index) =>
        estimatedTextHeight(value, index === 0 ? bold : regular, 8.5, (columns[index] ?? 0) - 10),
      );
      const rowHeight = Math.max(34, ...heights) + 10;
      if (writer.cursor.y - rowHeight < margin + 30) {
        newPage(writer);
        drawInventoryHeader(writer, room.label);
        drawInventoryTableHeader(writer, columns, labels);
      }
      const rowTop = writer.cursor.y;
      writer.cursor.page.drawRectangle({
        x: margin,
        y: rowTop - rowHeight,
        width: writer.contentWidth,
        height: rowHeight,
        borderColor: RULE,
        borderWidth: 0.5,
      });
      let x = margin;
      values.forEach((value, index) => {
        const columnWidth = columns[index] ?? 0;
        if (index > 0) {
          writer.cursor.page.drawLine({
            start: { x, y: rowTop },
            end: { x, y: rowTop - rowHeight },
            thickness: 0.5,
            color: RULE,
          });
        }
        drawCellText(
          writer.cursor.page,
          index === 0 ? bold : regular,
          value,
          x + 5,
          rowTop - 6,
          columnWidth - 10,
          8.5,
          index === 2 ? (TONE_COLOURS[resolveStatus(document.snapshot, finding.statusId).tone] ?? INK) : INK,
        );
        x += columnWidth;
      });
      writer.cursor.y -= rowHeight;
    }

    const group = photoGroups.rooms.find((entry) => entry.key === room.key);
    if (group) {
      const photoEntry = await drawInventoryPhotoPages(
        writer,
        document,
        group.entries,
        fetcher,
        `${room.label} - photographs`,
        "Photographs for this room, numbered to match the items above.",
      );
      if (photoEntry) indexEntries.push(photoEntry);
    }
  }

  const remainder = await drawInventoryPhotoPages(
    writer,
    document,
    photoGroups.unallocated,
    fetcher,
    "Photographs not in a room",
    "These photographs have not been allocated to a room.",
  );
  if (remainder) indexEntries.push(remainder);
  indexEntries.push(...(await drawInventoryHandoverPages(writer, document, fetcher)));
  indexEntries.push(...drawInventoryBackingPages(writer, document));
  if (indexEntries.length === 0) {
    indexEntries.push({ label: "No rooms have been recorded yet.", page: 2 });
  }
  drawInventoryIndexPage(writer, indexPage, indexEntries);

  drawFooters(writer);
  const bytes = await doc.save();
  return { bytes, filename: pdfFilename(document, options) };
}

export async function buildReportPdf(
  document: ReportDocument,
  options: BuildPdfOptions,
): Promise<BuiltPdf> {
  if (options.variant === "full" && isInventoryLayout(document)) {
    return buildInventoryReportPdf(document, options);
  }

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
    pageSize: A4,
    margin: MARGIN,
    contentWidth: CONTENT_WIDTH,
  };

  const findings = selectFindings(document, options);
  const fetcher: PhotoFetcher | null =
    options.includePhotos === false ? null : { spent: 0, cache: new Map() };

  doc.setTitle(sanitise(document.report.title));
  doc.setProducer("instructBrain");
  doc.setCreator("instructBrain");

  /* Cover */
  eyebrow(writer, document.organisation?.name ?? "instructBrain");
  drawText(writer, document.report.title, { size: 24, bold: true, lineGap: 6, gapAfter: 4, align: "center" });
  if (document.report.subtitle) {
    drawText(writer, document.report.subtitle, { size: 13, colour: MUTED, gapAfter: 6, align: "center" });
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
    drawText(writer, summary, { size: 10, gapAfter: 4, align: "justify" });
  }

  if (options.variant === "full" && document.report.scopeText) {
    drawRule(writer, 12, 10);
    eyebrow(writer, "Scope and limitations");
    drawText(writer, document.report.scopeText, { size: 10, align: "justify" });
  }
  if (options.variant === "full" && document.report.methodologyText) {
    drawRule(writer, 12, 10);
    eyebrow(writer, "Methodology");
    drawText(writer, document.report.methodologyText, { size: 10, align: "justify" });
  }

  /* Contents — only where the report covers more than one survey type. */
  const sections = sectionsFor(findings, document.surveyTypes ?? [], "Results");
  const sectioned = options.variant === "full" && sections.length > 1;

  if (sectioned) {
    drawRule(writer, 14, 10);
    eyebrow(writer, "Contents");
    for (const section of sections) {
      const refs = section.findings.map((finding: DocFinding) => finding.ref).filter(Boolean);
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
        drawText(writer, section.label, { size: 14, bold: true, gapAfter: 4, align: "center" });
      }
      const groups = groupResults({ ...document, findings: section.findings }, view);
      for (const group of groups) {
        ensure(writer, 60);
        drawText(writer, group.label, {
          size: 12,
          bold: true,
          colour: ACCENT,
          gapAfter: 2,
          align: "center",
        });
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

  /* Advisory note, when the report's brief asks for one */
  if (document.advisoryFooter) {
    drawRule(writer, 14, 10);
    eyebrow(writer, "Advisory");
    drawText(writer, document.advisoryFooter, { size: 9, colour: MUTED, align: "justify" });
  }

  drawFooters(writer);

  const bytes = await doc.save();
  return { bytes, filename: pdfFilename(document, options) };
}
