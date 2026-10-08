// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("never claims pins on a photograph where no item has a recorded area", () => {
    render(
      <ReportDocumentView
        document={doc([
          finding({ id: "a", ref: "F-001", photos: [on("p1", 4, null)] }),
          finding({ id: "b", ref: "F-002", photos: [on("p1", 4, null)] }),
        ])}
        editable={false}
      />,
    );

    // Both rows still point at the photograph, which is printed — but neither may
    // say "with its pins", because the photograph carries none.
    expect(screen.getAllByText("Photograph 4 · shown above")).toHaveLength(2);
    expect(screen.queryByText("Photograph 4 · shown above with its pins")).toBeNull();
    expect(screen.queryByText(/^Pin \d+ of \d+$/)).toBeNull();
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

/**
 * The defect the LIVE WALK found on 8 October 2026, and the reason this rule
 * exists: a report whose stored images cannot be signed comes back with no URL,
 * and the document was still telling the reader "Pin 2 of 6" and "shown above
 * with its pins" about a photograph that was never going to arrive. A promise
 * the reader cannot keep is worse than bad news.
 */
function deadPhoto(id: string, sequence: number): DocPhoto {
  return { ...photo(id, sequence), url: null, thumbUrl: null };
}

describe("a photograph whose image cannot be read", () => {
  afterEach(cleanup);

  it("never promises a pin, and says the image could not be read", () => {
    render(
      <ReportDocumentView
        document={doc([
          finding({ id: "a", ref: "F-001", photos: [{ photo: deadPhoto("p1", 4), role: "primary", region: REGION }] }),
          finding({ id: "b", ref: "F-002", photos: [{ photo: deadPhoto("p1", 4), role: "primary", region: REGION }] }),
        ])}
        editable
        onReportPatch={vi.fn()}
      />,
    );

    // No picture, so no pin — not even a number in the rows.
    expect(screen.queryByRole("button", { name: /Pin \d/ })).toBeNull();
    expect(screen.queryByText(/^Pin \d+ of \d+$/)).toBeNull();
    expect(screen.queryByText("shown above with its pins")).toBeNull();
    // And it says so, twice: once per item referring to that photograph.
    expect(screen.getAllByText("Photograph could not be read")).toHaveLength(2);
    // The grouping is not lost: the panel still names the items on it.
    expect(screen.getByText(/The items are listed in the schedule: F-001, F-002\./)).toBeTruthy();
    // The heading is still there, so the reader knows why the items point above.
    expect(screen.getByRole("heading", { name: "Photographs carrying several items" })).toBeTruthy();
    // No drag is offered: there is nothing on screen to drag.
    expect(screen.queryAllByRole("button", { name: "Move the marked area to the right place" })).toHaveLength(0);
  });

  it("keeps numbering the photographs that DO load", () => {
    render(
      <ReportDocumentView
        document={doc([
          finding({ id: "a", ref: "F-001", photos: [on("p1", 4, REGION)] }),
          finding({ id: "b", ref: "F-002", photos: [on("p1", 4, REGION)] }),
          finding({ id: "c", ref: "F-003", photos: [{ photo: deadPhoto("p2", 5), role: "primary", region: REGION }] }),
          finding({ id: "d", ref: "F-004", photos: [{ photo: deadPhoto("p2", 5), role: "primary", region: REGION }] }),
        ])}
        editable={false}
      />,
    );

    // The readable pair keeps its pins...
    expect(screen.getByText("Pin 1 of 2")).toBeTruthy();
    expect(screen.getByText("Pin 2 of 2")).toBeTruthy();
    // ...and the unreadable pair does not borrow a number from anyone.
    expect(screen.getAllByText("Photograph could not be read")).toHaveLength(2);
    expect(screen.queryByText("Pin 1 of 4")).toBeNull();
  });
});

/**
 * The placement half of the same problem, on screen. The plate used to be a block
 * above the whole schedule, so a reader met pictures first and the items they
 * belong to a long way below. Where it sits is the assertion here, not merely
 * that it exists.
 */
describe("where a shared photograph is shown on screen", () => {
  afterEach(cleanup);

  function sharedAfterTwoSolo() {
    return render(
      <ReportDocumentView
        document={doc([
          finding({ id: "a", ref: "F-001", photos: [on("solo1", 1, REGION)] }),
          finding({ id: "b", ref: "F-002", photos: [on("solo2", 2, REGION)] }),
          finding({ id: "c", ref: "F-003", photos: [on("shared", 3, REGION)] }),
          finding({ id: "d", ref: "F-004", photos: [on("shared", 3, REGION)] }),
        ])}
        editable={false}
      />,
    );
  }

  it("sits inside the first item that refers to it", () => {
    const { container } = sharedAfterTwoSolo();

    const items = Array.from(container.querySelectorAll("li"));
    const withPlate = items.findIndex((li) => li.querySelector("#photo-plate-shared"));

    // The third item carries it: items one and two do not refer to it at all.
    expect(withPlate).toBe(2);
    expect(items[0]?.querySelector("#photo-plate-shared")).toBeNull();
    expect(items[1]?.querySelector("#photo-plate-shared")).toBeNull();
    // And it sits among the items rather than in a block above them.
    expect(container.querySelector("#photo-plate-shared")?.closest("ul")).toBeTruthy();
    expect(container.querySelector("#photo-plate-shared")?.closest("li")).toBe(items[2]);
    // The item it sits under links up to it.
    expect(items[2]?.querySelector("a[href='#photo-plate-shared']")).toBeTruthy();
  });

  it("explains itself once, however many plates there are", () => {
    render(
      <ReportDocumentView
        document={doc([
          finding({ id: "a", ref: "F-001", photos: [on("shared", 3, REGION)] }),
          finding({ id: "b", ref: "F-002", photos: [on("shared", 3, REGION)] }),
          finding({ id: "c", ref: "F-003", photos: [on("other", 7, REGION)] }),
          finding({ id: "d", ref: "F-004", photos: [on("other", 7, REGION)] }),
        ])}
        editable={false}
      />,
    );

    expect(
      screen.getAllByRole("heading", { name: "Photographs carrying several items" }),
    ).toHaveLength(1);
    // Two shared photographs, so two pictures on the page and one explanation.
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });
});
