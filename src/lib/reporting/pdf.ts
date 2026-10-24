/**
 * The portfolio report as a PDF.
 *
 * Runs in the browser, where pdf-lib already lives, so the document is built from the same model
 * the preview on screen used - one calculation, one set of numbers, no server round trip that could
 * return something the reader did not just see.
 *
 * Brand follows AGENTS.md: fixed instructBrain navy, white and Laser Green on issued output, with
 * the credit at the foot rather than a banner across the top. The accent is read from
 * REPORT_BRAND so this renderer never restates the colour.
 */

import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb, type RGB } from "pdf-lib";

import { REPORT_BRAND } from "@/lib/report/brand";
import type { PortfolioReport } from "@/lib/reporting/aggregate";

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
const DEEP_GREEN: RGB = rgb(0.18, 0.54, 0);

/**
 * Standard PDF fonts are WinAnsi only: a middle dot, a curly apostrophe or an en dash makes
 * pdf-lib throw rather than draw a fallback glyph, which used to take the whole download with it.
 * Everything is folded to ASCII here, at the last moment, so upstream text stays as written.
 */
function clean(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u00b7\u2022]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E]/g, "");
}

export type ReportPdfContext = {
  organisationName: string;
  generatedBy: string;
};

type Writer = {
  doc: PDFDocument;
  page: PDFPage;
  bold: PDFFont;
  regular: PDFFont;
  y: number;
  pageIndex: number;
};

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function drawBand(writer: Writer, title: string, subtitle: string): void {
  const { page, bold, regular } = writer;
  page.drawRectangle({ x: 0, y: PAGE_H - BAND_H, width: PAGE_W, height: BAND_H, color: NAVY });
  page.drawRectangle({ x: 0, y: PAGE_H - BAND_H - 3, width: PAGE_W, height: 3, color: ACCENT });
  page.drawText("instruct", {
    x: MARGIN,
    y: PAGE_H - 34,
    size: 15,
    font: bold,
    color: rgb(1, 1, 1),
  });
  const instructWidth = bold.widthOfTextAtSize("instruct", 15);
  page.drawText("Brain", { x: MARGIN + instructWidth + 1, y: PAGE_H - 34, size: 15, font: bold, color: ACCENT });
  page.drawText(clean(title), { x: MARGIN, y: PAGE_H - 58, size: 10, font: regular, color: rgb(0.86, 0.9, 0.97) });
  page.drawText(clean(subtitle), {
    x: MARGIN,
    y: PAGE_H - 72,
    size: 8.5,
    font: regular,
    color: rgb(0.74, 0.8, 0.9),
  });
  writer.y = PAGE_H - BAND_H - 34;
}

function drawFooter(writer: Writer): void {
  const { page, regular, pageIndex } = writer;
  page.drawLine({
    start: { x: MARGIN, y: 46 },
    end: { x: PAGE_W - MARGIN, y: 46 },
    thickness: 0.5,
    color: RULE,
  });
  page.drawText(clean(REPORT_BRAND.credit), { x: MARGIN, y: 34, size: 7, font: regular, color: MUTED });
  const label = `${pageIndex}`;
  page.drawText(label, {
    x: PAGE_W - MARGIN - regular.widthOfTextAtSize(label, 8),
    y: 34,
    size: 8,
    font: regular,
    color: MUTED,
  });
}

/** Adds a page with the band, and closes the footer of the page it leaves behind. */
function newPage(writer: Writer, title: string, subtitle: string): void {
  drawFooter(writer);
  writer.page = writer.doc.addPage([PAGE_W, PAGE_H]);
  writer.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER });
  writer.pageIndex += 1;
  drawBand(writer, title, subtitle);
}

function ensureRoom(writer: Writer, needed: number, title: string, subtitle: string): void {
  if (writer.y - needed < 70) newPage(writer, title, subtitle);
}

