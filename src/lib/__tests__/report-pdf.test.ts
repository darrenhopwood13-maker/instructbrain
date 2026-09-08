import { describe, expect, it } from "vitest";
import { buildReportPdf, pdfFilename } from "@/lib/report/pdf.server";
import type { DocFinding, ReportDocument } from "@/lib/report/document";
import { NOT_ASSESSED_ID } from "@/lib/survey-types";

function finding(overrides: Partial<DocFinding>): DocFinding {
  return {
    id: overrides.id ?? "f1",
    ref: overrides.ref ?? "1",
    sequence: overrides.sequence ?? 1,
    statusId: overrides.statusId ?? "fail",
    severityId: overrides.severityId ?? null,
    categoryId: null,
    findingText: overrides.findingText ?? "Mortar missing to the parapet coping joints.",
    remedialText: overrides.remedialText ?? "Rake out and repoint.",
    captureFields: overrides.captureFields ?? { location: "Roof, north parapet" },
    assignedTrade: overrides.assignedTrade ?? null,
    suggestedTrade: null,
    tradeReasoning: null,
    tradeConfidence: null,
    dueDate: null,
    lifecycleState: "open",
    isConfidential: overrides.isConfidential ?? false,
    confirmedAt: null,
    likelyCause: null,
    regulatoryReference: null,
    abstainReason: overrides.abstainReason ?? null,
    photos: [],
  } as DocFinding;
}

const document: ReportDocument = {
  report: {
    id: "r1",
    title: "Condition survey",
    subtitle: null,
    reference: "IB-0001",
    reportDate: "2026-09-01",
    status: "draft",
    issuedAt: null,
    currentVersion: 0,
    scopeText: null,
    methodologyText: null,
    executiveSummary: "Two defects recorded.",
    synthesisConfirmed: false,
    coverPhotoId: null,
  },
  project: null,
  organisation: null,
  snapshot: null,
  findings: [
    finding({ id: "a", ref: "1", assignedTrade: "Roofing" }),
    finding({
      id: "b",
      ref: "2",
      statusId: NOT_ASSESSED_ID,
      abstainReason: "The photograph was too dark to read.",
    }),
    finding({
      id: "c",
      ref: "3",
      assignedTrade: "Roofing",
      isConfidential: true,
      findingText: "CONFIDENTIALMARKER",
    }),
  ],
  photos: [],
  synthesis: null,
  author: null,
} as ReportDocument;

function textOf(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

describe("report PDF", () => {
  it("produces a real, non-empty PDF file", async () => {
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    expect(textOf(built.bytes.slice(0, 5))).toBe("%PDF-");
    expect(built.bytes.byteLength).toBeGreaterThan(1000);
    expect(built.filename.endsWith(".pdf")).toBe(true);
  });

  it("never puts a confidential item in a trade extract", async () => {
    const built = await buildReportPdf(document, {
      variant: "trade",
      trade: "Roofing",
      includePhotos: false,
    });
    expect(textOf(built.bytes)).not.toContain("CONFIDENTIALMARKER");
  });

  it("keeps a not-assessed item in the full report rather than dropping it", async () => {
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    // pdf-lib writes uncompressed text operators, so the label is readable.
    expect(textOf(built.bytes)).toContain("Not assessed");
  });

  it("names the file after the report reference", () => {
    expect(pdfFilename(document, { variant: "full" })).toBe("IB-0001.pdf");
  });
});
