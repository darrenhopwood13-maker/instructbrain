// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReportDocumentView } from "@/components/report/report-document-view";
import type { DocFinding, DocPhoto, DocRegion, ReportDocument } from "@/lib/report/document";
import { siteWalkDefinition, snapshotOf } from "@/lib/survey-definitions";

/**
 * Job 3 of IB-PLAN-002, on screen: a photograph carrying several items is shown
 * ONCE, with a numbered pin per item, and the item rows point at a pin instead
 * of printing the same picture again.
 *
 * Asserted by counting the photographs that actually reach the page. A test that
 * only checked "a pin exists" would stay green while the picture still repeated,
 * which is the defect this change exists to remove.
 */

const REGION: DocRegion = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };

function photo(id: string, sequence: number): DocPhoto {
  return {
    id,
    sequence,
    filename: null,
    capturedAt: "2026-10-01T09:00:00Z",
    url: `https://example.test/${id}.jpg`,
    thumbUrl: `https://example.test/${id}-thumb.jpg`,
    captureFields: {},
  };
}

function finding(overrides: Partial<DocFinding> = {}): DocFinding {
  return {
    id: overrides.id ?? "f1",
    ref: overrides.ref ?? "F-001",
    sequence: overrides.sequence ?? 1,
    statusId: "observation",
    severityId: null,
    categoryId: null,
    findingText: overrides.findingText ?? "ITEMTEXT",
    snagTitle: null,
    remedialText: "",
    rectificationAlt: null,
    tradesmanHack: null,
    hsNotes: null,
    captureFields: {},
    assignedTrade: null,
    suggestedTrade: null,
    tradeReasoning: null,
    tradeConfidence: null,
    conditionGrade: null,
    suggestedGrade: null,
    gradeConfidence: null,
    dueDate: null,
    lifecycleState: "open",
    isConfidential: false,
    confirmedAt: null,
    likelyCause: null,
    regulatoryReference: null,
    abstainReason: null,
    photos: overrides.photos ?? [],
  };
}

function doc(findings: DocFinding[]): ReportDocument {
  return {
    report: {
      id: "r1",
      title: "Site condition",
      subtitle: null,
      reference: "IB-0002",
      reportDate: "2026-10-01",
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
    snapshot: snapshotOf(siteWalkDefinition),
    findings,
    photos: [],
    synthesis: null,
    author: null,
  } as ReportDocument;
}

function on(photoId: string, sequence: number, region: DocRegion | null) {
  return { photo: photo(photoId, sequence), role: "primary", region };
}

describe("a photograph carrying several items, on screen", () => {
  afterEach(cleanup);

  it("shows the photograph once, with a numbered pin per item", () => {
    render(
      <ReportDocumentView
        document={doc([
          finding({ id: "a", ref: "F-001", photos: [on("p1", 4, REGION)] }),
          finding({ id: "b", ref: "F-002", photos: [on("p1", 4, REGION)] }),
          finding({ id: "c", ref: "F-003", photos: [on("p1", 4, REGION)] }),
        ])}
        editable={false}
      />,
    );

    // One picture reaches the page, not three.
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Photographs carrying several items" })).toBeTruthy();
    // Each item carries its own pin.
    for (const number of [1, 2, 3]) {
      expect(screen.getByRole("button", { name: new RegExp(`Pin ${number} of 3`) })).toBeTruthy();
      expect(screen.getByText(`Pin ${number} of 3`)).toBeTruthy();
    }
  });

  it("leaves a photograph carrying a single item exactly where it was", () => {
    render(
      <ReportDocumentView
        document={doc([finding({ id: "a", ref: "F-001", photos: [on("p1", 4, REGION)] })])}
        editable={false}
      />,
    );

    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Photographs carrying several items" })).toBeNull();
    expect(screen.queryByText(/^Pin \d/)).toBeNull();
  });

  it("shows a shared photograph once even when the model marked only one item", () => {
    render(
      <ReportDocumentView
        document={doc([
          finding({ id: "a", ref: "F-001", photos: [on("p1", 4, REGION)] }),
          finding({ id: "b", ref: "F-002", photos: [on("p1", 4, null)] }),
        ])}
        editable={false}
      />,
    );

    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Photographs carrying several items" })).toBeTruthy();
    // One marked item out of two is not a pin — there is nothing to tell apart.
    expect(screen.queryByRole("button", { name: /Pin \d/ })).toBeNull();
    // The unmarked item says so rather than pointing at a pin that is not there.
    expect(screen.getByText("Shown above")).toBeTruthy();
    expect(screen.getByText("Marked above")).toBeTruthy();
  });

  it("counts and numbers only the items with a recorded area", () => {
    render(
      <ReportDocumentView
        document={doc([
          finding({ id: "a", ref: "F-001", photos: [on("p1", 4, REGION)] }),
          finding({ id: "b", ref: "F-002", photos: [on("p1", 4, null)] }),
          finding({ id: "c", ref: "F-003", photos: [on("p1", 4, REGION)] }),
        ])}
        editable={false}
      />,
    );

    // Two marks, so two pins — and the total is two, matching what a reader counts.
    expect(screen.getByText("Pin 1 of 2")).toBeTruthy();
    expect(screen.getByText("Pin 2 of 2")).toBeTruthy();
    expect(screen.queryByText(/Pin 3/)).toBeNull();
  });

  it("still shows two separate photographs once each when neither is shared", () => {
    render(
      <ReportDocumentView
        document={doc([
          finding({ id: "a", ref: "F-001", photos: [on("p1", 4, REGION)] }),
          finding({ id: "b", ref: "F-002", photos: [on("p2", 5, REGION)] }),
        ])}
        editable={false}
      />,
    );

    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "Photographs carrying several items" })).toBeNull();
  });
});
