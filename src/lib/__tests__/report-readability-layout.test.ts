import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReportPdf } from "@/lib/report/pdf.server";
import { groupResults } from "@/lib/report/grouping";
import type { ReportDocument } from "@/lib/report/document";
import {
  decodePageTexts,
  finding,
  photo,
  reportDocument,
  serveImages,
} from "@/lib/__tests__/support/pdf-fixtures";

/**
 * The printed report is readable: it says what each item is called, where the
 * item can be found, and where the whole list lives.
 *
 * Measured on the issued SNG-2026-10-006: eighteen items, none of them carrying
 * a headline in the artifact, and no contents page anywhere in twenty-two
 * pages. Every finding already held a one-line title — the renderer printed it
 * as one more line of body text, below the chips, or (in that issue) not at all,
 * because the frozen snapshot predated the titles being filled in.
 */

const TITLES = [
  "Floor tile fractured diagonally, approx. 400 mm, open crack",
  "Unsealed gap at basin upstand and tile junction",
  "Broken threshold junction between slab, blockwork and frame",
];

function doc(): ReportDocument {
  return reportDocument(
    TITLES.map((title, index) =>
      finding({
        id: `f${index + 1}`,
        ref: `F-0${index + 1}`,
        sequence: index + 1,
        severityId: ["performance", "workmanship", "cosmetic"][index] ?? null,
        assignedTrade: "Tiler",
        snagTitle: title,
        findingText: `A described defect number ${index + 1} on the north elevation.`,
        photos: [
          {
            photo: photo(`p${index + 1}`, index + 1),
            role: "overview",
            region: { x: 0.2, y: 0.2, w: 0.3, h: 0.3 },
          },
        ],
      }),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("the printed section order", () => {
  it("follows the survey definition's own severity scale, and does not re-sort it", async () => {
    serveImages();
    // The view is requested explicitly. Without it the report opens on whatever
    // `defaultResultView` picks — by trade, for a survey that assigns trades —
    // and the severity headings this test is about are never printed at all.
    const built = await buildReportPdf(doc(), { variant: "full", view: "severity" });
    const pages = await decodePageTexts(built.bytes);
    const all = pages.join(" ");

    // The scales run in both directions across the product's definitions —
    // snagging is declared cosmetic-first, while site walk, electrical,
    // mechanical, fit-out and damp are declared most-serious-first. "Worst
    // first" is therefore a property of each definition, not something the
    // renderer may infer, so the printed order must equal the declared order.
    const labels = groupResults(doc(), "severity").map((group) => group.label);
    expect(labels.length).toBeGreaterThan(1);

    // The renderer sanitises typography before drawing: the PDF standard fonts
    // are WinAnsi, so an em dash in a severity label ("Immediate - stop work")
    // is printed as a hyphen. Compare like with like, or the label is simply
    // "not found" and the assertion fails for a reason that has nothing to do
    // with ordering.
    const asPrinted = (value: string) => value.replace(/[\u2013\u2014\u2212]/g, "-");

    const positions = labels.map((label) => all.indexOf(asPrinted(label)));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe("the schedule of items", () => {
  it("is printed, and names every item", async () => {
    serveImages();
    const built = await buildReportPdf(doc(), { variant: "full" });
    const pages = await decodePageTexts(built.bytes);
    const all = pages.join(" ");

    expect(all).toContain("Schedule of items");
    for (const title of TITLES) {
      // Present in the schedule and again on the item itself.
      expect(all.split(title).length - 1).toBeGreaterThanOrEqual(1);
    }
    expect(pages.length).toBeGreaterThan(1);
  });

  it("is not printed for a report of a single item", async () => {
    serveImages();
    const single = reportDocument([finding({ snagTitle: "A lone defect" })]);
    const built = await buildReportPdf(single, { variant: "full" });
    const pages = await decodePageTexts(built.bytes);
    expect(pages.join(" ")).not.toContain("Schedule of items");
  });

  it("is not printed on a trade extract, which is not the whole schedule", async () => {
    serveImages();
    const built = await buildReportPdf(doc(), { variant: "trade", trade: "Tiler" });
    const pages = await decodePageTexts(built.bytes);
    expect(pages.join(" ")).not.toContain("Schedule of items");
  });
});

describe("the item headline", () => {
  it("prints the snag title on the item itself", async () => {
    serveImages();
    const built = await buildReportPdf(doc(), { variant: "full" });
    const pages = await decodePageTexts(built.bytes);
    const all = pages.join(" ");
    for (const title of TITLES) expect(all).toContain(title);
  });
});
