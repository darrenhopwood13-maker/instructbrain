import { describe, expect, it } from "vitest";
import { MAX_FIX_AGE_MS, mergeProvenance, stampFor } from "@/lib/photos/device-provenance";
import { readFileSync } from "node:fs";

const t = Date.parse("2026-09-26T10:00:00Z");

describe("in-app camera provenance", () => {
  it("records time and a fresh location", () => {
    const s = stampFor(t, { lat: 51.5, lng: -0.1, accuracy: 8.4, at: t - 1000 });
    expect(s).toEqual({ capturedAt: "2026-09-26T10:00:00.000Z", gpsLat: 51.5, gpsLng: -0.1, accuracyM: 8 });
  });
  it("never attributes a stale or missing fix", () => {
    expect(stampFor(t, null).gpsLat).toBeNull();
    expect(stampFor(t, { lat: 1, lng: 1, accuracy: 5, at: t - MAX_FIX_AGE_MS - 1 }).gpsLat).toBeNull();
  });
  it("EXIF wins over the device stamp", () => {
    const exif = { capturedAt: "2020-01-01T00:00:00Z", gpsLat: 1, gpsLng: 2 };
    expect(mergeProvenance(exif, stampFor(t, { lat: 9, lng: 9, accuracy: 1, at: t }))).toEqual(exif);
    const empty = { capturedAt: null, gpsLat: null, gpsLng: null };
    expect(mergeProvenance(empty, stampFor(t, null)).capturedAt).toBe("2026-09-26T10:00:00.000Z");
  });
});

describe("report branding", () => {
  it("carries only the instructBrain credit, no family wording", () => {
    for (const f of ["src/lib/report/pdf.server.ts", "src/lib/compliance/pack.server.ts", "src/components/report/report-document-view.tsx", "src/lib/brand.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src.toLowerCase()).not.toContain("instructsite family");
    }
    expect(readFileSync("src/lib/brand.ts", "utf8")).toContain("instructBrain · AN INSTRUCTSITE COMPANY");
  });
});