function heading(writer: Writer, text: string, subtitle: string): void {
  ensureRoom(writer, 46, text, subtitle);
  writer.page.drawText(clean(text.toUpperCase()), {
    x: MARGIN,
    y: writer.y,
    size: 9,
    font: writer.bold,
    color: NAVY,
  });
  writer.page.drawRectangle({
    x: MARGIN,
    y: writer.y + 5,
    width: 26,
    height: 2,
    color: ACCENT,
  });
  writer.y -= 20;
}

function paragraph(writer: Writer, text: string, size = 9, colour = INK, indent = 0): void {
  const width = PAGE_W - MARGIN * 2 - indent;
  for (const line of wrap(text, writer.regular, size, width)) {
    ensureRoom(writer, 14, "Notes", "how to read these figures");
    writer.page.drawText(line, {
      x: MARGIN + indent,
      y: writer.y,
      size,
      font: writer.regular,
      color: colour,
    });
    writer.y -= size + 4;
  }
}

/** A tile per headline figure: label above, value in navy below. */
function headlineTiles(writer: Writer, report: PortfolioReport): void {
  const figures: Array<{ label: string; value: string }> = [
    { label: "Raised in period", value: String(report.headline.raised) },
    { label: "Signed off in period", value: String(report.headline.closed) },
    { label: "Open today", value: String(report.headline.open) },
    { label: "Past their date", value: String(report.headline.overdue) },
    {
      label: "Median days to close",
      value: report.headline.medianDaysToClose === null ? "not recorded" : String(report.headline.medianDaysToClose),
    },
    {
      label: "Open work past date",
      value: report.headline.lateShare === null ? "n/a" : `${report.headline.lateShare}%`,
    },
  ];

  const gap = 12;
  const columns = 3;
  const tileW = (PAGE_W - MARGIN * 2 - gap * (columns - 1)) / columns;
  const tileH = 58;

  figures.forEach((figure, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = MARGIN + column * (tileW + gap);
    const y = writer.y - row * (tileH + gap) - tileH;

    writer.page.drawRectangle({
      x,
      y,
      width: tileW,
      height: tileH,
      color: rgb(1, 1, 1),
      borderColor: RULE,
      borderWidth: 0.6,
    });
    writer.page.drawText(clean(figure.label.toUpperCase()), {
      x: x + 10,
      y: y + tileH - 18,
      size: 6.6,
      font: writer.bold,
      color: MUTED,
    });
    writer.page.drawText(clean(figure.value), {
      x: x + 10,
      y: y + 14,
      size: 17,
      font: writer.bold,
      color: report.headline.overdue > 0 && figure.label === "Past their date" ? rgb(0.7, 0.15, 0.15) : NAVY,
    });
  });

  writer.y -= Math.ceil(figures.length / columns) * (tileH + gap) + 8;
}

