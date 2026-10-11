import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReportPdf } from "@/lib/report/pdf.server";
import type { DocRegion, ReportDocument } from "@/lib/report/document";
import {
  body,
  decodePageTexts,
  finding,
  marker,
  pagesOf,
  photo,
  reportDocument,
  serveImages,
} from "@/lib/__tests__/support/pdf-fixtures";

/**
 * Where a photograph carrying several items is printed.
 *
 * The rule has been through two rounds, and this file records both so the next
 * person does not re-litigate them.
 *
 *  - Originally every plate sat in ONE BLOCK at the front of the report. Measured
 *    on the live 58-item document: photographs filled pages 1 to 10 and the first
 *    finding appeared on page 10. Dal: "practically impossible to review
 *    anything… anyone receiving a report like this would throw it away."
 *  - Then each plate moved to sit immediately above the first entry referring to
 *    it. Better — but that still left the photograph using 45% of the page width
 *    with a blank column beside it.
 *  - ⭐ Now (Dal, 8 Oct 2026): "with multiple findings in one photo we have photo
 *    per page with the multiple findings listed by pin number below." The
 *    photograph owns a page, fills the width, and the items on it are listed
 *    underneath in pin order.
 *
 * So the assertion is no longer "same page as its first item" — the items
 * deliberately follow it. What is asserted is that the page belongs to the
 * photograph: the index is on it, and no full entry is.
 */

const REGION: DocRegion = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
const ITEMS = 8;
const SHARED_FROM = 7;
const SHARED_SEQUENCE = 3;

/** Items 1-6 stand alone and are long; items 7 and 8 share one photograph. */
function plateReport(): ReportDocument {
  return reportDocument(
    Array.from({ length: ITEMS }, (_, index) => {
      const n = index + 1;
      const shared = n >= SHARED_FROM;
      return finding({
        id: `f${n}`,
        ref: `F-${String(n).padStart(3, "0")}`,
        findingText: body(n, shared ? 20 : 200),
        photos: shared
          ? [{ photo: photo("p-shared", SHARED_SEQUENCE), role: "primary", region: REGION }]
          : [],
      });
    }),
  );
}

const CAPTION = `Photograph ${SHARED_SEQUENCE} - 2 items on this photograph`;
const INDEX_HEADING = "Findings on this photograph";

async function build() {
  serveImages();
  const built = await buildReportPdf(plateReport(), { variant: "full", includePhotos: true });
  return decodePageTexts(built.bytes);
}

function platePageOf(pages: string[]): number {
  const at = pages.findIndex((text) => text.includes(CAPTION));
  expect(at).toBeGreaterThanOrEqual(0);
  return at;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the page a shared photograph is given", () => {
  it("belongs to the photograph: the index is on it, no full entry is", async () => {
    const pages = await build();
    const page = pages[platePageOf(pages)] ?? "";

    // The items on it are listed underneath, in the report's own order. No pin
    // number: the plate carries no marks, so quoting one points at nothing.
    expect(page).toContain(INDEX_HEADING);
    expect(page).toContain("Item 7 - ");
    expect(page).toContain("Item 8 - ");
    expect(page.indexOf("Item 7 - ")).toBeLessThan(page.indexOf("Item 8 - "));
    expect(page).not.toMatch(/Pin \d+/);

    // And it is the photograph's page, not an entry's: every entry in the
    // schedule prints a Status chip, and this page has none.
    expect(page).not.toContain("Status:");
  });

  it("is not the first page of the report", async () => {
    const pages = await build();
    expect(pages.length).toBeGreaterThan(1);
    expect(platePageOf(pages)).toBeGreaterThan(0);
  });

  it("is followed by the entries it belongs to", async () => {
    const pages = await build();
    const pageOf = pagesOf([marker("END", SHARED_FROM), marker("END", SHARED_FROM + 1)], pages);

    // Both were found, so a miss cannot be mistaken for correct placement.
    expect(pageOf.size).toBe(2);
    // The photograph comes first; the full entries for it come after.
    expect(pageOf.get(marker("END", SHARED_FROM))).toBeGreaterThan(platePageOf(pages));
    expect(pageOf.get(marker("END", SHARED_FROM + 1))).toBeGreaterThan(platePageOf(pages));
  });

  it("is still printed exactly once", async () => {
    const pages = await build();
    const times = pages.reduce((total, text) => total + text.split(CAPTION).length - 1, 0);
    expect(times).toBe(1);
  });
});

/**
 * The phase E rule, one level up: a photograph whose items carry no recorded area
 * has no pins, so nothing printed about it may claim one.
 *
 * Found in the real published document on 8 Oct 2026 — a photograph carrying two
 * unmarked items, captioned "the marked area indicates the item", with both rows
 * saying it was "printed on its own page with its pins".
 */
function unmarkedReport(): ReportDocument {
  return reportDocument(
    Array.from({ length: 10 }, (_, index) => {
      const n = index + 1;
      return finding({
        id: `f${n}`,
        ref: `F-${String(n).padStart(3, "0")}`,
        findingText: body(n, 20),
        photos:
          n >= 9 ? [{ photo: photo("p-unmarked", 5), role: "primary", region: null }] : [],
      });
    }),
  );
}

describe("a shared photograph where no item has a recorded area", () => {
  it("is printed, but never claims a marked area or a pin", async () => {
    serveImages();
    const built = await buildReportPdf(unmarkedReport(), {
      variant: "full",
      includePhotos: true,
    });
    const pages = await decodePageTexts(built.bytes);
    const text = pages.join("\n");

    // The photograph is still shown: the reader needs to see what the items are about.
    expect(text).toContain("Photograph 5 - 2 items on this photograph");
    // But nothing printed about it may point at a pin, because there is not one.
    expect(text).toContain("printed as it was taken and unmarked");
    expect(text).not.toContain("the marked area indicates the item");
    expect(text).not.toContain("with its pins");
    expect(text).not.toMatch(/Pin \d+ - /);
  });
});
