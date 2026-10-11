// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReportDocumentView } from "@/components/report/report-document-view";
import type { DocFinding, DocPhoto, DocRegion, ReportDocument } from "@/lib/report/document";
import { siteWalkDefinition, snapshotOf } from "@/lib/survey-definitions";

/**
 * Job 3, the drag: the region is the model's estimate and will sometimes be in
 * the wrong place, so a person has to be able to move it — and the move has to
 * be saved, or it is decoration.
 *
 * The plan said the drag ships WITH the pins. It did not, which is a gap against
 * the plan; this closes it. The correction is written to the finding↔photo link,
 * which wins over the model's own region at read time, so the AI's original
 * estimate is never destroyed.
 *
 * jsdom reports a zero-sized box for every element, so the frame's rect is
 * stubbed. Without that the component (correctly) refuses to start a drag it
 * cannot measure, and the test would pass while proving nothing.
 */

const REGION: DocRegion = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    top: 0,
    left: 0,
    right: 400,
    bottom: 300,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function photo(id: string, sequence: number): DocPhoto {
  return {
    id,
    sequence,
    filename: null,
    capturedAt: "2026-10-01T09:00:00Z",
    url: `https://example.test/${id}.jpg`,
    thumbUrl: `https://example.test/${id}-thumb.jpg`,
    printUrl: null,
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
    findingText: "ITEMTEXT",
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

function twoOnOnePhoto(): ReportDocument {
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
    findings: [
      finding({ id: "a", ref: "F-001", photos: [{ photo: photo("p1", 4), role: "primary", region: REGION }] }),
      finding({ id: "b", ref: "F-002", photos: [{ photo: photo("p1", 4), role: "primary", region: { x: 0.6, y: 0.6, w: 0.2, h: 0.2 } }] }),
    ],
    photos: [],
    synthesis: null,
    author: null,
  } as ReportDocument;
}

describe("moving a pin to the right place", () => {
  it("saves a moved area against the item it belongs to", () => {
    const onPhotoRegion = vi.fn();
    render(
      <ReportDocumentView
        document={twoOnOnePhoto()}
        editable
        onReportPatch={vi.fn()}
        onPhotoRegion={onPhotoRegion}
      />,
    );

    const handles = screen.getAllByRole("button", { name: "Move the marked area to the right place" });
    expect(handles).toHaveLength(2);
    const first = handles[0]!;

    // A 40px drag on a 400px-wide frame is 0.1 of the width; 30px on 300 is 0.1
    // of the height. The region starts at 0.4, 0.4.
    fireEvent.pointerDown(first, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(first, { pointerId: 1, clientX: 140, clientY: 130 });
    fireEvent.pointerUp(first, { pointerId: 1, clientX: 140, clientY: 130 });

    expect(onPhotoRegion).toHaveBeenCalledTimes(1);
    const [findingId, photoId, region] = onPhotoRegion.mock.calls[0]!;
    expect(findingId).toBe("a");
    expect(photoId).toBe("p1");
    expect(region.x).toBeCloseTo(0.5, 5);
    expect(region.y).toBeCloseTo(0.5, 5);
    // The size is never changed by a drag — only where the box sits.
    expect(region.w).toBeCloseTo(REGION.w, 5);
    expect(region.h).toBeCloseTo(REGION.h, 5);
  });

  it("keeps the box on the photograph when dragged past the edge", () => {
    const onPhotoRegion = vi.fn();
    render(
      <ReportDocumentView
        document={twoOnOnePhoto()}
        editable
        onReportPatch={vi.fn()}
        onPhotoRegion={onPhotoRegion}
      />,
    );

    const first = screen.getAllByRole("button", { name: "Move the marked area to the right place" })[0]!;
    // Drag far past the bottom-right corner.
    fireEvent.pointerDown(first, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(first, { pointerId: 1, clientX: 4000, clientY: 3000 });
    fireEvent.pointerUp(first, { pointerId: 1, clientX: 4000, clientY: 3000 });

    const [, , region] = onPhotoRegion.mock.calls[0]!;
    // A box can never be pushed off the picture: x + w can never exceed 1.
    expect(region.x).toBeLessThanOrEqual(1 - region.w);
    expect(region.y).toBeLessThanOrEqual(1 - region.h);
    expect(region.x).toBeGreaterThanOrEqual(0);
    expect(region.y).toBeGreaterThanOrEqual(0);
  });

  it("offers no drag on a report the reader cannot change", () => {
    const onPhotoRegion = vi.fn();
    render(
      <ReportDocumentView
        document={twoOnOnePhoto()}
        editable={false}
        onPhotoRegion={onPhotoRegion}
      />,
    );
    // Editable is false, so the correction is not offered at all — a shared link
    // and a printed copy must not look editable.
    expect(screen.queryAllByRole("button", { name: "Move the marked area to the right place" })).toHaveLength(0);
  });
});
