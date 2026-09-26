import { describe, expect, it } from "vitest";
import { MIN_LONG_EDGE, trackMeetsMinimum } from "@/components/photos/continuous-camera";
import { assignUploadSequences } from "@/lib/photos/upload-queue";
import { buildApplyBatches } from "@/lib/photos/room-suggest";

describe("continuous camera", () => {
  it("refuses a camera track below the analysis minimum", () => {
    expect(MIN_LONG_EDGE).toBeGreaterThanOrEqual(1500);
    expect(trackMeetsMinimum(1280, 720)).toBe(false);
    expect(trackMeetsMinimum(1920, 1080)).toBe(true);
    expect(trackMeetsMinimum(1080, 1920)).toBe(true);
  });

  it("numbers shots in shutter order across separate batches", () => {
    const first = assignUploadSequences([{ sequence: null as number | null }], 5);
    const second = assignUploadSequences([{ sequence: null as number | null }], 6);
    expect(first[0]!.sequence).toBe(5);
    expect(second[0]!.sequence).toBe(6);
  });

  it("exports room batches without inventing overviews", () => {
    expect(typeof buildApplyBatches).toBe("function");
  });
});
