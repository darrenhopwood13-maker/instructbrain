import { describe, expect, it, vi } from "vitest";
import { readProvenance, parseExifDate } from "@/lib/photos/exif";
import {
  ThumbnailNotAnalysableError,
  analysisSourcePath,
  collisionSafeFilename,
  isThumbnailPath,
  originalPath,
  sanitiseFilename,
  thumbnailPath,
} from "@/lib/photos/storage-paths";
import { overallProgress, runUploadQueue } from "@/lib/photos/upload-queue";
import { detachPhoto, nextRef } from "@/lib/finding-refs";
import type { Finding } from "@/lib/mock-data";

/* ------------------------------------------------------------------ */
/* Synthetic JPEGs                                                     */
/* ------------------------------------------------------------------ */

function jpegWithExif(): ArrayBuffer {
  // TIFF block, little endian, built by hand so the parser is tested against
  // a real byte layout rather than a mocked library.
  const tiff = new ArrayBuffer(260);
  const view = new DataView(tiff);
  const bytes = new Uint8Array(tiff);
  const LE = true;

  view.setUint16(0, 0x4949, false); // "II"
  view.setUint16(2, 0x002a, LE);
  view.setUint32(4, 8, LE);

  // IFD0: ExifIFD pointer + GPSIFD pointer
  view.setUint16(8, 2, LE);
  view.setUint16(10, 0x8769, LE);
  view.setUint16(12, 4, LE);
  view.setUint32(14, 1, LE);
  view.setUint32(18, 38, LE);
  view.setUint16(22, 0x8825, LE);
  view.setUint16(24, 4, LE);
  view.setUint32(26, 1, LE);
  view.setUint32(30, 100, LE);
  view.setUint32(34, 0, LE); // no next IFD

  // Exif IFD at 38: DateTimeOriginal, PixelXDimension, PixelYDimension
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

  // GPS IFD at 100
  view.setUint16(100, 4, LE);
  view.setUint16(102, 0x0001, LE); // lat ref
  view.setUint16(104, 2, LE);
  view.setUint32(106, 2, LE);
  bytes[110] = "N".charCodeAt(0);
  view.setUint16(114, 0x0002, LE); // lat
  view.setUint16(116, 5, LE);
  view.setUint32(118, 3, LE);
  view.setUint32(122, 154, LE);
  view.setUint16(126, 0x0003, LE); // lng ref
  view.setUint16(128, 2, LE);
  view.setUint32(130, 2, LE);
  bytes[134] = "W".charCodeAt(0);
  view.setUint16(138, 0x0004, LE); // lng
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

  const app1Length = 2 + 6 + tiff.byteLength;
  const out = new Uint8Array(2 + 2 + app1Length + 2);
  const outView = new DataView(out.buffer);
  outView.setUint16(0, 0xffd8, false); // SOI
  outView.setUint16(2, 0xffe1, false); // APP1
  outView.setUint16(4, app1Length, false);
  out.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 6); // "Exif\0\0"
  out.set(new Uint8Array(tiff), 12);
  outView.setUint16(out.byteLength - 2, 0xffd9, false); // EOI
  return out.buffer;
}

function jpegWithoutExif(): ArrayBuffer {
  const out = new Uint8Array(24);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0xffd8, false);
  view.setUint16(2, 0xffc0, false); // SOF0
  view.setUint16(4, 17, false); // length
  out[6] = 8; // precision
  view.setUint16(7, 1200, false); // height
  view.setUint16(9, 1600, false); // width
  view.setUint16(22, 0xffd9, false);
  return out.buffer;
}

/* ------------------------------------------------------------------ */

describe("EXIF provenance", () => {
  it("reads capture time, GPS and dimensions from the original bytes", () => {
    const provenance = readProvenance(jpegWithExif());
    expect(provenance.capturedAt).toBe("2026-03-14T09:41:22.000Z");
    expect(provenance.gpsLat).toBeCloseTo(51.508333, 5);
    expect(provenance.gpsLng).toBeCloseTo(-0.12, 5);
    expect(provenance.width).toBe(4032);
    expect(provenance.height).toBe(3024);
  });

  it("stores nulls when EXIF is absent and never fabricates a timestamp", () => {
    const provenance = readProvenance(jpegWithoutExif());
    expect(provenance.capturedAt).toBeNull();
    expect(provenance.gpsLat).toBeNull();
    expect(provenance.gpsLng).toBeNull();
    // Dimensions still come from the frame header — that is measured, not invented.
    expect(provenance.width).toBe(1600);
    expect(provenance.height).toBe(1200);
  });

  it("never invents a date from a malformed EXIF string", () => {
    expect(parseExifDate("not a date", null)).toBeNull();
    expect(parseExifDate("0000:00:00 00:00:00", null)).toBeNull();
    expect(parseExifDate(null, null)).toBeNull();
  });

  it("returns empty provenance for a non-JPEG buffer rather than guessing", () => {
    const provenance = readProvenance(new Uint8Array([1, 2, 3, 4]).buffer);
    expect(provenance).toEqual({
      capturedAt: null,
      gpsLat: null,
      gpsLng: null,
      width: null,
      height: null,
    });
  });
});

