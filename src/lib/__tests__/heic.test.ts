import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isIsobmffImage, readProvenance } from "@/lib/photos/exif";
import { modelReadableFromBytes } from "@/lib/photos/analysis-derivative";
import {
  ThumbnailNotAnalysableError,
  analysisPath,
  analysisSourcePath,
  isThumbnailPath,
  originalPath,
  thumbnailPath,
} from "@/lib/photos/storage-paths";

/* ------------------------------------------------------------------ */
/* Fixtures — real byte layouts, built by hand                         */
/* ------------------------------------------------------------------ */

/** The same TIFF block the JPEG tests use: capture time + GPS + dimensions. */
function tiffBlock(): Uint8Array {
  const buffer = new ArrayBuffer(260);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const LE = true;

  view.setUint16(0, 0x4949, false);
  view.setUint16(2, 0x002a, LE);
  view.setUint32(4, 8, LE);

  view.setUint16(8, 2, LE);
  view.setUint16(10, 0x8769, LE);
  view.setUint16(12, 4, LE);
  view.setUint32(14, 1, LE);
  view.setUint32(18, 38, LE);
  view.setUint16(22, 0x8825, LE);
  view.setUint16(24, 4, LE);
  view.setUint32(26, 1, LE);
  view.setUint32(30, 100, LE);
  view.setUint32(34, 0, LE);

  view.setUint16(38, 3, LE);
  view.setUint16(40, 0x9003, LE);
  view.setUint16(42, 2, LE);
  view.setUint32(44, 20, LE);
  view.setUint32(48, 80, LE);
  view.setUint16(52, 0xa002, LE);
  view.setUint16(54, 4, LE);
  view.setUint32(56, 1, LE);
  view.setUint32(60, 4032, LE);
  view.setUint16(64, 0xa003, LE);
  view.setUint16(66, 4, LE);
  view.setUint32(68, 1, LE);
  view.setUint32(72, 3024, LE);
  view.setUint32(76, 0, LE);

  const stamp = "2026:03:14 09:41:22\0";
  for (let i = 0; i < stamp.length; i += 1) bytes[80 + i] = stamp.charCodeAt(i);

  view.setUint16(100, 4, LE);
  view.setUint16(102, 0x0001, LE);
  view.setUint16(104, 2, LE);
  view.setUint32(106, 2, LE);
  bytes[110] = "N".charCodeAt(0);
  view.setUint16(114, 0x0002, LE);
  view.setUint16(116, 5, LE);
  view.setUint32(118, 3, LE);
  view.setUint32(122, 154, LE);
  view.setUint16(126, 0x0003, LE);
  view.setUint16(128, 2, LE);
  view.setUint32(130, 2, LE);
  bytes[134] = "W".charCodeAt(0);
  view.setUint16(138, 0x0004, LE);
  view.setUint16(140, 5, LE);
  view.setUint32(142, 3, LE);
  view.setUint32(146, 178, LE);
  view.setUint32(150, 0, LE);

  const rational = (offset: number, values: Array<[number, number]>) => {
    values.forEach(([numerator, denominator], index) => {
      view.setUint32(offset + index * 8, numerator, LE);
      view.setUint32(offset + index * 8 + 4, denominator, LE);
    });
  };
  rational(154, [
    [51, 1],
    [30, 1],
    [30, 1],
  ]);
  rational(178, [
    [0, 1],
    [7, 1],
    [12, 1],
  ]);

  return bytes;
}

