import type { ReadinessStep } from "@/lib/photos/inventory-readiness";

/**
 * The one next thing to do after photographs, shown as a single button in the
 * thumb zone. Pure, so the wording and the gating are tested without a screen.
 *
 * Nothing here starts analysis: "analyse" only means the button may open the
 * confirmation. Room-schedule templates wait for every readiness step so a
 * room photograph is never analysed as an item by mistake.
 */

export type PhotoStatus = {
  /** Photographs saved against the report. */
  photoCount: number;
  /** Uploads queued or in progress right now. */
  uploadsActive: number;
  /** Uploads finished in the current batch. */
  uploadsDone: number;
  /** Uploads in the current batch, including finished ones. */
  uploadsTotal: number;
  /** Room-schedule readiness; empty for every other template. */
  readiness: ReadinessStep[];
};

export type AnalysisStatus = {
  /** Photographs still waiting for analysis; null when not known yet. */
  pending: number | null;
  running: boolean;
  completed: number;
  total: number;
  hasFindings: boolean;
};

export type NextAction = {
  kind: "empty" | "uploading" | "blocked" | "analysing" | "analyse" | "review" | "nothing";
  label: string;
  enabled: boolean;
};

export const EMPTY_PHOTO_STATUS: PhotoStatus = {
  photoCount: 0,
  uploadsActive: 0,
  uploadsDone: 0,
  uploadsTotal: 0,
  readiness: [],
};

export function nextPhotoAction(photos: PhotoStatus, analysis: AnalysisStatus): NextAction {
  if (analysis.running) {
    return {
      kind: "analysing",
      label: `Analysing ${analysis.completed} of ${analysis.total}…`,
      enabled: false,
    };
  }
  if (photos.uploadsActive > 0) {
    return {
      kind: "uploading",
      label: `Uploading ${photos.uploadsDone} of ${photos.uploadsTotal}…`,
      enabled: false,
    };
  }
  if (photos.photoCount === 0) {
    return { kind: "empty", label: "Add photographs to continue", enabled: false };
  }
  const outstanding = photos.readiness.find((step) => !step.done);
  if (outstanding) {
    return { kind: "blocked", label: outstanding.todo, enabled: false };
  }
  if (analysis.pending === null) {
    return { kind: "analyse", label: "Analyse photographs", enabled: true };
  }
  if (analysis.pending > 0) {
    return {
      kind: "analyse",
      label: `Analyse ${analysis.pending} photograph${analysis.pending === 1 ? "" : "s"}`,
      enabled: true,
    };
  }
  if (analysis.hasFindings) {
    return { kind: "review", label: "Continue to review", enabled: true };
  }
  return { kind: "nothing", label: "Nothing left to analyse", enabled: false };
}
