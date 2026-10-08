import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReportPdf, shouldBreakBeforeEntry } from "@/lib/report/pdf.server";
import type { ReportDocument } from "@/lib/report/document";
import {
  body,
  decodePageTexts,
  finding,
  marker,
  pagesOf,
  reportDocument,
} from "@/lib/__tests__/support/pdf-fixtures";

/**
 * Readability phase A: an item is never sliced by a page break.
 *
 * A sentence that stops at the foot of one page and resumes at the top of the
 * next is the single thing that makes a generated document look careless. The
 * writer used to check for space one line at a time, so that is exactly what it
 * did. Measured on a real report before any of this: four page boundaries cut a
 * passage in half, and page 14 ended "…The image does not establish whether the
 * damp is recent, historic or ongoing," with page 15 resuming "nor whether the
 * wall is a retaining element."
 *
 * How it is proved. Every item carries a unique token at each end of its prose;
 * if both land on the same page, nothing sliced it. The decoder is checked
 * first, because a decoder returning "" makes every other assertion pass for the
 * wrong reason — which is exactly how the first version of this test lied.
 *
 * The fixture matters as much as the assertion. The first version used twelve
 * SHORT items and PASSED with the page break disabled: nothing ever straddled,
 * so it proved nothing whatsoever. Ten items of 260 words slice two of them
 * without the fix (item 2 across pages 1-2, item 7 across pages 3-4) and none
 * with it. A test for "this never happens" has to be shown happening.
 */

const ITEMS = 10;

function longReport(items: number): ReportDocument {
  return reportDocument(
    Array.from({ length: items }, (_, index) => {
      const n = index + 1;
      return finding({
        id: `f${n}`,
        ref: `F-${String(n).padStart(3, "0")}`,
        findingText: body(n, 260),
      });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("whether an entry starts on a fresh page", () => {
  it("leaves it where it is when it fits", () => {
    expect(shouldBreakBeforeEntry(200, 400, 700)).toBe(false);
  });

  it("moves it when it would be sliced and a fresh page would hold it", () => {
    expect(shouldBreakBeforeEntry(200, 150, 700)).toBe(true);
  });

  it("does not move an entry longer than a whole page", () => {
    // It cannot be kept whole anywhere, so moving it would waste this page and
    // then still flow. It stays, and it flows.
    expect(shouldBreakBeforeEntry(800, 400, 700)).toBe(false);
  });

  it("leaves an entry that exactly fills the room", () => {
    expect(shouldBreakBeforeEntry(400, 400, 700)).toBe(false);
  });
});

describe("no item is sliced across a page break", () => {
  it("keeps every item's prose on one page", async () => {
    const built = await buildReportPdf(longReport(ITEMS), { variant: "full", includePhotos: false });
    const pages = await decodePageTexts(built.bytes);

    // The instrument works. If this fails, the decoder is broken and nothing
    // below means anything.
    expect(pages.join(" ")).toContain(marker("START", 1));

    const needles: string[] = [];
    for (let n = 1; n <= ITEMS; n++) {
      needles.push(marker("START", n), marker("END", n));
    }
    const pageOf = pagesOf(needles, pages);

    // Every token was found. A missing one must fail loudly rather than be read
    // as "not sliced".
    expect(pageOf.size).toBe(ITEMS * 2);

    const sliced: string[] = [];
    for (let n = 1; n <= ITEMS; n++) {
      const start = pageOf.get(marker("START", n));
      const end = pageOf.get(marker("END", n));
      if (start !== end) sliced.push(`item ${n} (page ${start} to page ${end})`);
    }
    expect(sliced).toEqual([]);

    // And the document really did run to more than one page, so the assertions
    // above were not satisfied by everything landing on a single sheet.
    expect(pages.length).toBeGreaterThan(1);
  });
});
