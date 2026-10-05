// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ReportDocumentView } from "@/components/report/report-document-view";
import type { DocFinding, ReportDocument } from "@/lib/report/document";
import { buildReportPdf } from "@/lib/report/pdf.server";
import {
  scheduleOfConditionDefinition,
  siteWalkDefinition,
  snapshotOf,
} from "@/lib/survey-definitions";

/**
 * The Schedule of Condition, as the person holding the report reads it: the
 * heading, the mandatory scope-and-limitations block, the elements with their
 * grade and meaning, and the closing count of items per grade. A survey that
 * does not grade its elements shows none of it.
 *
 * The PDF is asserted by size delta only: the writer deflates its content
 * streams, so a text search finds nothing and a `not.toContain` assertion would
 * pass on an empty file for the wrong reason.
 */

function finding(overrides: Partial<DocFinding> = {}): DocFinding {
  return {
    id: overrides.id ?? "f1",
    ref: overrides.ref ?? "1",
    sequence: overrides.sequence ?? 1,
    statusId: overrides.statusId ?? "graded",
    severityId: null,
    categoryId: null,
    findingText: overrides.findingText ?? "FINDINGMARKER",
    snagTitle: null,
    remedialText: overrides.remedialText ?? "REMEDIALMARKER",
    rectificationAlt: null,
    tradesmanHack: null,
    hsNotes: null,
    captureFields: overrides.captureFields ?? {},
    assignedTrade: overrides.assignedTrade ?? "Principal contractor",
    suggestedTrade: null,
    tradeReasoning: null,
    tradeConfidence: null,
    conditionGrade: overrides.conditionGrade ?? null,
    suggestedGrade: overrides.suggestedGrade ?? null,
    gradeConfidence: overrides.gradeConfidence ?? null,
    dueDate: null,
    lifecycleState: "open",
    isConfidential: false,
    confirmedAt: null,
    likelyCause: null,
    regulatoryReference: null,
    abstainReason: null,
    photos: [],
  };
}

function doc(
  findings: DocFinding[],
  snapshot: ReportDocument["snapshot"] = snapshotOf(scheduleOfConditionDefinition),
): ReportDocument {
  return {
    report: {
      id: "r1",
      title: "North block condition survey",
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
    author: null,
  } as ReportDocument;
}

describe("a Schedule of Condition on screen", () => {
  afterEach(cleanup);

  it("opens with the heading, the limitations block, and the graded element with its meaning", () => {
    render(
      <ReportDocumentView document={doc([finding({ conditionGrade: "C" })])} editable={false} />,
    );

    expect(screen.getByRole("heading", { name: "Schedule of Condition" })).toBeTruthy();
    // The mandatory limitation, visible on the artifact.
    expect(screen.getByText(/no opening up, no dismantling and no testing/i)).toBeTruthy();
    expect(screen.getByText(/not a structural survey and not a building survey/i)).toBeTruthy();
    // The element, its grade and the meaning of that grade. The code appears
    // more than once (the group heading and the item line), so assert presence.
    expect(screen.getByText("FINDINGMARKER")).toBeTruthy();
    expect(screen.getAllByText(/C — Fair/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Deteriorating, planned repair or replacement/)).toBeTruthy();
  });

  it("closes with a count of items per grade, and reports the ungraded separately", () => {
    render(
      <ReportDocumentView
        document={doc([
          finding({ id: "a", ref: "1", conditionGrade: "C" }),
          finding({ id: "b", ref: "2", conditionGrade: null }),
        ])}
        editable={false}
      />,
    );

    expect(screen.getByText("Items by grade")).toBeTruthy();
    expect(screen.getByText(/A — Good: 0/)).toBeTruthy();
    expect(screen.getByText(/C — Fair: 1/)).toBeTruthy();
    // The ungraded element is not folded into a grade.
    expect(screen.getByText(/1 still to be confirmed by a person/)).toBeTruthy();
    expect(screen.getAllByText(/to be confirmed/i).length).toBeGreaterThan(0);
  });

  it("does not present an ordinary survey as a Schedule of Condition", () => {
    render(
      <ReportDocumentView
        document={doc([finding({ statusId: "observation" })], snapshotOf(siteWalkDefinition))}
        editable={false}
      />,
    );

    // The item is still rendered — so the negatives below are not passing on an empty screen.
    expect(screen.getByText("FINDINGMARKER")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Schedule of Condition" })).toBeNull();
    expect(screen.queryByText(/no opening up, no dismantling and no testing/i)).toBeNull();
  });
});

describe("the Schedule of Condition PDF", () => {
  it("draws more when an element carries a confirmed grade", async () => {
    const ungraded = await buildReportPdf(doc([finding({ conditionGrade: null })]), {
      variant: "full",
      includePhotos: false,
    });
    const graded = await buildReportPdf(doc([finding({ conditionGrade: "D" })]), {
      variant: "full",
      includePhotos: false,
    });
    expect(graded.bytes.byteLength).toBeGreaterThan(ungraded.bytes.byteLength);
  });

  it("draws the schedule and its limitations block only for a condition survey", async () => {
    const condition = await buildReportPdf(doc([finding({ conditionGrade: "B" })]), {
      variant: "full",
      includePhotos: false,
    });
    // The same element through the single-item variant, which never draws the
    // Schedule heading, the limitations block or the per-grade count.
    const bare = await buildReportPdf(doc([finding({ conditionGrade: "B" })]), {
      variant: "item",
      findingIds: ["f1"],
      includePhotos: false,
    });
    expect(condition.bytes.byteLength).toBeGreaterThan(bare.bytes.byteLength);
  });
});
