/**
 * How hard the AI is asked to work on a photograph.
 *
 * Standard keeps the second opinion. Fast is a single pass: no second opinion, and an
 * uncertain answer still resolves to not assessed.
 *
 * The choice belongs to the person running the analysis, not to the screen they happen
 * to press it on - it lived inside the Analysis panel's own state and so was ignored by
 * the two other ways of running the AI. It is remembered here and read by every path.
 */
export type AnalysisSpeed = "standard" | "fast";

const KEY = "instructbrain.ai.speed";

/** Anything that is not "fast" is standard: the safer of the two. */
export function speedFromValue(value: string | null | undefined): AnalysisSpeed {
  return (value ?? "").toLowerCase() === "fast" ? "fast" : "standard";
}

export function isFast(value: string | null | undefined): boolean {
  return speedFromValue(value) === "fast";
}

export function readAnalysisSpeed(): AnalysisSpeed {
  try {
    return speedFromValue(window.localStorage.getItem(KEY));
  } catch {
    return "standard";
  }
}

export function writeAnalysisSpeed(speed: AnalysisSpeed): void {
  try {
    window.localStorage.setItem(KEY, speed);
  } catch {
    // Nothing to remember it in; the run still uses the choice it was given.
  }
}
