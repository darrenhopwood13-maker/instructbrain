import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReportPdf } from "@/lib/report/pdf.server";
import type { ReportDocument } from "@/lib/report/document";
import {
  body,
  decodePageTexts,
  finding,
  marker,
  photo,
  reportDocument,
  serveImages,
} from "@/lib/__tests__/support/pdf-fixtures";

/**
 * An item that carries a photograph is never torn across a page break.
 *
 * `report-item-kept-whole.test.ts` proves the prose is never sliced — but it
 * builds every document with `includePhotos: false`, so the reservation it
 * exercises is the reservation for TEXT ONLY. Every item in a real report
 * carries a photograph, and the photograph is drawn LAST, after the heading and
 * the prose are already committed to the page.
 *
 * That is how the tear happens. `drawFinding` measures the whole entry and moves
 * it to a fresh page when it would be sliced — but the crop then asks for
 * `frameHeight + 16` while the measurement only ever counted it as
 * `frameHeight + 8`. In the eight-point window between those two figures the
 * entry is judged to fit, and the photograph is then pushed to the next page on
 * its own, orphaned above the NEXT item's heading.
 *
 * On the issued SNG-2026-10-006 that is exactly what happened: item 11's
 * cracked-tile photograph was printed at the top of page 22, straight above the
 * heading for item 19, where it reads as item 19's picture.
 *
 * The assertion: on any page, the number of item photographs equals the number
 * of items that began there. Each item carries a snag title, so the shared-
 * photograph plate echoes the TITLE rather than the prose and the page markers
 * appear only in the entry itself.
 *
 * The fixture matters. Item lengths are varied deliberately: whether an entry
 * lands inside the eight-point window depends on exactly how much room is left
 * when it is reached, and a run of identically-sized items can miss it entirely.
 */

const ITEMS = 24;
const CROP_CAPTION = "A crop of the area this item refers to.";

function wordsFor(n: number): number {
  return 120 + ((n * 37) % 170);
}

function photoReport(items: number): ReportDocument {
  return reportDocument(
    Array.from({ length: items }, (_, index) => {
      const n = index + 1;
      return finding({
        id: `f${n}`,
        ref: `F-${String(n).padStart(3, "0")}`,
        sequence: n,
        // A title, so the plate lists the item by title and does not echo the
        // prose markers onto its own page.
        snagTitle: `Defect ${n} recorded on the north elevation`,
        findingText: body(n, wordsFor(n)),
        photos: [
          {
            photo: photo(`p${Math.ceil(n / 2)}`, Math.ceil(n / 2)),
            role: "overview",
            region: { x: 0.2, y: 0.2, w: 0.3, h: 0.3 },
          },
        ],
      });
    }),
  );
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("an item that carries a photograph", () => {
  it("keeps every photograph on the same page as the item it belongs to", async () => {
    serveImages();
    const built = await buildReportPdf(photoReport(ITEMS), { variant: "full" });
    const pages = await decodePageTexts(built.bytes);

    // The instrument works. If the decoder found nothing, every assertion below
    // would pass for the wrong reason.
    expect(pages.join(" ")).toContain(marker("START", 1));

    const orphans: string[] = [];
    pages.forEach((text, index) => {
      let beganHere = 0;
      for (let n = 1; n <= ITEMS; n++) if (text.includes(marker("START", n))) beganHere += 1;
      const cropsHere = count(text, CROP_CAPTION);
      if (cropsHere !== beganHere) {
        orphans.push(`page ${index + 1}: ${beganHere} item(s) began, ${cropsHere} photograph(s) drawn`);
      }
    });

    expect(orphans).toEqual([]);
    expect(pages.length).toBeGreaterThan(1);
  });

  it("draws every photograph, so the counts above are not trivially zero", async () => {
    serveImages();
    const built = await buildReportPdf(photoReport(ITEMS), { variant: "full" });
    const pages = await decodePageTexts(built.bytes);
    expect(pages.reduce((sum, text) => sum + count(text, CROP_CAPTION), 0)).toBe(ITEMS);
  });
});
