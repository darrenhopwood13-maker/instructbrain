/**
 * One page, one answer: the question the reader asked, the groups it compared, the same counts the
 * rail showed, and the sentence the rail concluded with - as a PDF they can send on.
 *
 * It exists because a chat answer is useful on screen and useless in an email. Everything is drawn
 * from the comparison object the rail already rendered, including its provenance, so the document
 * cannot claim a different figure or a different author from the answer it came from.
 */

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb, type RGB } from "pdf-lib";

import { REPORT_BRAND } from "@/lib/report/brand";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 46;
const BAND_H = 78;

const NAVY = rgb(...(REPORT_BRAND.navyRgb as unknown as [number, number, number]));
const ACCENT = rgb(...(REPORT_BRAND.accentRgb as unknown as [number, number, number]));
const INK = rgb(...(REPORT_BRAND.inkRgb as unknown as [number, number, number]));
const MUTED = rgb(...(REPORT_BRAND.mutedRgb as unknown as [number, number, number]));
const RULE = rgb(...(REPORT_BRAND.ruleRgb as unknown as [number, number, number]));
const PAPER = rgb(...(REPORT_BRAND.paperWhiteRgb as unknown as [number, number, number]));
const RED: RGB = rgb(0.72, 0.15, 0.15);

export type AnswerSheetGroup = {
  label: string;
  items: number;
  open: number;
  overdue: number;
  lateShare: number | null;
  medianDaysToClose: number | null;
};

export type AnswerSheet = {
  question: string;
  dimensionLabel: string;
  groups: AnswerSheetGroup[];
  verdict: string;
  caveat: string;
  /** "built-in matcher" or "model deepseek-flash" - stated, never implied. */
  source: string;
  /**
   * What the question was asked about, when that is narrower than the organisation - "Albert Dock
   * Liverpool" for a question asked at a pin. Left out for a whole-estate answer.
   */
  scopeLabel?: string;
  organisationName: string;
  generatedOn: string;
  /** Who ran it, so the sheet says who to ask about it. */
  generatedBy?: string;
  unmatched?: string[];
};

function clean(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u00b7\u2022]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