function box(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  new DataView(out.buffer).setUint32(0, out.length, false);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/**
 * A minimal but structurally real HEIC: ftyp + meta(iinf/iloc/iprp) + mdat
 * holding the Exif item. Built by hand so the container walk is exercised
 * against actual bytes rather than a mocked library.
 */
function heicFixture(brand = "heic"): ArrayBuffer {
  const tiff = tiffBlock();
  const exifItem = concat([new Uint8Array([0, 0, 0, 0]), tiff]); // 4-byte header offset

  const ftypPayload = new Uint8Array(12);
  for (let i = 0; i < 4; i += 1) ftypPayload[i] = brand.charCodeAt(i);
  const ftyp = box("ftyp", ftypPayload);

  // infe (version 2): id 1, type "Exif"
  const infePayload = new Uint8Array(12);
  const infeView = new DataView(infePayload.buffer);
  infeView.setUint8(0, 2);
  infeView.setUint16(4, 1, false); // item id
  infeView.setUint16(6, 0, false); // protection index
  for (let i = 0; i < 4; i += 1) infePayload[8 + i] = "Exif".charCodeAt(i);
  const infe = box("infe", infePayload);

  const iinfPayload = concat([new Uint8Array([0, 0, 0, 0, 0, 1]), infe]); // v0 + count 1
  const iinf = box("iinf", iinfPayload);

  // ispe: primary image size
  const ispePayload = new Uint8Array(12);
  const ispeView = new DataView(ispePayload.buffer);
  ispeView.setUint32(4, 4032, false);
  ispeView.setUint32(8, 3024, false);
  const ipco = box("ipco", box("ispe", ispePayload));
  const iprp = box("iprp", ipco);

  // iloc v1, offset_size 4, length_size 4, base_offset_size 0, index_size 0
  const ilocPayload = new Uint8Array(24);
  const ilocView = new DataView(ilocPayload.buffer);
  ilocView.setUint8(0, 1); // version
  ilocView.setUint8(4, 0x44); // offset_size 4, length_size 4
  ilocView.setUint8(5, 0x00);
  ilocView.setUint16(6, 1, false); // item count
  ilocView.setUint16(8, 1, false); // item id
  ilocView.setUint16(10, 0, false); // construction method
  ilocView.setUint16(12, 0, false); // data reference index
  ilocView.setUint16(14, 1, false); // extent count
  // extent offset patched below once the layout is known
  ilocView.setUint32(20, exifItem.length, false);
  const iloc = box("iloc", ilocPayload);

  const metaPayload = concat([new Uint8Array([0, 0, 0, 0]), iinf, iloc, iprp]);
  const meta = box("meta", metaPayload);
  const mdat = box("mdat", exifItem);

  const exifAbsolute = ftyp.length + meta.length + 8;
  ilocView.setUint32(16, exifAbsolute, false);
  // rebuild iloc bytes inside meta (same length, so offsets are unchanged)
  const rebuiltIloc = box("iloc", ilocPayload);
  const rebuiltMeta = box(
    "meta",
    concat([new Uint8Array([0, 0, 0, 0]), iinf, rebuiltIloc, iprp]),
  );

  return concat([ftyp, rebuiltMeta, mdat]).buffer as ArrayBuffer;
}

/* ------------------------------------------------------------------ */

describe("HEIC / HEIF provenance", () => {
  it("reads capture time and GPS from a HEIC container using the same TIFF reader", () => {
    const provenance = readProvenance(heicFixture());
    expect(provenance.capturedAt).toBe("2026-03-14T09:41:22.000Z");
    expect(provenance.gpsLat).toBeCloseTo(51.508333, 5);
    expect(provenance.gpsLng).toBeCloseTo(-0.12, 5);
    expect(provenance.width).toBe(4032);
    expect(provenance.height).toBe(3024);
  });

  it("detects the container by ftyp brand, never by file extension", () => {
    for (const brand of ["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1", "avif"]) {
      expect(isIsobmffImage(heicFixture(brand))).toBe(true);
    }
    expect(isIsobmffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer)).toBe(false);
  });

  it("yields all-null provenance for an unparseable container and never a fabricated date", () => {
    const broken = new Uint8Array(heicFixture());
    broken.fill(0, 40); // shred everything after ftyp
    const provenance = readProvenance(broken.buffer as ArrayBuffer);
    expect(provenance.capturedAt).toBeNull();
    expect(provenance.gpsLat).toBeNull();
    expect(provenance.gpsLng).toBeNull();
    expect(provenance.width).toBeNull();
    expect(provenance.height).toBeNull();
  });
});

describe("analysis derivative", () => {
  it("only transcodes formats a vision model cannot read", () => {
    expect(modelReadableFromBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]).buffer)).toBe(true);
    expect(modelReadableFromBytes(heicFixture())).toBe(false);
  });

  it("produces a derivative with IDENTICAL pixel dimensions to its source", async () => {
    const module = await import("@/lib/photos/analysis-derivative");
    const source = { width: 4032, height: 3024 };
    const drawn: Array<{ width: number; height: number }> = [];

    // Stub the browser decode/encode surface; the assertion is that the module
    // carries the source dimensions through with no cap whatsoever.
    const globalAny = globalThis as unknown as Record<string, unknown>;
    globalAny["createImageBitmap"] = async () => ({ ...source, close: () => {} });
    globalAny["OffscreenCanvas"] = class {
      width: number;
      height: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        drawn.push({ width, height });
      }
      getContext() {
        return { drawImage: () => {} };
      }
      async convertToBlob() {
        return new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" });
      }
    };
    globalAny["document"] = { createElement: () => ({}) };

    const derivative = await module.createAnalysisDerivative(new Blob([new Uint8Array([1])]));
    expect(derivative).not.toBeNull();
    expect(derivative?.width).toBe(source.width);
    expect(derivative?.height).toBe(source.height);
    expect(drawn[0]).toEqual(source);
    expect(module.ANALYSIS_JPEG_QUALITY).toBeGreaterThanOrEqual(0.95);

    delete globalAny["createImageBitmap"];
    delete globalAny["OffscreenCanvas"];
    delete globalAny["document"];
  });

  it("never imports the thumbnail module — the downscaler must stay unreachable from here", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/photos/analysis-derivative.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["'][^"']*thumbnail/);
    expect(source).not.toMatch(/import\(["'][^"']*thumbnail/);
    expect(source).not.toMatch(/maxEdge/);
  });
});

describe("analysis source resolution", () => {
  const org = "org-1";
  const report = "rep-1";

  it("prefers the analysis derivative when one exists", () => {
    const photo = {
      storage_path: originalPath(org, report, "IMG_0042-abc.heic"),
      thumbnail_path: thumbnailPath(org, report, "IMG_0042-abc.heic"),
      analysis_path: analysisPath(org, report, "IMG_0042-abc.heic"),
    };
    expect(analysisSourcePath(photo)).toBe(photo.analysis_path);
    expect(isThumbnailPath(analysisSourcePath(photo))).toBe(false);
  });

  it("passes a JPEG source through untouched — no derivative is ever made", () => {
    const photo = {
      storage_path: originalPath(org, report, "IMG_0043-def.jpg"),
      thumbnail_path: thumbnailPath(org, report, "IMG_0043-def.jpg"),
      analysis_path: null,
    };
    expect(analysisSourcePath(photo)).toBe(photo.storage_path);
  });

  it("throws on a thumbnail path regardless of which column it came from", () => {
    const thumb = thumbnailPath(org, report, "x.heic");
    expect(() => analysisSourcePath({ storage_path: thumb })).toThrow(ThumbnailNotAnalysableError);
    expect(() =>
      analysisSourcePath({ storage_path: originalPath(org, report, "x.heic"), analysis_path: thumb }),
    ).toThrow(ThumbnailNotAnalysableError);
  });
});
