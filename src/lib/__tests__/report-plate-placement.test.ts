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
 * Readability phase B: a photograph carrying several items is drawn immediately
 * above the FIRST entry that refers to it.
 *
 * It used to be drawn up front in one block with every other plate. Measured on
 * the live 58-item report: photographs filled pages 1 to 10 and the first finding
 * appeared on page 10, so reviewing it meant flipping between a picture at the
 * front and the item it belongs to nine pages later. Dal: "practically
 * impossible to review anything… anyone receiving a report like this would throw
 * it away."
 *
 * The property asserted is placement, which is the whole point: the photograph's
 * caption lands on the same page as the first item that points at it, and not on
 * the first page of the document.
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("where a shared photograph is printed", () => {
  it("sits on the same page as the first entry that refers to it", async () => {
    serveImages();
    const built = await buildReportPdf(plateReport(), { variant: "full", includePhotos: true });
    const pages = await decodePageTexts(built.bytes);

    const firstReference = marker("START", SHARED_FROM);
    const pageOf = pagesOf([CAPTION, firstReference], pages);

    // Both were found, so a miss cannot be mistaken for correct placement.
    expect(pageOf.has(CAPTION)).toBe(true);
    expect(pageOf.has(firstReference)).toBe(true);

    expect(pageOf.get(CAPTION)).toBe(pageOf.get(firstReference));
  });

  it("is not printed at the front of the report", async () => {
    serveImages();
    const built = await buildReportPdf(plateReport(), { variant: "full", includePhotos: true });
    const pages = await decodePageTexts(built.bytes);
    const pageOf = pagesOf([CAPTION], pages);

    // Six long items run to more than one page, so a photograph placed with its
    // items cannot be on page 1. Under the old all-at-once block it was.
    expect(pages.length).toBeGreaterThan(1);
    expect(pageOf.get(CAPTION)).toBeGreaterThan(0);
  });

  it("is still printed exactly once", async () => {
    serveImages();
    const built = await buildReportPdf(plateReport(), { variant: "full", includePhotos: true });
    const pages = await decodePageTexts(built.bytes);

    const times = pages.reduce((total, text) => total + text.split(CAPTION).length - 1, 0);
    expect(times).toBe(1);
  });
});
