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
}: {
  current: ReportStep;
  onSelect: (step: ReportStep) => void;
  reviewCount?: number;
}) {
  // Review now lives on the same screen as photos.
  const currentIndex = current === "output" ? 1 : 0;
  return (
    <nav aria-label="Report progress">
      <ol className="grid grid-cols-2 gap-2">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border-b-2 px-2 text-sm font-medium transition-colors",
                  active
                    ? "border-accent text-foreground"
                    : "border-border text-foreground",
                )}
              >
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
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
