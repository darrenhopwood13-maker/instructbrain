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
import {
  LineCapStyle,
  PDFDocument,
  StandardFonts,
  clip,
  drawObject,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  scale,
  translate,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { BRAND_CREDIT } from "@/lib/brand";
import { REPORT_BRAND } from "@/lib/report/brand";
import type { DocFinding, DocPhoto, DocRegion, ReportDocument } from "@/lib/report/document";
import {
  assignPins,
  photoHasImage,
  photoPlates,
  plateHeadline,
  platedPhotoIds,
  pinFor,
  type PhotoPlate,
  type Pin,
} from "@/lib/report/photo-pins";
import { formatCaptureDateTime, formatDocumentDate } from "@/lib/report/document";
import { defaultResultView, groupResults, safeResultView, type ResultView } from "@/lib/report/grouping";
import { itemLabel } from "@/lib/item-label";
import { recordCopyNotice } from "@/lib/i18n/record-copy";
import { sectionsFor, readableCaptureFields } from "@/lib/report/sections";
import { resolveLocation } from "@/lib/report/location";
import {
  inventoryCheckoutComment,
  inventoryConditionLabel,
  inventoryTitlePhotos,
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
import { isManualOnly, NOT_ASSESSED_ID, photoWorkflowOf, requiresConditionGrade, resolveSeverity, resolveStatus } from "@/lib/survey-types";
import {
  SCHEDULE_OF_CONDITION_HEADING,
  SCHEDULE_OF_CONDITION_LIMITATIONS_TEXT,
} from "@/lib/report/schedule-of-condition";
import { conditionGradeOf, conditionGradeSummary } from "@/lib/review/condition-grade";
import { MARKER_UNITS, STROKE_UNITS, TEXT_UNITS, type MarkupColour, type MarkupLayer } from "@/lib/photos/markup";

/** Kept exported from here for existing callers; the values live in brand.ts. */
export { MANUAL_REPORT_BRAND } from "@/lib/report/brand";

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

/* The document palette is stated once in brand.ts; these are the same values
   wrapped for pdf-lib, so a draw call receives the identical RGB triple. */
const INK = rgb(...REPORT_BRAND.inkRgb);
const MUTED = rgb(...REPORT_BRAND.mutedRgb);
const RULE = rgb(...REPORT_BRAND.ruleRgb);
const ACCENT = rgb(...REPORT_BRAND.accentRgb);
const BRAND_NAVY = rgb(...REPORT_BRAND.navyRgb);
const PAPER_WHITE = rgb(...REPORT_BRAND.paperWhiteRgb);
const MARKUP_COLOURS: Record<MarkupColour, ReturnType<typeof rgb>> = {
  accent: ACCENT,
  red: rgb(0.8, 0.08, 0.1),
  yellow: rgb(0.95, 0.68, 0.02),
  white: rgb(1, 1, 1),
  black: INK,
};

const TONE_COLOURS: Record<string, ReturnType<typeof rgb>> = {
  pass: rgb(0.11, 0.45, 0.25),
  fail: rgb(0.68, 0.11, 0.13),
  warn: rgb(0.65, 0.42, 0.03),
  flag: rgb(0.45, 0.2, 0.6),
  neutral: MUTED,
};

/** Photo bytes budget, so a photo-heavy report cannot exhaust worker memory. */
/**
 * Bounds for the photograph on a plate page. The height itself is whatever is
 * left once the words around it are measured — a fixed cap left roughly a third
 * of every plate page blank at the foot, which is the same waste this layout
 * exists to remove. The bounds stop a two-item photograph becoming a poster and a
 * small one disappearing.
 */
const MIN_PLATE_PHOTO_HEIGHT = 200;
const MAX_PLATE_PHOTO_HEIGHT = 480;
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
  /**
   * Measuring pass. While this is true nothing reaches the page and no page is
   * added, only the cursor moves, so an entry's real height can be known before
   * any of it is committed. See `measureHeight` and `drawFinding`.
   */
  dry: boolean;
};

function newPage(writer: Writer): void {
  const page = writer.doc.addPage([writer.pageSize.width, writer.pageSize.height]);
  writer.cursor = {
    page,
    y: writer.pageSize.height - writer.margin,
    pageNumber: writer.cursor.pageNumber + 1,
  };
}

/** Start a fresh page, unless this one has not been written on at all. */
function startFreshPage(writer: Writer): void {
  if (writer.dry) return;
  if (writer.cursor.y < writer.pageSize.height - writer.margin - 0.5) newPage(writer);
}

function ensure(writer: Writer, needed: number): void {
  // A measuring pass has to be able to run past the foot of the page: the whole
  // point of it is to learn how tall the entry is, not to fit it anywhere yet.
  if (writer.dry) return;
  if (writer.cursor.y - needed < writer.margin + 30) newPage(writer);
}

/** Space left on this page before `ensure` would break it. */
function roomOnPage(writer: Writer): number {
  return writer.cursor.y - (writer.margin + 30);
}

/** The same figure for a page that has just been started. */
function roomOnFreshPage(writer: Writer): number {
  return writer.pageSize.height - writer.margin - (writer.margin + 30);
}

/**
 * Whether an entry that needs `needed` points should start on a fresh page
 * rather than on this one.
 *
 * True only when a fresh page actually helps. An entry that fits where it is
 * stays where it is, and an entry longer than a whole page flows rather than
 * moving and then flowing anyway — which would only waste the rest of this page
 * and the whole of the next.
 */
export function shouldBreakBeforeEntry(needed: number, room: number, freshRoom: number): boolean {
  return needed > room && needed <= freshRoom;
}

/**
 * How tall a block really is, without drawing any of it.
 *
 * It runs the drawing code in a dry pass rather than a parallel estimate, so the
 * measurement cannot drift away from the thing being measured. Afterwards the
 * cursor is wound back: a measuring pass leaves no ink, no page and no moved
 * cursor behind it.
 */
async function measureHeight(writer: Writer, run: () => Promise<void> | void): Promise<number> {
  const startY = writer.cursor.y;
  const startPage = writer.cursor.page;
  const startPageNumber = writer.cursor.pageNumber;
  let endY = startY;
  writer.dry = true;
  try {
    await run();
    endY = writer.cursor.y;
  } finally {
    writer.dry = false;
    writer.cursor.y = startY;
    writer.cursor.page = startPage;
    writer.cursor.pageNumber = startPageNumber;
  }
  return startY - endY;
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
  if (writer.dry) {
    writer.cursor.y -= lines.length * lineHeight + (options.gapAfter ?? 0);
    return;
  }
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
  if (writer.dry) {
    writer.cursor.y -= gapBefore + gapAfter;
    return;
  }
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

/** One line placed by hand at a y offset, so a measuring pass can skip it. */
function drawSnippet(
  writer: Writer,
  text: string,
  options: Parameters<PDFPage["drawText"]>[1],
): void {
  if (writer.dry) return;
  writer.cursor.page.drawText(sanitise(text), options);
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

function drawMarkup(page: PDFPage, layers: MarkupLayer[], x: number, y: number, width: number, height: number, font: PDFFont): void {
  // Units match the on-screen overlay: 1/1000 of the image height.
  const u = height / 1000;
  const px = (nx: number) => x + nx * width;
  const py = (ny: number) => y + (1 - ny) * height;
  const dark = INK;
  const light = rgb(1, 1, 1);
  for (const layer of layers) {
    const colour = MARKUP_COLOURS[layer.colour];
    const backing = layer.colour === "white" || layer.colour === "yellow" || layer.colour === "accent" ? dark : light;
    const sw = Math.max(1, STROKE_UNITS[layer.stroke ?? "m"] * u);
    const x1 = px(layer.x), y1 = py(layer.y), x2 = px(layer.x2), y2 = py(layer.y2);
    const line = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      page.drawLine({ start: a, end: b, thickness: sw, color: colour, lineCap: LineCapStyle.Round });
    if (layer.kind === "arrow" || layer.kind === "line") {
      line({ x: x1, y: y1 }, { x: x2, y: y2 });
      if (layer.kind === "arrow") {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const head = sw * 3.2;
        for (const offset of [-0.45, 0.45]) line({ x: x2, y: y2 }, { x: x2 - head * Math.cos(angle + offset), y: y2 - head * Math.sin(angle + offset) });
      }
    } else if (layer.kind === "pen" && layer.points) {
      for (let i = 1; i < layer.points.length; i++) {
        const a = layer.points[i - 1]!, b = layer.points[i]!;
        line({ x: px(a[0]), y: py(a[1]) }, { x: px(b[0]), y: py(b[1]) });
      }
    } else if (layer.kind === "rectangle") {
      page.drawRectangle({ x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), borderWidth: sw, borderColor: colour });
    } else if (layer.kind === "ellipse") {
      page.drawEllipse({ x: (x1 + x2) / 2, y: (y1 + y2) / 2, xScale: Math.abs(x2 - x1) / 2, yScale: Math.abs(y2 - y1) / 2, borderWidth: sw, borderColor: colour });
    } else if (layer.kind === "marker") {
      const r = MARKER_UNITS[layer.size ?? "m"] * u;
      page.drawCircle({ x: x1, y: y1, size: r, color: colour, borderColor: light, borderWidth: r * 0.14 });
      const label = String(layer.number ?? 1);
      const fs = r * 1.15;
      page.drawText(label, { x: x1 - font.widthOfTextAtSize(label, fs) / 2, y: y1 - fs * 0.36, size: fs, font, color: backing });
    } else {
      const fs = TEXT_UNITS[layer.size ?? "m"] * u;
      const text = sanitise(layer.text ?? "").slice(0, 160);
      const pad = fs * 0.35;
      const w = Math.min(width, Math.max(fs * 2, font.widthOfTextAtSize(text, fs) + pad * 2));
      const h = fs * 1.4;
      const bx = Math.min(x1, x + width - w);
      const top = y1;
      const isSpeech = layer.kind === "speech";
      if (isSpeech) {
        page.drawSvgPath(`M ${bx + w * 0.18} ${-(top - h)} l ${-fs * 0.5} ${fs * 0.9} l ${fs * 1.2} ${-fs * 0.9} z`, { x: 0, y: 0, color: light, borderColor: colour, borderWidth: sw * 0.6 });
      }
      page.drawRectangle({ x: bx, y: top - h, width: w, height: h, color: isSpeech ? light : backing, opacity: isSpeech ? 0.97 : 0.82, ...(isSpeech ? { borderColor: colour, borderWidth: sw * 0.6 } : {}) });
      page.drawText(text, { x: bx + pad, y: top - h / 2 - fs * 0.35, size: fs, font, color: isSpeech ? dark : colour, maxWidth: w - pad });
    }
  }
}

/**
 * The area an item refers to, drawn on the photograph, with its pin number
 * where the photograph carries more than one marked item.
 *
 * On paper the pin's job is to be findable: the schedule says "Pin 2 of 6" and
 * the reader looks for the 2. A pin is drawn only where a region was actually
 * recorded, so the page never points confidently at a place nobody chose.
 * Colour: the accent, so a print says "the AI's own estimate", not "a person
 * drew this".
 */
function drawRegionMarks(
  page: PDFPage,
  marks: Array<{ region: DocRegion; number: number | null }>,
  x: number,
  y: number,
  width: number,
  height: number,
  font: PDFFont,
): void {
  for (const mark of marks) {
    const left = x + mark.region.x * width;
    const top = y + (1 - mark.region.y) * height;
    const boxWidth = mark.region.w * width;
    const boxHeight = mark.region.h * height;
    page.drawRectangle({
      x: left,
      y: top - boxHeight,
      width: boxWidth,
      height: boxHeight,
      borderWidth: Math.max(1, height * 0.008),
      borderColor: ACCENT,
    });
    if (mark.number === null) continue;
    const label = String(mark.number);
    const size = Math.max(7, height * 0.045);
    const radius = size * 0.75;
    const cx = left + boxWidth / 2;
    const cy = top - boxHeight / 2;
    page.drawCircle({ x: cx, y: cy, size: radius, color: ACCENT, borderColor: rgb(1, 1, 1), borderWidth: Math.max(0.5, radius * 0.12) });
    page.drawText(label, {
      x: cx - font.widthOfTextAtSize(label, size) / 2,
      y: cy - size * 0.36,
      size,
      font,
      color: INK,
    });
  }
}

/** How many marks a photograph carries, for the caption. */
function markCaption(marks: Array<{ number: number | null }>): string {
  const numbered = marks.filter((mark) => mark.number !== null).length;
  if (numbered === 0) return "the marked area indicates the item";
  return numbered === 1 ? "one pin on this photograph" : `${numbered} pins on this photograph`;
}

/**
 * Where a patch lands inside the crop frame. Kept as its own function because
 * the arithmetic carries the two things that are easy to get wrong — the sign
 * of the vertical shift (region coordinates run from the top, the PDF's origin
 * is the bottom left) and the use of ONE uniform scale, so a patch is never
 * stretched to fill the frame.
 */
export function cropPlacement(
  image: { width: number; height: number },
  region: DocRegion,
  frameWidth: number,
  frameHeight: number,
): {
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
  originX: number;
  originTop: number;
  patchWidth: number;
  patchHeight: number;
} {
  const patchWidth = Math.max(region.w, 0.02) * image.width;
  const patchHeight = Math.max(region.h, 0.02) * image.height;
  const factor = Math.min(frameWidth / patchWidth, frameHeight / patchHeight);
  const drawWidth = image.width * factor;
  const drawHeight = image.height * factor;
  const originX = (frameWidth - patchWidth * factor) / 2;
  const originTop = (frameHeight - patchHeight * factor) / 2;
  return {
    drawX: originX - region.x * drawWidth,
    drawY: frameHeight - originTop - patchHeight * factor - (1 - region.y - region.h) * drawHeight,
    drawWidth,
    drawHeight,
    originX,
    originTop,
    patchWidth,
    patchHeight,
  };
}

/**
 * A tight crop of one patch of a photograph, drawn into a frame on the page.
 *
 * What this buys, measured on a 1200x900 photograph through a 10-item report:
 * one page saved at six items on a photograph, one at eight, one at ten — and
 * nothing at all at two, three or four, where the plate plus the crops costs the
 * same paper as printing the frame again. So this is NOT the "page per
 * multi-item photograph" the plan hoped for; the page saving arrives only once a
 * photograph carries a lot of items. The reader benefit is the bigger one: the
 * schedule entry shows the patch, not a wide site photo where the defect is 3%
 * of the frame.
 *
 * pdf-lib has no clipping option on drawImage, so this emits the operators
 * itself — clip to the frame, then draw the whole image translated and scaled so
 * the patch lands inside it. The image is never distorted: one uniform scale,
 * and the patch is centred inside the frame.
 */
function drawImageCrop(
  page: PDFPage,
  image: PDFImage,
  region: DocRegion,
  x: number,
  top: number,
  frameWidth: number,
  frameHeight: number,
  dry = false,
): void {
  // Draws only, and the caller owns the cursor, so a measuring pass skips it.
  if (dry) return;
  const place = cropPlacement(image, region, frameWidth, frameHeight);
  const frameBottom = top - frameHeight;
  const key = page.node.newXObject("Image", image.ref);
  page.pushOperators(
    pushGraphicsState(),
    translate(x, frameBottom),
    rectangle(0, 0, frameWidth, frameHeight),
    clip(),
    endPath(),
    translate(place.drawX, place.drawY),
    scale(place.drawWidth, place.drawHeight),
    drawObject(key),
    popGraphicsState(),
  );
  page.drawRectangle({
    x,
    y: frameBottom,
    width: frameWidth,
    height: frameHeight,
    borderWidth: 0.75,
    borderColor: MUTED,
  });
}

function drawImage(
  writer: Writer,
  image: PDFImage,
  maxWidth: number,
  maxHeight: number,
  layers: MarkupLayer[] = [],
  marks: Array<{ region: DocRegion; number: number | null }> = [],
): void {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  if (writer.dry) {
    writer.cursor.y -= height + 8;
    return;
  }
  ensure(writer, height + 8);
  writer.cursor.page.drawImage(image, {
    x: writer.margin,
    y: writer.cursor.y - height,
    width,
    height,
  });
  drawMarkup(writer.cursor.page, layers, writer.margin, writer.cursor.y - height, width, height, writer.bold);
  drawRegionMarks(
    writer.cursor.page,
    marks,
    writer.margin,
    writer.cursor.y - height,
    width,
    height,
    writer.bold,
  );
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
    // Subtle brand touch: a thin Laser Green rule across the top of every page.
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

function drawManualBrandHeader(writer: Writer, organisationName: string | null): void {
  const page = writer.cursor.page;
  const bandHeight = 42;
  const bandY = writer.pageSize.height - writer.margin - bandHeight;
  page.drawRectangle({
    x: writer.margin,
    y: bandY,
    width: writer.contentWidth,
    height: bandHeight,
    color: BRAND_NAVY,
  });
  page.drawRectangle({
    x: writer.margin,
    y: bandY,
    width: 5,
    height: bandHeight,
    color: ACCENT,
  });
  const instruct = "instruct";
  const brain = "Brain";
  const wordmarkSize = 16;
  const wordmarkX = writer.margin + 18;
  page.drawText(instruct, {
    x: wordmarkX,
    y: bandY + 14,
    size: wordmarkSize,
    font: writer.bold,
    color: PAPER_WHITE,
  });
  page.drawText(brain, {
    x: wordmarkX + writer.bold.widthOfTextAtSize(instruct, wordmarkSize),
    y: bandY + 14,
    size: wordmarkSize,
    font: writer.bold,
    color: ACCENT,
  });
  if (organisationName) {
    const safeName = sanitise(organisationName).slice(0, 58);
    page.drawText(safeName, {
      x: writer.pageSize.width - writer.margin - 18 - writer.regular.widthOfTextAtSize(safeName, 8),
      y: bandY + 17,
      size: 8,
      font: writer.regular,
      color: PAPER_WHITE,
      opacity: 0.86,
    });
  }
  writer.cursor.y = bandY - 30;
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

async function drawFinding(
  writer: Writer,
  document: ReportDocument,
  finding: DocFinding,
  fetcher: PhotoFetcher | null,
  pins: Map<string, Pin>,
  plated: Set<string>,
  platesPrinted: Set<string>,
): Promise<void> {
  // An entry sliced across a page boundary is the thing that makes a generated
  // document look careless: a sentence stopping at the foot of one page and
  // resuming at the top of the next reads as a machine, not a surveyor. So the
  // entry is measured first, and if it would fit on a page of its own but not in
  // what is left of this one, the page breaks BEFORE it rather than through it.
  //
  // An entry longer than a page on its own still flows across pages, because the
  // only alternative is losing text.
  const needed = await measureHeight(writer, () =>
    drawFindingBody(writer, document, finding, fetcher, pins, plated, platesPrinted),
  );
  if (shouldBreakBeforeEntry(needed, roomOnPage(writer), roomOnFreshPage(writer))) newPage(writer);
  await drawFindingBody(writer, document, finding, fetcher, pins, plated, platesPrinted);
}

async function drawFindingBody(
  writer: Writer,
  document: ReportDocument,
  finding: DocFinding,
  fetcher: PhotoFetcher | null,
  pins: Map<string, Pin>,
  plated: Set<string>,
  platesPrinted: Set<string>,
): Promise<void> {
  const status = resolveStatus(document.snapshot, finding.statusId);
  const severity = resolveSeverity(document.snapshot, finding.severityId);
  const notAssessed = status.id === NOT_ASSESSED_ID;

  ensure(writer, 90);
  drawRule(writer, 10, 8);

  const location = resolveLocation(finding.captureFields);
  drawText(writer, `${itemLabel(finding.ref)}${location ? ` — ${location}` : ""}`, {
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

  // The condition grade, as a labelled line, and only when a person has
  // confirmed one — an ungraded item is never given a grade it does not have.
  const grade = conditionGradeOf(finding.conditionGrade);
  if (grade) {
    drawText(writer, `Condition grade: ${grade.code} — ${grade.label}. ${grade.meaning}`, {
      size: 9,
      bold: true,
      colour: MUTED,
      gapAfter: 4,
    });
  }

  if (finding.snagTitle) drawText(writer, finding.snagTitle, { size: 11, bold: true, gapAfter: 2 });
  if (finding.findingText) drawText(writer, finding.findingText, { size: 10, gapAfter: 4, align: "justify" });
  if (finding.remedialText) {
    drawText(writer, "Required action", { size: 8, bold: true, colour: MUTED });
    drawText(writer, finding.remedialText, { size: 10, gapAfter: 4, align: "justify" });
  }
  if (finding.rectificationAlt) {
    drawText(writer, "Alternative", { size: 8, bold: true, colour: MUTED });
    drawText(writer, finding.rectificationAlt, { size: 10, gapAfter: 4, align: "justify" });
  }
  if (finding.tradesmanHack) {
    drawText(writer, "Trade tip", { size: 8, bold: true, colour: MUTED });
    drawText(writer, finding.tradesmanHack, { size: 10, gapAfter: 4, align: "justify" });
  }
  if (finding.hsNotes) {
    drawText(writer, "Health and safety", { size: 8, bold: true, colour: MUTED });
    drawText(writer, finding.hsNotes, { size: 10, gapAfter: 4, align: "justify" });
  }
  if (finding.likelyCause) {
    drawText(writer, `Likely cause: ${finding.likelyCause}`, { size: 9, colour: MUTED });
  }
  if (finding.regulatoryReference) {
    drawText(writer, `Reference: ${finding.regulatoryReference}`, { size: 9, colour: MUTED });
  }

  const extras = readableCaptureFields(finding.captureFields, document.surveyTypes ?? []);
  if (extras.length > 0) {
    drawText(
      writer,
      extras.map((field) => `${field.label}: ${field.value}`).join("   ·   "),
      { size: 9, colour: MUTED },
    );
  }

  if (fetcher) {
    for (const attached of finding.photos.slice(0, 3)) {
      const image = await embedPhoto(writer, fetcher, attached.photo);
      if (!image) continue;
      const shared = plated.has(attached.photo.id);
      if (!shared) {
        // A photograph carrying one item: full width beside that item, with the
        // area it refers to drawn on it. No pin — there is nothing to tell apart.
        drawImage(
          writer,
          image,
          writer.contentWidth * 0.62,
          260,
          attached.photo.layers,
          attached.region ? [{ region: attached.region, number: null }] : [],
        );
        continue;
      }
      // The photograph is printed once, above the schedule, carrying every pin.
      // Here the item prints a tight crop of its own patch instead of another
      // full-width copy of the same frame — this is what takes the pages out.
      const pin = pinFor(pins, attached.photo.id, finding.id);
      if (!attached.region) {
        // "Printed above" is only true if it is. A photograph whose bytes would
        // not come back leaves no plate to point at, and saying otherwise is the
        // same empty promise this work exists to remove.
        drawText(
          writer,
          platesPrinted.has(attached.photo.id)
            ? `Photograph ${attached.photo.sequence} is printed on its own page with its pins. No area was recorded for this item.`
            : `Photograph ${attached.photo.sequence} could not be read, so it is not printed and there is no pin for this item.`,
          { size: 8, colour: MUTED, gapAfter: 6 },
        );
        continue;
      }
      const frameWidth = writer.contentWidth * 0.4;
      const frameHeight = 132;
      ensure(writer, frameHeight + 16);
      const top = writer.cursor.y;
      drawImageCrop(
        writer.cursor.page,
        image,
        attached.region,
        writer.margin,
        top,
        frameWidth,
        frameHeight,
        writer.dry,
      );
      const caption = pin
        ? `Pin ${pin.number} of ${pin.total} - photograph ${attached.photo.sequence}`
        : `Photograph ${attached.photo.sequence} - the marked area`;
      drawSnippet(writer, caption, {
        x: writer.margin + frameWidth + 10,
        y: top - 14,
        size: 9,
        font: writer.bold,
        color: ACCENT,
        maxWidth: writer.contentWidth - frameWidth - 10,
      });
      drawSnippet(writer, "A crop of the area this item refers to.", {
        x: writer.margin + frameWidth + 10,
        y: top - 26,
        size: 8,
        font: writer.regular,
        color: MUTED,
        maxWidth: writer.contentWidth - frameWidth - 10,
      });
      writer.cursor.y = top - frameHeight - 8;
    }
  }
}

/**
 * One photograph that carries more than one item, drawn ONCE with all its pins,
 * immediately above the first entry that refers to it.
 *
 * Placed, not collected. It used to be drawn up front in a single block with
 * every other plate, which on the 58-item report put TEN PAGES of photographs
 * before the first finding: reviewing it meant flipping between a picture at the
 * front and the item it belongs to at the back. A picture belongs beside the
 * entries that use it, so it is drawn at the moment the first of them is about
 * to be.
 *
 * ⭐ A photograph carrying several items takes a PAGE OF ITS OWN, with the items
 * listed underneath by pin. Dal asked for this on 8 October 2026 and it is better
 * than either alternative considered before it: the photograph fills the width it
 * was wasting (it used 45% of it), and the page becomes self-contained, so the
 * picture and the entries that belong to it are read together with no flipping.
 * Packing two photographs side by side would have halved the sheets but dragged
 * the pictures back into a block above their items, which was the original
 * complaint.
 *
 * Returns whether anything was drawn, so the caller only prints the explaining
 * paragraph once, and only when there is a picture to explain.
 */
async function drawPhotoPlate(
  writer: Writer,
  document: ReportDocument,
  plate: PhotoPlate,
  showIntro: boolean,
  fetcher: PhotoFetcher | null,
): Promise<boolean> {
  if (!fetcher) return false;

  const photo = document.findings
    .flatMap((finding) => finding.photos)
    .map((attached) => attached.photo)
    .find((candidate) => candidate.id === plate.photoId);
  if (!photo) return false;

  const image = await embedPhoto(writer, fetcher, photo);
  // Skipped entirely when the bytes will not come back, so a broken bucket cannot
  // print a heading and an intro paragraph promising pictures that follow.
  if (!image) return false;

  const marks = plate.marks
    .filter((mark): mark is typeof mark & { region: DocRegion } => mark.region !== null)
    .map((mark) => ({ region: mark.region, number: mark.number }));

  // The photograph owns the page, so the page starts fresh — unless this one is
  // already untouched, which would only put a blank sheet in front of it.
  startFreshPage(writer);
  await drawPhotoPlateBody(writer, document, photo, plate, image, marks, showIntro);
  return true;
}

async function drawPhotoPlateBody(
  writer: Writer,
  document: ReportDocument,
  photo: DocPhoto,
  plate: PhotoPlate,
  image: PDFImage,
  marks: Array<{ region: DocRegion; number: number | null }>,
  showIntro: boolean,
): Promise<void> {
  // Measure the words first — both the heading above the photograph and the index
  // below it — so the photograph can take exactly the room that is left instead
  // of a guessed height that leaves a blank band at the foot of the sheet.
  const room = roomOnPage(writer);
  const leadHeight = await measureHeight(writer, () => drawPlateLead(writer, showIntro));
  const tailHeight = await measureHeight(writer, () => drawPlateTail(writer, document, photo, plate));
  const photoHeight = Math.max(
    MIN_PLATE_PHOTO_HEIGHT,
    Math.min(room - leadHeight - tailHeight - 12, MAX_PLATE_PHOTO_HEIGHT),
  );

  drawPlateLead(writer, showIntro);
  drawImage(writer, image, writer.contentWidth, photoHeight, photo.layers, marks);
  drawPlateTail(writer, document, photo, plate);
}

/** Everything on a plate page above the photograph. */
function drawPlateLead(writer: Writer, showIntro: boolean): void {
  if (!showIntro) return;
  drawRule(writer, 14, 8);
  eyebrow(writer, "Photographs carrying several items");
  drawText(
    writer,
    "Each of these takes a page of its own: a numbered pin on the photograph for every item found on it, and those items listed underneath in pin order. An item's entry in the schedule points back at its pin.",
    { size: 9, colour: MUTED, gapAfter: 6, align: "justify" },
  );
}

/** Everything on a plate page below the photograph: its caption and the index. */
function drawPlateTail(
  writer: Writer,
  document: ReportDocument,
  photo: DocPhoto,
  plate: PhotoPlate,
): void {
  drawText(
    writer,
    `Photograph ${photo.sequence} - ${plate.items} items on this photograph, ${markCaption(
      plate.marks
        .filter((mark): mark is typeof mark & { region: DocRegion } => mark.region !== null)
        .map((mark) => ({ region: mark.region, number: mark.number })),
    )}`,
    { size: 8, colour: MUTED, gapAfter: 8 },
  );
  drawPlateFindings(writer, document, plate);
}

/** The items on a plate, in pin order, listed under the photograph. */
function drawPlateFindings(writer: Writer, document: ReportDocument, plate: PhotoPlate): void {
  const listed = plate.marks
    .filter((mark) => mark.number !== null)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  if (listed.length === 0) return;
  drawText(writer, "Findings on this photograph", {
    size: 8,
    bold: true,
    colour: MUTED,
    gapAfter: 2,
  });
  for (const mark of listed) {
    const finding = document.findings.find((candidate) => candidate.id === mark.findingId);
    const headline = finding ? plateHeadline(finding) : "";
    drawText(writer, `Pin ${mark.number} - ${itemLabel(mark.ref)}${headline ? ` - ${headline}` : ""}`, {
      size: 9,
      gapAfter: 2,
    });
  }
}

async function drawManualPhotoPages(
  writer: Writer,
  findings: DocFinding[],
  fetcher: PhotoFetcher | null,
): Promise<void> {
  const usableHeight = writer.pageSize.height - writer.margin * 2 - 26;
  const gap = 18;
  const slotHeight = (usableHeight - gap) / 2;

  for (let index = 0; index < findings.length; index += 1) {
    if (index % 2 === 0) newPage(writer);
    const slot = index % 2;
    const top = writer.pageSize.height - writer.margin - slot * (slotHeight + gap);
    const finding = findings[index];
    if (!finding) continue;
    const attachment = finding.photos[0];
    const captured = formatCaptureDateTime(attachment?.photo.capturedAt ?? null);

    writer.cursor.page.drawRectangle({
      x: writer.margin,
      y: top - 14,
      width: 3,
      height: 14,
      color: ACCENT,
    });

    writer.cursor.page.drawText(sanitise(itemLabel(finding.ref)), {
      x: writer.margin + 10,
      y: top - 12,
      size: 11,
      font: writer.bold,
      color: INK,
    });
    const metadata = `Date: ${captured.date}   Time: ${captured.time}`;
    writer.cursor.page.drawText(sanitise(metadata), {
      x: writer.pageSize.width - writer.margin - writer.regular.widthOfTextAtSize(metadata, 9),
      y: top - 11,
      size: 9,
      font: writer.regular,
      color: MUTED,
    });

    const imageTop = top - 25;
    const imageHeight = slotHeight - 34;
    if (attachment && fetcher) {
      const image = await embedPhoto(writer, fetcher, attachment.photo);
      if (image) {
        const scale = Math.min(writer.contentWidth / image.width, imageHeight / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const x = writer.margin + (writer.contentWidth - width) / 2;
        const y = imageTop - height;
        writer.cursor.page.drawImage(image, { x, y, width, height });
        drawMarkup(writer.cursor.page, attachment.photo.layers ?? [], x, y, width, height, writer.bold);
      }
    }

    if (slot === 0 && index + 1 < findings.length) {
      const ruleY = top - slotHeight - gap / 2;
      writer.cursor.page.drawLine({
        start: { x: writer.margin, y: ruleY },
        end: { x: writer.pageSize.width - writer.margin, y: ruleY },
        thickness: 0.6,
        color: RULE,
      });
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

/** A filename-safe token. Empty in, empty out, so a missing field is skipped
 * rather than named. `safeName` is this with a floor under it. */
function slug(value: string | null | undefined): string {
  return sanitise(value ?? "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function safeName(value: string): string {
  return slug(value) || "report";
}

/**
 * The filename is the only part of a report a person meets OUTSIDE the
 * document — in a downloads folder, an attachment list, a shared drive. Naming
 * it after the reference alone produced `001.pdf` for a report referenced
 * `001`: a file that identifies nothing and cannot be told apart from the next
 * one. Name it after what the report IS, then which one it is, then when —
 * each token skipped when it is missing, and never printed twice (a title that
 * already carries its own reference or date, which survey types often do).
 */
export function reportFilenameBase(document: ReportDocument): string {
  const { title, reference, reportDate, issuedAt } = document.report;
  const tokens: string[] = [];
  for (const value of [title, reference, (reportDate || issuedAt || "").slice(0, 10)]) {
    const token = slug(value);
    if (!token) continue;
    const lower = token.toLowerCase();
    if (tokens.some((seen) => seen.toLowerCase().includes(lower))) continue;
    tokens.push(token);
  }
  return tokens.join("-") || "report";
}

export function pdfFilename(document: ReportDocument, options: BuildPdfOptions): string {
  const base = reportFilenameBase(document);
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
    dry: false,
  };
  const fetcher: PhotoFetcher | null =
    options.includePhotos === false ? null : { spent: 0, cache: new Map() };

  doc.setTitle(sanitise(document.report.title));
  doc.setProducer("instructBrain");
  doc.setCreator("instructBrain");

  const titlePhotos = inventoryTitlePhotos(document);
  const coverPage = writer.cursor.page;
  drawManualBrandHeader(writer, null);
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
  if (titlePhotos.length > 0 && fetcher) {
    const available = (
      await Promise.all(titlePhotos.map(async (photo) => ({ photo, image: await embedPhoto(writer, fetcher, photo) })))
    ).filter((entry): entry is { photo: DocPhoto; image: PDFImage } => entry.image !== null);
    const gap = 10;
    const width = Math.min(214, (writer.contentWidth - gap * Math.max(0, available.length - 1)) / Math.max(1, available.length));
    const totalWidth = width * available.length + gap * Math.max(0, available.length - 1);
    const startX = (LANDSCAPE_LETTER.width - totalWidth) / 2;
    available.forEach((entry, index) => {
      drawImageAt(coverPage, entry.image, startX + index * (width + gap), 135, width, 100);
    });
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
    dry: false,
  };

  const findings = selectFindings(document, options);
  // Pins are numbered from the items this document actually prints, so a trade
  // extract's "Pin 2 of 3" refers to what the subbie can see. For the full
  // report this is every item, which is what the screen numbers too.
  //
  // A pin points at a place on a picture, so a photograph whose bytes cannot be
  // fetched carries no numbers here either — the screen and the PDF make the
  // same promise, which is the point of reading one assembled document.
  const photoById = new Map<string, DocPhoto>();
  for (const finding of document.findings) {
    for (const attached of finding.photos) photoById.set(attached.photo.id, attached.photo);
  }
  const pinItems = findings.flatMap((finding) =>
    finding.photos.map((attached) => ({
      findingId: finding.id,
      ref: finding.ref,
      photoId: attached.photo.id,
      region: attached.region,
    })),
  );
  const pins = assignPins(
    pinItems.filter((item) => {
      const photo = photoById.get(item.photoId);
      return !!photo && photoHasImage(photo);
    }),
  );
  const plates = photoPlates(pinItems, pins);
  const plated = platedPhotoIds(plates);
  const manualFull = options.variant === "full" && isManualOnly(document.snapshot);
  // A condition survey is presented as a Schedule of Condition, with its
  // mandatory scope-and-limitations block printed on the artifact.
  const scheduleCondition =
    options.variant === "full" && requiresConditionGrade(document.snapshot);
  const fetcher: PhotoFetcher | null =
    options.includePhotos === false ? null : { spent: 0, cache: new Map() };

  doc.setTitle(sanitise(document.report.title));
  doc.setProducer("instructBrain");
  doc.setCreator("instructBrain");

  /* Cover */
  drawManualBrandHeader(writer, document.organisation?.name ?? null);
  drawText(writer, document.report.title, {
    size: manualFull ? 26 : 24,
    bold: true,
    lineGap: 6,
    gapAfter: manualFull ? 6 : 4,
    align: "center",
  });
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
        ? `Published as version ${document.report.currentVersion}${
            document.report.issuedAt ? ` on ${formatDocumentDate(document.report.issuedAt)}` : ""
          }`
        : "Draft — not yet published",
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

  if (manualFull) {
    const coverUrl = document.project?.coverUrl ?? null;
    const cover = coverUrl ? { id: "project-cover", url: coverUrl, thumbUrl: null } : null;
    if (cover && fetcher) {
      const image = await embedPhoto(writer, fetcher, cover);
      if (image) {
        const availableHeight = Math.max(110, writer.cursor.y - writer.margin - 18);
        const scale = Math.min(writer.contentWidth / image.width, availableHeight / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const x = writer.margin + (writer.contentWidth - width) / 2;
        const y = writer.cursor.y - 10 - height;
        writer.cursor.page.drawImage(image, { x, y, width, height });
      }
    }
    await drawManualPhotoPages(writer, findings, fetcher);
    drawFooters(writer);
    const bytes = await doc.save();
    return { bytes, filename: pdfFilename(document, options) };
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

  /* Results — presented as a Schedule of Condition where the survey grades. */
  if (scheduleCondition) {
    drawRule(writer, 14, 10);
    eyebrow(writer, SCHEDULE_OF_CONDITION_HEADING);
    drawText(writer, "Scope and limitations", { size: 9, bold: true, colour: MUTED, gapAfter: 2 });
    drawText(writer, SCHEDULE_OF_CONDITION_LIMITATIONS_TEXT, {
      size: 9,
      colour: MUTED,
      gapAfter: 4,
      align: "justify",
    });
  } else {
    drawRule(writer, 14, 10);
    eyebrow(writer, options.variant === "item" ? "Item" : "Results");
  }

  // The photographs that carry more than one item are drawn the moment the first
  // entry referring to them is about to be drawn — immediately above it, rather
  // than in a block at the front of the report. `plated` is still what tells an
  // entry to print a crop instead of another copy of the whole frame.
  const plateById = new Map(plates.map((plate) => [plate.photoId, plate]));
  // Attempted, so a plate that cannot be fetched is not retried for every item on
  // it; and printed, because that is the only thing an item is allowed to promise
  // when it says "printed above with its pins".
  const plateAttempted = new Set<string>();
  const platesPrinted = new Set<string>();
  let plateIntroShown = false;
  const drawPlatesFor = async (finding: DocFinding): Promise<void> => {
    for (const attached of finding.photos) {
      const plate = plateById.get(attached.photo.id);
      if (!plate || plateAttempted.has(plate.photoId)) continue;
      plateAttempted.add(plate.photoId);
      if (await drawPhotoPlate(writer, document, plate, !plateIntroShown, fetcher)) {
        platesPrinted.add(plate.photoId);
        plateIntroShown = true;
      }
    }
  };

  if (findings.length === 0) {
    drawText(writer, "There are no items in this selection.", { size: 10, colour: MUTED });
  } else if (options.variant === "full") {
    const view = safeResultView(
      options.view,
      defaultResultView(document.snapshot, document.tradeEnabled ?? true),
    );
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
          await drawPlatesFor(finding);
          await drawFinding(writer, document, finding, fetcher, pins, plated, platesPrinted);
        }
        writer.cursor.y -= 6;
      }
    }
  } else {
    for (const finding of findings) {
      await drawPlatesFor(finding);
      await drawFinding(writer, document, finding, fetcher, pins, plated, platesPrinted);
    }
  }

  /* The closing count: how many elements fall in each grade. */
  if (scheduleCondition) {
    const summary = conditionGradeSummary(
      findings.map((finding: DocFinding) => ({
        id: finding.id,
        ref: finding.ref,
        conditionGrade: finding.conditionGrade,
        aiSuggestedGrade: finding.suggestedGrade,
        aiGradeConfidence: finding.gradeConfidence,
      })),
    );
    ensure(writer, 60);
    drawRule(writer, 14, 10);
    eyebrow(writer, "Items by grade");
    drawText(
      writer,
      summary.byGrade.map((grade) => `${grade.code} — ${grade.label}: ${grade.count}`).join("   ·   "),
      { size: 10, gapAfter: 2 },
    );
    drawText(
      writer,
      `${summary.graded} graded` +
        (summary.ungraded > 0
          ? ` · ${summary.ungraded} still to be confirmed by a person`
          : " · every element has a confirmed grade") +
        ".",
      { size: 9, colour: MUTED },
    );
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
