import { describe, expect, it } from "vitest";
import { EMPTY_PHOTO_STATUS, nextPhotoAction, type AnalysisStatus } from "@/lib/report/next-action";
import type { ReadinessStep } from "@/lib/photos/inventory-readiness";

const idle: AnalysisStatus = { pending: null, running: false, completed: 0, total: 0, hasFindings: false };
const step = (id: string, done: boolean, todo = `do ${id}`): ReadinessStep => ({
  id,
  label: id,
  detail: id,
  todo,
  done,
});

describe("nextPhotoAction", () => {
  it("waits while uploads are still running", () => {
    const action = nextPhotoAction(
      { ...EMPTY_PHOTO_STATUS, photoCount: 12, uploadsActive: 34, uploadsDone: 12, uploadsTotal: 46 },
      idle,
    );
    expect(action).toEqual({ kind: "uploading", label: "Uploading 12 of 46…", enabled: false });
  });

  it("is disabled with no photographs", () => {
    expect(nextPhotoAction(EMPTY_PHOTO_STATUS, idle).enabled).toBe(false);
  });

  it("names the first unfinished room step and stays disabled", () => {
    const action = nextPhotoAction(
      {
        ...EMPTY_PHOTO_STATUS,
        photoCount: 46,
        readiness: [step("cover", true), step("rooms", true), step("allocated", false, "2 photographs not in a room"), step("overviews", false)],
      },
      idle,
    );
    expect(action).toEqual({ kind: "blocked", label: "2 photographs not in a room", enabled: false });
  });

  it("offers analysis once every room step is done", () => {
    const photos = {
      ...EMPTY_PHOTO_STATUS,
      photoCount: 46,
      readiness: [step("cover", true), step("rooms", true), step("allocated", true), step("overviews", true)],
    };
    expect(nextPhotoAction(photos, idle)).toEqual({ kind: "analyse", label: "Analyse photographs", enabled: true });
    expect(nextPhotoAction(photos, { ...idle, pending: 28 }).label).toBe("Analyse 28 photographs");
    expect(nextPhotoAction(photos, { ...idle, pending: 1 }).label).toBe("Analyse 1 photograph");
  });

  it("shows progress while analysing and moves to review afterwards", () => {
    const photos = { ...EMPTY_PHOTO_STATUS, photoCount: 10 };
    expect(nextPhotoAction(photos, { ...idle, running: true, completed: 3, total: 10 })).toEqual({
      kind: "analysing",
      label: "Analysing 3 of 10…",
      enabled: false,
    });
    expect(nextPhotoAction(photos, { ...idle, pending: 0, hasFindings: true }).kind).toBe("review");
  });
});