/** Raised against closed, six months, drawn as vector bars so it stays crisp at any zoom. */
function monthChart(writer: Writer, report: PortfolioReport): void {
  heading(writer, "Raised against signed off", "last six months");
  const chartW = PAGE_W - MARGIN * 2;
  const chartH = 120;
  const baseY = writer.y - chartH;
  const series = report.months;
  const peak = Math.max(1, ...series.map((month) => Math.max(month.raised, month.closed)));

  writer.page.drawLine({
    start: { x: MARGIN, y: baseY },
    end: { x: MARGIN + chartW, y: baseY },
    thickness: 0.6,
    color: RULE,
  });

  const slot = chartW / Math.max(1, series.length);
  const barW = Math.min(18, slot / 3);

  series.forEach((month, index) => {
    const centre = MARGIN + slot * index + slot / 2;
    const raisedH = (month.raised / peak) * (chartH - 26);
    const closedH = (month.closed / peak) * (chartH - 26);

    writer.page.drawRectangle({
      x: centre - barW - 2,
      y: baseY,
      width: barW,
      height: Math.max(raisedH, 0.5),
      color: NAVY,
    });
    writer.page.drawRectangle({
      x: centre + 2,
      y: baseY,
      width: barW,
      height: Math.max(closedH, 0.5),
      color: DEEP_GREEN,
    });

    if (month.raised > 0) {
      const label = String(month.raised);
      writer.page.drawText(label, {
        x: centre - barW - 2 + barW / 2 - writer.regular.widthOfTextAtSize(label, 6.5) / 2,
        y: baseY + Math.max(raisedH, 0.5) + 3,
        size: 6.5,
        font: writer.regular,
        color: MUTED,
      });
    }
    if (month.closed > 0) {
      const label = String(month.closed);
      writer.page.drawText(label, {
        x: centre + 2 + barW / 2 - writer.regular.widthOfTextAtSize(label, 6.5) / 2,
        y: baseY + Math.max(closedH, 0.5) + 3,
        size: 6.5,
        font: writer.regular,
        color: MUTED,
      });
    }

    const name = month.label;
    writer.page.drawText(name, {
      x: centre - writer.regular.widthOfTextAtSize(name, 7.5) / 2,
      y: baseY - 12,
      size: 7.5,
      font: writer.regular,
      color: MUTED,
    });
  });

  // Legend, under the axis rather than over the bars.
  const legendY = baseY - 26;
  writer.page.drawRectangle({ x: MARGIN, y: legendY, width: 8, height: 8, color: NAVY });
  writer.page.drawText("raised", { x: MARGIN + 12, y: legendY + 1, size: 7.5, font: writer.regular, color: MUTED });
  writer.page.drawRectangle({ x: MARGIN + 58, y: legendY, width: 8, height: 8, color: DEEP_GREEN });
  writer.page.drawText("signed off", {
    x: MARGIN + 70,
    y: legendY + 1,
    size: 7.5,
    font: writer.regular,
    color: MUTED,
  });

  writer.y = legendY - 26;
}

type Column = { header: string; width: number; align?: "left" | "right" };

function tableRow(
  writer: Writer,
  cells: string[],
  columns: Column[],
  options: { bold?: boolean; colour?: RGB; fill?: RGB } = {},
): void {
  const { page, regular, bold } = writer;
  const font = options.bold ? bold : regular;
  const height = 16;
  let x = MARGIN;

  if (options.fill) {
    page.drawRectangle({ x: MARGIN, y: writer.y - 4, width: PAGE_W - MARGIN * 2, height, color: options.fill });
  }

  cells.forEach((cell, index) => {
    const column = columns[index];
    if (!column) return;
    const text = clean(cell);
    const size = 8;
    const clipped =
      font.widthOfTextAtSize(text, size) > column.width - 6
        ? `${text.slice(0, Math.max(1, Math.floor(column.width / 4.6) - 2))}...`
        : text;
    const width = font.widthOfTextAtSize(clipped, size);
    const drawX = column.align === "right" ? x + column.width - width - 3 : x + 3;
    page.drawText(clipped, {
      x: drawX,
      y: writer.y,
      size,
      font,
      color: options.colour ?? INK,
    });
    x += column.width;
  });
  writer.y -= height;
}

function tradesTable(writer: Writer, report: PortfolioReport): void {
  heading(writer, "Where the work sits", "by trade, worst first");
  const columns: Column[] = [
    { header: "Trade", width: 175 },
    { header: "Raised", width: 52, align: "right" },
    { header: "Open", width: 48, align: "right" },
    { header: "Past date", width: 58, align: "right" },
    { header: "Closed", width: 50, align: "right" },
    { header: "Median days", width: 60, align: "right" },
  ];
  tableRow(writer, columns.map((column) => column.header), columns, {
    bold: true,
    colour: NAVY,
    fill: rgb(0.94, 0.96, 0.99),
  });

  for (const line of report.trades.slice(0, 14)) {
    ensureRoom(writer, 20, "Where the work sits", "by trade, worst first");
    tableRow(
      writer,
      [
        line.trade,
        String(line.raised),
        String(line.open),
        String(line.overdue),
        String(line.closed),
        line.medianDaysToClose === null ? "-" : String(line.medianDaysToClose),
      ],
      columns,
      { colour: line.overdue > 0 ? INK : MUTED },
    );
  }
  writer.y -= 12;
}