export async function renderAnswerPdf(sheet: AnswerSheet): Promise<{ bytes: Uint8Array; filename: string }> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER });

  // Band
  page.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: PAGE_W, height: BAND_H, color: NAVY });
  page.drawRectangle({ x: 0, y: PAGE_H - BAND_H - 3, width: PAGE_W, height: 3, color: ACCENT });
  page.drawText("instruct", { x: MARGIN, y: PAGE_H - 34, size: 15, font: bold, color: rgb(1, 1, 1) });
  const instructW = bold.widthOfTextAtSize("instruct", 15);
  page.drawText("Brain", { x: MARGIN + instructW + 1, y: PAGE_H - 34, size: 15, font: bold, color: ACCENT });
  page.drawText(clean("Answer sheet"), { x: MARGIN, y: PAGE_H - 58, size: 10, font: regular, color: rgb(0.86, 0.9, 0.97) });
  page.drawText(clean(`${sheet.organisationName} - ${sheet.generatedOn}`), {
    x: MARGIN,
    y: PAGE_H - 72,
    size: 8.5,
    font: regular,
    color: rgb(0.74, 0.8, 0.9),
  });

  let y = PAGE_H - BAND_H - 40;

  page.drawText("Question", { x: MARGIN, y, size: 8, font: bold, color: MUTED });
  y -= 16;
  for (const line of wrap(`"${sheet.question}"`, bold, 15, PAGE_W - MARGIN * 2)) {
    page.drawText(line, { x: MARGIN, y, size: 15, font: bold, color: NAVY });
    y -= 19;
  }
  y -= 4;
  const provenance = `${sheet.scopeLabel ? `${sheet.scopeLabel} - ` : ""}Compared by ${sheet.dimensionLabel.toLowerCase()} - answered by the ${sheet.source}`;
  page.drawText(clean(provenance), {
    x: MARGIN,
    y,
    size: 8.5,
    font: regular,
    color: MUTED,
  });
  y -= 22;

  // Bars, scaled against the largest group so the comparison reads at a glance.
  const peak = Math.max(1, ...sheet.groups.map((group) => group.items));
  const barW = PAGE_W - MARGIN * 2 - 130;

  for (const group of sheet.groups) {
    page.drawText(clean(group.label), { x: MARGIN, y, size: 11, font: bold, color: INK });
    const countLabel = `${group.items} ${group.items === 1 ? "item" : "items"}`;
    page.drawText(countLabel, {
      x: PAGE_W - MARGIN - regular.widthOfTextAtSize(countLabel, 8.5),
      y,
      size: 8.5,
      font: regular,
      color: MUTED,
    });
    y -= 12;

    const openW = (group.open / peak) * barW;
    const lateW = (group.overdue / peak) * barW;
    page.drawRectangle({ x: MARGIN, y: y - 9, width: Math.max(openW, 0.6), height: 8, color: NAVY });
    if (lateW > 0) {
      page.drawRectangle({ x: MARGIN, y: y - 9, width: Math.max(lateW, 0.6), height: 8, color: RED });
    }
    const detail = `${group.open} open, ${group.overdue} past their date${
      group.lateShare === null ? "" : ` (${group.lateShare}%)`
    }`;
    page.drawText(clean(detail), { x: MARGIN, y: y - 21, size: 8.5, font: regular, color: MUTED });
    y -= 38;
  }

  if (sheet.unmatched && sheet.unmatched.length > 0) {
    for (const line of wrap(`Could not place: ${sheet.unmatched.join(", ")}.`, regular, 8.5, PAGE_W - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 8.5, font: regular, color: MUTED });
      y -= 12;
    }
    y -= 6;
  }

  // Counts table
  const columns: Array<{ title: string; width: number; right?: boolean }> = [
    { title: sheet.dimensionLabel, width: 175 },
    { title: "Items", width: 55, right: true },
    { title: "Open", width: 55, right: true },
    { title: "Past date", width: 70, right: true },
    { title: "% late", width: 55, right: true },
    { title: "Days to close", width: 80, right: true },
  ];
  page.drawRectangle({ x: MARGIN, y: y - 4, width: PAGE_W - MARGIN * 2, height: 16, color: rgb(0.94, 0.96, 0.99) });
  let x = MARGIN;
  for (const column of columns) {
    const width = bold.widthOfTextAtSize(clean(column.title), 8);
    page.drawText(clean(column.title), {
      x: column.right ? x + column.width - width - 3 : x + 3,
      y,
      size: 8,
      font: bold,
      color: NAVY,
    });
    x += column.width;
  }
  y -= 16;

  for (const group of sheet.groups) {
    const cells = [
      group.label,
      String(group.items),
      String(group.open),
      String(group.overdue),
      group.lateShare === null ? "-" : `${group.lateShare}%`,
      group.medianDaysToClose === null ? "-" : `${group.medianDaysToClose}`,
    ];
    x = MARGIN;
    cells.forEach((cell, index) => {
      const column = columns[index];
      if (!column) return;
      const text = clean(cell);
      const size = 8.5;
      const width = regular.widthOfTextAtSize(text, size);
      page.drawText(text, {
        x: column.right ? x + column.width - width - 3 : x + 3,
        y,
        size,
        font: regular,
        color: index === 3 && group.overdue > 0 ? RED : INK,
      });
      x += column.width;
    });
    y -= 15;
  }
  y -= 14;

  // Verdict, then the limits of the answer.
  if (sheet.verdict) {
    page.drawText("What it says", { x: MARGIN, y, size: 8, font: bold, color: MUTED });
    y -= 15;
    for (const line of wrap(sheet.verdict, bold, 11, PAGE_W - MARGIN * 2)) {
      page.drawText(line, { x: MARGIN, y, size: 11, font: bold, color: INK });
      y -= 15;
    }
    y -= 8;
  }

  page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_W - MARGIN, y: y + 4 }, thickness: 0.6, color: RULE });
  y -= 10;
  for (const line of wrap(sheet.caveat, regular, 8, PAGE_W - MARGIN * 2)) {
    page.drawText(line, { x: MARGIN, y, size: 8, font: regular, color: MUTED });
    y -= 11;
  }

  // Footer
  page.drawLine({ start: { x: MARGIN, y: 46 }, end: { x: PAGE_W - MARGIN, y: 46 }, thickness: 0.5, color: RULE });
  page.drawText(clean(REPORT_BRAND.credit), { x: MARGIN, y: 34, size: 7, font: regular, color: MUTED });
  const stamp = clean(
    `${sheet.generatedBy ?? "your account"} - counted from the findings on this account on ${sheet.generatedOn}.`,
  );
  page.drawText(stamp, {
    x: PAGE_W - MARGIN - regular.widthOfTextAtSize(stamp, 7),
    y: 34,
    size: 7,
    font: regular,
    color: MUTED,
  });

  const bytes = await doc.save();
  const slug = sheet.question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return {
    bytes,
    filename: `instructbrain-answer-${slug || "question"}-${sheet.generatedOn}.pdf`,
  };
}
