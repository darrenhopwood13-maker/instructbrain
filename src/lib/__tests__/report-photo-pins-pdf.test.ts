import { afterEach, describe, expect, it, vi } from "vitest";
import { deflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { buildReportPdf, cropPlacement } from "@/lib/report/pdf.server";
import type { DocFinding, DocPhoto, DocRegion, ReportDocument } from "@/lib/report/document";
import { siteWalkDefinition, snapshotOf } from "@/lib/survey-definitions";

/**
 * Job 3, the PDF side: a photograph carrying several items prints ONCE with its
 * pins, and each item prints a crop of its own patch instead of another
 * full-width copy of the same frame.
 *
 * What is asserted, and what is not. The content streams are compressed, so a
 * text search finds nothing and a `not.toContain` assertion would pass on an
 * unreadable page for the wrong reason. So:
 *
 *  - the crop geometry is asserted as arithmetic (cropPlacement), which is where
 *    a wrong sign or a stretched patch would actually be;
 *  - the rest drives the REAL drawing path with real image bytes and asserts the
 *    document still builds, is still a loadable PDF, and how many pages it takes.
 *    A crash or a corrupt document from the hand-written operators fails here,
 *    which is the failure mode that matters — this PDF is what a client gets.
 */

const REGION: DocRegion = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };

/* A real, valid PNG, built here so the test needs no fixture file. */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.slice(4, 8 + data.length)));
  return out;
}

/** A photograph-sized PNG, so the page maths is exercised at realistic size. */
function png(width: number, height: number) {
  const stride = width * 3 + 1;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * stride + 1 + x * 3;
      raw[at] = 180;
      raw[at + 1] = 60;
      raw[at + 2] = 60;
    }
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", new Uint8Array(deflateSync(raw))),
    pngChunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const PHOTO_BYTES = png(1200, 900);

function serveImages() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(PHOTO_BYTES, { status: 200 })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function photo(id: string, sequence: number): DocPhoto {
  return {
    id,
    sequence,
    filename: `${id}.png`,
    capturedAt: "2026-10-01T09:00:00Z",
    url: `https://example.test/${id}.png`,
    thumbUrl: `https://example.test/${id}-thumb.png`,
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
    findingText: overrides.findingText ?? "A described defect on the north elevation.",
    snagTitle: null,
    remedialText: "Make good.",
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

/** Six items, either all on one photograph or each on its own. */
function sixItems(shared: boolean): ReportDocument {
  return doc(
    Array.from({ length: 6 }, (_, index) =>
      finding({
        id: `f${index + 1}`,
        ref: `F-00${index + 1}`,
        photos: [
          {
            photo: photo(shared ? "p1" : `p${index + 1}`, shared ? 4 : index + 1),
            role: "primary",
            region: REGION,
          },
        ],
      }),
    ),
  );
}

async function pageCount(bytes: Uint8Array): Promise<number> {
  const loaded = await PDFDocument.load(bytes);
  return loaded.getPageCount();
}

describe("where a patch lands inside the crop frame", () => {
  const image = { width: 1200, height: 900 };

  it("keeps the image's proportions — one scale, never stretched", () => {
    const place = cropPlacement(image, REGION, 200, 130);
    expect(place.drawWidth / place.drawHeight).toBeCloseTo(image.width / image.height, 6);
  });

  it("puts the patch where the frame puts it, and nowhere else", () => {
    const frameWidth = 200;
    const frameHeight = 130;
    const place = cropPlacement(image, REGION, frameWidth, frameHeight);

    // The patch's top-left corner, in frame coordinates measured from the top.
    const patchLeft = place.drawX + REGION.x * place.drawWidth;
    const patchTop = frameHeight - place.drawY - (REGION.y + REGION.h) * place.drawHeight;
    expect(patchLeft).toBeCloseTo(place.originX, 6);
    expect(patchTop).toBeCloseTo(place.originTop, 6);
    // And it fits: the patch is centred inside the frame, never overflowing it.
    expect(place.patchWidth * (place.drawWidth / image.width)).toBeLessThanOrEqual(frameWidth + 1e-6);
    expect(place.patchHeight * (place.drawHeight / image.height)).toBeLessThanOrEqual(frameHeight + 1e-6);
  });

  it("handles a patch in each corner without inverting the vertical shift", () => {
    const topLeft = cropPlacement(image, { x: 0, y: 0, w: 0.25, h: 0.25 }, 200, 130);
    const bottomLeft = cropPlacement(image, { x: 0, y: 0.75, w: 0.25, h: 0.25 }, 200, 130);
    // drawY is the image's own bottom edge. A patch at the TOP of the photograph
    // must pull the picture DOWN behind the frame, which means a lower, not a
    // higher, y. Inverting those two signs is the classic way to get this wrong.
    expect(topLeft.drawY).toBeLessThan(bottomLeft.drawY);
    // A patch already at the bottom of the photograph has nowhere further down to go.
    expect(bottomLeft.drawY).toBeGreaterThanOrEqual(0);
    // A patch touching the left edge leaves the image's left edge inside the
    // frame, extending off the right — where the clip takes over.
    expect(topLeft.drawX).toBeGreaterThanOrEqual(0);
    expect(topLeft.drawX + topLeft.drawWidth).toBeGreaterThanOrEqual(200);
  });
});

describe("the photograph carrying six items, in the printed report", () => {
  it("builds, reloads, and costs no more paper than six separate photographs", async () => {
    serveImages();

    const shared = await buildReportPdf(sixItems(true), { variant: "full", includePhotos: true });
    const separate = await buildReportPdf(sixItems(false), { variant: "full", includePhotos: true });

    // Real bytes came back: the file is a PDF, not an empty shell.
    expect(new TextDecoder().decode(shared.bytes.slice(0, 5))).toBe("%PDF-");
    const sharedPages = await pageCount(shared.bytes);
    const separatePages = await pageCount(separate.bytes);
    expect(sharedPages).toBeGreaterThan(0);
    // Measured at this size: 3 pages shared against 4 separate. Below four items
    // on one photograph the two are level, which is why this asserts "no worse"
    // rather than a saving — the saving is real at six and grows from there.
    expect(sharedPages).toBeLessThanOrEqual(separatePages);
  });

  it("survives a photograph whose region sits against the frame edge", async () => {
    serveImages();
    const document = doc([
      finding({ id: "a", ref: "F-001", photos: [{ photo: photo("p1", 4), role: "primary", region: { x: 0, y: 0, w: 0.5, h: 0.5 } }] }),
      finding({ id: "b", ref: "F-002", photos: [{ photo: photo("p1", 4), role: "primary", region: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } }] }),
    ]);
    const built = await buildReportPdf(document, { variant: "full", includePhotos: true });
    expect(await pageCount(built.bytes)).toBeGreaterThan(0);
  });

  it("still prints a photograph carrying a single item the old way", async () => {
    serveImages();
    const single = doc([
      finding({ id: "a", ref: "F-001", photos: [{ photo: photo("p1", 4), role: "primary", region: REGION }] }),
    ]);
    const built = await buildReportPdf(single, { variant: "full", includePhotos: true });
    expect(await pageCount(built.bytes)).toBeGreaterThan(0);
  });
});