function projectsTable(writer: Writer, report: PortfolioReport): void {
  heading(writer, "By project", "every project in scope");
  const columns: Column[] = [
    { header: "Project", width: 251 },
    { header: "Raised", width: 60, align: "right" },
    { header: "Open", width: 60, align: "right" },
    { header: "Past date", width: 70, align: "right" },
    { header: "Closed", width: 60, align: "right" },
  ];
  tableRow(writer, columns.map((column) => column.header), columns, {
    bold: true,
    colour: NAVY,
    fill: rgb(0.94, 0.96, 0.99),
  });

  for (const line of report.projects.slice(0, 20)) {
    ensureRoom(writer, 20, "By project", "every project in scope");
    tableRow(
      writer,
      [line.name, String(line.raised), String(line.open), String(line.overdue), String(line.closed)],
      columns,
    );
  }
  writer.y -= 12;
}

function worstTable(writer: Writer, report: PortfolioReport): void {
  heading(writer, "Past their date", "the ten furthest overdue, worst first");
  if (report.worst.length === 0) {
    paragraph(writer, "Nothing is past its date in this scope.", 9, MUTED);
    return;
  }

  const columns: Column[] = [
    { header: "Reference", width: 74 },
    { header: "Item", width: 200 },
    { header: "Project", width: 140 },
    { header: "Trade", width: 63 },
    { header: "Days late", width: 52, align: "right" },
  ];
  tableRow(writer, columns.map((column) => column.header), columns, {
    bold: true,
    colour: NAVY,
    fill: rgb(0.94, 0.96, 0.99),
  });

  for (const item of report.worst) {
    ensureRoom(writer, 20, "Past their date", "the ten furthest overdue, worst first");
    tableRow(
      writer,
      [item.ref ?? "-", item.title, item.projectName, item.trade, String(item.daysLate)],
      columns,
      { colour: item.daysLate >= 14 ? rgb(0.7, 0.15, 0.15) : INK },
    );
  }
  writer.y -= 12;
}

export async function renderPortfolioPdf(
  report: PortfolioReport,
  context: ReportPdfContext,
): Promise<{ bytes: Uint8Array; filename: string }> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Portfolio report - ${report.scope.label} - ${report.period.label}`);
  doc.setProducer("instructBrain");
  doc.setCreator("instructBrain");

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const writer: Writer = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    bold,
    regular,
    y: PAGE_H - BAND_H - 34,
    pageIndex: 1,
  };
  writer.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER });
  drawBand(writer, "Portfolio report", `${context.organisationName} - ${report.scope.label} - ${report.period.label}`);

  writer.page.drawText("Portfolio report", { x: MARGIN, y: writer.y, size: 22, font: bold, color: NAVY });
  writer.y -= 22;
  paragraph(
    writer,
    `${report.scope.label} - ${report.period.label} (${report.period.from} to ${report.period.to}). Prepared for ${context.generatedBy} on ${report.generatedOn}.`,
    9,
    MUTED,
  );
  writer.y -= 6;

  if (report.empty) {
    paragraph(writer, "No findings fell inside this scope and period, so there is nothing to report.", 11, INK);
    drawFooter(writer);
  } else {
    headlineTiles(writer, report);
    monthChart(writer, report);
    tradesTable(writer, report);
    projectsTable(writer, report);
    worstTable(writer, report);
    heading(writer, "How to read these figures", "stated, not implied");
    for (const caveat of report.caveats) paragraph(writer, `- ${caveat}`, 8.5, MUTED, 2);
    drawFooter(writer);
  }

  const bytes = await doc.save();
  const slug = report.scope.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    bytes,
    filename: `instructbrain-report-${slug || "portfolio"}-${report.period.from}-to-${report.period.to}.pdf`,
  };
}
