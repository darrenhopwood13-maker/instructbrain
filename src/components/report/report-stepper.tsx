import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReportStep = "photos" | "review" | "output";

export type StepState = {
  hasFindings: boolean;
  unresolved: number;
  issued: boolean;
};

/** Where a report should open, worked out from how far it has got. */
export function defaultStep(state: StepState): ReportStep {
  if (state.issued) return "output";
  if (!state.hasFindings) return "photos";
  return state.unresolved === 0 ? "output" : "photos";
}

/** Whether the "all confirmed — continue to issue" prompt may show. */
export function readyToIssue(state: StepState): boolean {
  return !state.issued && state.hasFindings && state.unresolved === 0;
}

/**
 * Which step a report opens on, from the address bar plus how far the report has
 * got.
 *
 * A published report is its published document — there is nothing left to step
 * between — so it opens on `output` whatever the address bar says. That also
 * closes the hole where a stale `?tab=photos` link opened a working screen for a
 * report that can no longer be worked on.
 *
 * A run in progress holds the screen on `photos` for the same reason it always
 * did: the first results arriving must not move the screen away and cut the run
 * short.
 */
export function resolveStep({
  tab,
  locked,
  running,
  loaded,
  state,
}: {
  /** The address bar's tab, which is absent as often as it is set. */
  tab?: ReportStep | undefined;
  locked: boolean;
  running: boolean;
  loaded: boolean;
  state: StepState;
}): ReportStep {
  if (locked) return "output";
  if (tab) return tab === "output" ? "output" : "photos";
  if (running) return "photos";
  if (!loaded) return "photos";
  return defaultStep(state) === "output" ? "output" : "photos";
}

const STEPS: { id: ReportStep; label: string }[] = [
  { id: "photos", label: "Photos & findings" },
  { id: "output", label: "Get PDF" },
];

/**
 * Two steps: work on photos and findings together, then get the PDF.
 * Both steps are always tappable — nothing is greyed out.
 */
export function ReportStepper({
  current,
  onSelect,
  reviewCount,
  interactive = true,
}: {
  current: ReportStep;
  onSelect?: (step: ReportStep) => void;
  reviewCount?: number;
  /**
   * False where there is nothing to navigate to yet — the start screen, before
   * a report exists. The steps still render, so a person can see there are two
   * of them and which one they are on, but they are not buttons. A control
   * that looks pressable and does nothing is worse than no control.
   */
  interactive?: boolean;
}) {
  // Review now lives on the same screen as photos.
  const currentIndex = current === "output" ? 1 : 0;
  const shell = "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border-b-2 px-2 text-sm font-medium transition-colors";
  return (
    <nav aria-label="Report progress">
      <ol className="grid grid-cols-2 gap-2">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const className = cn(
            shell,
            active ? "border-accent text-foreground" : "border-border text-foreground",
          );
          const inner = (
            <>
              {done ? (
                <Check aria-hidden="true" className="size-4 shrink-0" />
              ) : (
                <span aria-hidden="true">{index + 1}</span>
              )}
              <span className="truncate">{step.label}</span>
              {step.id === "photos" && reviewCount ? (
                <span className="rounded-full bg-surface-sunken px-1.5 text-xs font-semibold">
                  {reviewCount}
                  <span className="sr-only"> to confirm</span>
                </span>
              ) : null}
              {done ? <span className="sr-only"> (done)</span> : null}
            </>
          );
          return (
            <li key={step.id} className="min-w-0">
              {interactive && onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  aria-current={active ? "step" : undefined}
                  className={className}
                >
                  {inner}
                </button>
              ) : (
                <span aria-current={active ? "step" : undefined} className={className}>
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