describe("storage paths", () => {
  const org = "11111111-1111-1111-1111-111111111111";
  const report = "22222222-2222-2222-2222-222222222222";

  it("uses the <organisation>/<report>/<filename> convention the RLS policy expects", () => {
    const path = originalPath(org, report, "roof-detail-abc123.jpg");
    expect(path).toBe(`${org}/${report}/roof-detail-abc123.jpg`);
    expect(path.split("/")[0]).toBe(org);
    expect(path.split("/")[1]).toBe(report);
  });

  it("keeps thumbnails under the same organisation prefix but a separate segment", () => {
    const thumb = thumbnailPath(org, report, "roof-detail-abc123.jpg");
    expect(thumb).toBe(`${org}/${report}/thumbnails/roof-detail-abc123.jpg`);
    expect(thumb.startsWith(`${org}/`)).toBe(true);
    expect(isThumbnailPath(thumb)).toBe(true);
    expect(isThumbnailPath(originalPath(org, report, "a.jpg"))).toBe(false);
  });

  it("generates collision-safe filenames while the original name is preserved elsewhere", () => {
    const a = collisionSafeFilename("IMG 0042 (roof).JPG");
    const b = collisionSafeFilename("IMG 0042 (roof).JPG");
    expect(a).not.toBe(b);
    expect(a.endsWith(".jpg")).toBe(true);
    expect(a).not.toContain(" ");
    expect(sanitiseFilename("../../etc/passwd")).toBe("passwd");
  });
});

describe("the AI never receives a thumbnail (invariant 3)", () => {
  const org = "org-1";
  const report = "rep-1";
  const filename = "hairline-crack-xyz.jpg";
  const photo = {
    storage_path: originalPath(org, report, filename),
    thumbnail_path: thumbnailPath(org, report, filename),
  };

  it("resolves analysis to the original object", () => {
    expect(analysisSourcePath(photo)).toBe(photo.storage_path);
  });

  it("never resolves analysis to the thumbnail path", () => {
    const resolved = analysisSourcePath(photo);
    expect(resolved).not.toBe(photo.thumbnail_path);
    expect(isThumbnailPath(resolved)).toBe(false);
    expect(resolved.includes("thumbnails")).toBe(false);
  });

  it("refuses outright if a thumbnail is passed as the source", () => {
    expect(() => analysisSourcePath({ storage_path: photo.thumbnail_path })).toThrow(
      ThumbnailNotAnalysableError,
    );
  });

  it("refuses when there is no original object", () => {
    expect(() => analysisSourcePath({ storage_path: null })).toThrow();
  });
});

describe("upload queue", () => {
  const noSleep = async () => {};

  it("never exceeds the configured concurrency across a large batch", async () => {
    let active = 0;
    let peak = 0;
    const tasks = Array.from({ length: 200 }, (_, index) => ({
      id: `photo-${index}`,
      run: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active -= 1;
        return index;
      },
    }));

    const results = await runUploadQueue(tasks, { concurrency: 5, sleep: noSleep });
    expect(results).toHaveLength(200);
    expect(results.every((result) => result.state === "done")).toBe(true);
    expect(peak).toBeLessThanOrEqual(5);
  });

  it("retries a failing upload with backoff and reports the error when it never succeeds", async () => {
    const flaky = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connection lost during upload."))
      .mockResolvedValueOnce("ok");
    const doomed = vi.fn().mockRejectedValue(new Error("413 too large"));

    const results = await runUploadQueue(
      [
        { id: "a", run: flaky },
        { id: "b", run: doomed },
      ],
      { concurrency: 2, maxAttempts: 3, sleep: noSleep },
    );

    expect(results[0]?.state).toBe("done");
    expect(flaky).toHaveBeenCalledTimes(2);
    expect(results[1]?.state).toBe("error");
    expect(results[1]?.error?.message).toContain("413");
    expect(doomed).toHaveBeenCalledTimes(3);
  });

  it("resumes: work already persisted is not uploaded again", async () => {
    const run = vi.fn().mockResolvedValue("uploaded");
    const results = await runUploadQueue(
      [
        { id: "already-there", run, isComplete: () => true },
        { id: "new", run },
      ],
      { concurrency: 2, sleep: noSleep },
    );

    expect(run).toHaveBeenCalledTimes(1);
    expect(results.every((result) => result.state === "done")).toBe(true);
  });

  it("reports overall progress across the batch", () => {
    expect(
      overallProgress([
        { id: "a", state: "done", progress: 1, attempts: 1 },
        { id: "b", state: "running", progress: 0.5, attempts: 1 },
      ]),
    ).toBeCloseTo(0.75);
  });
});

describe("photo deletion never renumbers references (invariant 4)", () => {
  const findings: Finding[] = [
    {
      id: "f1",
      ref: "F-001",
      title: "A",
      location: "L",
      trade: "",
      status: "x",
      aiDrafted: true,
      confirmed: false,
      isConfidential: false,
      photoIds: ["p-1", "p-2"],
      note: "",
    },
    {
      id: "f2",
      ref: "F-002",
      title: "B",
      location: "L",
      trade: "",
      status: "x",
      aiDrafted: true,
      confirmed: false,
      isConfidential: false,
      photoIds: ["p-2"],
      note: "",
    },
    {
      id: "f3",
      ref: "F-003",
      title: "C",
      location: "L",
      trade: "",
      status: "x",
      aiDrafted: true,
      confirmed: false,
      isConfidential: false,
      photoIds: ["p-3"],
      note: "",
    },
  ];

  it("detaches the photo and leaves every ref untouched", () => {
    const after = detachPhoto(findings, "p-2");
    expect(after.map((finding) => finding.ref)).toEqual(["F-001", "F-002", "F-003"]);
    expect(after[1]?.photoIds).toEqual([]);
  });

  it("issues the next ref from the highest ever issued, not the array length", () => {
    const remaining = ["F-001", "F-003"]; // F-002 was deleted
    expect(nextRef(remaining)).toBe("F-004");
  });
});
