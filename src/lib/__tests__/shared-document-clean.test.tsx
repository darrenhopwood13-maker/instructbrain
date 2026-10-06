// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ReportDocumentView } from "@/components/report/report-document-view";
import { SURVEY_TYPE_FIELD } from "@/lib/report/sections";
import type { DocFinding, ReportDocument } from "@/lib/report/document";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * What a client sees on a shared report.
 *
 * The shared page renders the document with no patch handlers, which is what
 * makes it read-only — the same condition an issued report is viewed under.
 * These assertions are about absences as much as presences: a client document
 * printed "Author: Not recorded" and "survey type: weekly_compliance_fire" on
 * their own report, and neither should ever be able to come back.
 */

const TYPES = [{ id: "weekly_compliance_fire", label: "Weekly fire compliance check" }];

const snapshot = {
  id: "test",
  label: "Weekly fire compliance",
  statuses: [
    { id: "pass", label: "Satisfactory", tone: "pass", shortcut: "p" },
    { id: "fail", label: "Defective", tone: "fail", shortcut: "f" },
    { id: "not_assessed", label: "Not assessed", tone: "neutral" },
  ],
  outputSections: ["cover", "scope", "schedule"],
  requiresTradeAssignment: false,
} as unknown as SurveyTypeSnapshot;

function finding(overrides: Partial<DocFinding> = {}): DocFinding {
  return {
    id: "f1",
    ref: "F-001",
    sequence: 1,
    statusId: "fail",
    severityId: null,
    categoryId: null,
    findingText: "Fire door held open by a wedge.",
    remedialText: "Remove the wedge and reinstate the self-closer.",
    captureFields: {},
    assignedTrade: null,
    suggestedTrade: null,
    tradeReasoning: null,
    tradeConfidence: null,
    dueDate: null,
    lifecycleState: "open",
    isConfidential: false,
    confirmedAt: "2026-01-01T00:00:00Z",
    likelyCause: null,
    regulatoryReference: null,
    abstainReason: null,
    conditionGrade: null,
    suggestedGrade: null,
    gradeConfidence: null,
    photos: [],
    ...overrides,
  };
}

function document(overrides: Partial<ReportDocument> = {}): ReportDocument {
  return {
    report: {
      id: "r1",
      title: "Weekly fire check",
      subtitle: null,
      reference: "R-001",
      reportDate: "2026-01-01",
      status: "issued",
      issuedAt: "2026-01-02T00:00:00Z",
      currentVersion: 1,
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
    surveyTypes: TYPES,
    findings: [finding()],
    photos: [],
    synthesis: null,
    author: null,
    ...overrides,
  } as unknown as ReportDocument;
}

/** The shared page: no handlers, so the document renders read-only. */
const renderShared = (doc: ReportDocument) =>
  render(<ReportDocumentView document={doc} print />).container.textContent ?? "";

describe("a shared report shows no placeholders", () => {
  it("shows no author row at all when the report cannot name one", () => {
    const text = renderShared(document({ author: null }));
    expect(text).not.toContain("Author");
    expect(text).not.toContain("Recorded author");
    expect(text).not.toContain("Author not recorded");
  });

  it("shows the author row once a real name is carried on the document", () => {
    const text = renderShared(document({ author: "A. Surveyor" }));
    expect(text).toContain("Author");
    expect(text).toContain("A. Surveyor");
  });

  it("treats a blank author name as no author, not as an empty row", () => {
    const text = renderShared(document({ author: "   " }));
    expect(text).not.toContain("Author");
  });
});

describe("a shared report shows no machine text", () => {
  it("never prints the internal survey-type marker or a raw survey-type id", () => {
    const text = renderShared(
      document({
        findings: [
          finding({
            captureFields: {
              [SURVEY_TYPE_FIELD]: "weekly_compliance_fire",
              survey_under: "weekly_compliance_fire",
              item: "Fire door 12",
            },
          }),
        ],
      }),
    );

    expect(text).not.toContain("__survey_type");
    expect(text).not.toContain("weekly_compliance_fire");
  });

  it("prints the survey type's label where the value names one", () => {
    const text = renderShared(
      document({
        findings: [finding({ captureFields: { survey_under: "weekly_compliance_fire" } })],
      }),
    );
    expect(text).toContain("Weekly fire compliance check");
  });

  it("still shows ordinary capture fields, under a readable label", () => {
    const text = renderShared(
      document({ findings: [finding({ captureFields: { item_name: "Fire door 12" } })] }),
    );
    expect(text).toContain("Item name");
    expect(text).toContain("Fire door 12");
  });
});

describe("an empty section is omitted from a shared report", () => {
  it("does not print a scope heading over nothing", () => {
    const text = renderShared(document());
    expect(text).not.toContain("Scope and limitations");
  });

  it("prints the scope section when it has wording", () => {
    const doc = document();
    (doc.report as { scopeText: string | null }).scopeText =
      "Visual inspection only, from ground level.";
    const text = renderShared(doc);
    expect(text).toContain("Scope and limitations");
    expect(text).toContain("Visual inspection only, from ground level.");
  });
});
