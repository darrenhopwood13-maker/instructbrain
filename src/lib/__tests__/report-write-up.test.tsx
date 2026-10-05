// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ReportDocumentView } from "@/components/report/report-document-view";
import type { DocFinding, ReportDocument } from "@/lib/report/document";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * The snag write-up as the person holding the report reads it: what the defect
 * is called, how it is put right, the alternative, the trade tip and the safety
 * notes. An item the assessment did not write up shows none of it — no labels
 * sitting above nothing.
 */

function finding(overrides: Partial<DocFinding> = {}): DocFinding {
  return {
    id: overrides.id ?? "f1",
    ref: overrides.ref ?? "1",
    sequence: overrides.sequence ?? 1,
    statusId: overrides.statusId ?? "fail",
    severityId: null,
    categoryId: null,
    findingText: overrides.findingText ?? "FINDINGMARKER",
    snagTitle: overrides.snagTitle ?? null,
    remedialText: overrides.remedialText ?? "REMEDIALMARKER",
    rectificationAlt: overrides.rectificationAlt ?? null,
    tradesmanHack: overrides.tradesmanHack ?? null,
    hsNotes: overrides.hsNotes ?? null,
    captureFields: {},
    assignedTrade: overrides.assignedTrade ?? null,
    suggestedTrade: null,
    tradeReasoning: null,
    tradeConfidence: null,
    dueDate: null,
    lifecycleState: "open",
    isConfidential: false,
    confirmedAt: null,
    likelyCause: null,
    regulatoryReference: null,
    abstainReason: null,
    conditionGrade: null,
    suggestedGrade: null,
    gradeConfidence: null,
    photos: [],
  };
}

const snapshot = {
  id: "site_walk",
  version: 1,
  label: "Site condition",
  statuses: [{ id: "fail", label: "Defect", tone: "fail" as const }],
  requiresTradeAssignment: true,
} as unknown as SurveyTypeSnapshot;

function doc(findings: DocFinding[]): ReportDocument {
  return {
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
      executiveSummary: null,
      synthesisConfirmed: false,
      coverPhotoId: null,
      outputLanguage: "en",
    },
    project: null,
    organisation: null,
    snapshot,
    findings,
    photos: [],
    synthesis: null,
  } as unknown as ReportDocument;
}

describe("the snag write-up on the report", () => {
  afterEach(cleanup);

  it("shows the title, the alternative fix, the trade tip and the safety notes", () => {
    render(
      <ReportDocumentView
        document={doc([
          finding({
            snagTitle: "SNAGTITLEMARKER",
            rectificationAlt: "ALTMARKER",
            tradesmanHack: "HACKMARKER",
            hsNotes: "HSMARKER",
          }),
        ])}
        editable={false}
      />,
    );

    expect(screen.getByText("SNAGTITLEMARKER")).toBeTruthy();
    expect(screen.getByText("Alternative fix")).toBeTruthy();
    expect(screen.getByText("ALTMARKER")).toBeTruthy();
    expect(screen.getByText("Trade tip")).toBeTruthy();
    expect(screen.getByText("HACKMARKER")).toBeTruthy();
    expect(screen.getByText("Health and safety")).toBeTruthy();
    expect(screen.getByText("HSMARKER")).toBeTruthy();
  });

  it("shows no empty label for an item the assessment did not write up", () => {
    render(<ReportDocumentView document={doc([finding()])} editable={false} />);

    expect(screen.getByText("FINDINGMARKER")).toBeTruthy();
    expect(screen.queryByText("Trade tip")).toBeNull();
    expect(screen.queryByText("Health and safety")).toBeNull();
    expect(screen.queryByText("Alternative fix")).toBeNull();
  });

  it("still attributes the snag to its trade", () => {
    render(
      <ReportDocumentView
        document={doc([finding({ assignedTrade: "Roofing" })])}
        editable={false}
      />,
    );

    expect(screen.getByText(/Trade: Roofing/)).toBeTruthy();
  });
});
