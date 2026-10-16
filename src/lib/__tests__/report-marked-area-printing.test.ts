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
 * A marked area reaches the sheet whether the photograph carries one item or
 * several.
 *
 * Dal's own reports are what exposed this: on the issued EIC-2026-10-005 the
 * surveyor had marked an area on nine of ten photographs, and the PDF printed
 * none of them. Every one of those photographs belonged to a single item, and
 * the item entry only ever drew a highlight when the photograph was SHARED
 * between items — so a hand-marked area was dropped on the floor for the
 * ordinary case, which is most photographs in most reports.
 *
 * The caption is the reason this is worth a test rather than a tweak. "the area
 * this item refers to" is a claim about where the item is, and it may only be
 * printed where somebody actually marked that area. A photograph with nothing
 * marked on it must print whole and say nothing, or the sheet promises a
 * highlight that is not there.
 */

const CROP_CAPTION = "the area this item refers to";
const CROP_NOTE = "The same photograph, with everything but this item's area faded back.";
const REGION = { x: 0.08, y: 0.52, w: 0.88, h: 0.45 };

function oneItem(region: { x: number; y: number; w: number; h: number } | null): ReportDocument {
  return reportDocument([
    finding({
      id: "f1",
      ref: "F-001",
      sequence: 1,
      findingText: body(1, 90),
      photos: [{ photo: photo("p1", 1), role: "overview", region }],
    }),
  ]);
}

/** Twenty items, each with its own photograph, each photograph marked by hand. */
function markedItems(items: number): ReportDocument {
  return reportDocument(
    Array.from({ length: items }, (_, index) => {
      const n = index + 1;
      return finding({
        id: `f${n}`,
        ref: `F-${String(n).padStart(3, "0")}`,
        sequence: n,
        snagTitle: `Defect ${n} recorded on the north elevation`,
        findingText: body(n, 120 + ((n * 37) % 170)),
        photos: [{ photo: photo(`p${n}`, n), role: "overview", region: REGION }],
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

describe("a photograph that carries one item", () => {
  it("prints the item's marked area, with the caption that explains it", async () => {
    serveImages();
    const built = await buildReportPdf(oneItem(REGION), { variant: "full" });
    const text = (await decodePageTexts(built.bytes)).join("\n");

    expect(text).toContain(CROP_CAPTION);
    expect(text).toContain(CROP_NOTE);
    expect(text).toContain(marker("START", 1));
  });

  it("claims no area when nobody marked one", async () => {
    serveImages();
    const built = await buildReportPdf(oneItem(null), { variant: "full" });
    const text = (await decodePageTexts(built.bytes)).join("\n");

    // The item still printed — otherwise the two assertions below would pass
    // for the wrong reason.
    expect(text).toContain(marker("START", 1));
    expect(text).not.toContain(CROP_CAPTION);
    expect(text).not.toContain(CROP_NOTE);
  });

  it("keeps a marked photograph on the page of the item it belongs to", async () => {
    serveImages();
    const items = 20;
    const built = await buildReportPdf(markedItems(items), { variant: "full" });
    const pages = await decodePageTexts(built.bytes);

    expect(pages.join(" ")).toContain(marker("START", 1));

    const orphans: string[] = [];
    pages.forEach((text, index) => {
      let beganHere = 0;
      for (let n = 1; n <= items; n++) if (text.includes(marker("START", n))) beganHere += 1;
      const cropsHere = count(text, CROP_NOTE);
      if (cropsHere !== beganHere) {
        orphans.push(`page ${index + 1}: ${beganHere} item(s) began, ${cropsHere} photograph(s) drawn`);
      }
    });

    expect(orphans).toEqual([]);
    expect(pages.reduce((sum, text) => sum + count(text, CROP_NOTE), 0)).toBe(items);
  });
});
