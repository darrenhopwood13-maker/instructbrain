import { Check, Circle } from "lucide-react";
import type { ReadinessStep } from "@/lib/photos/inventory-readiness";

/**
 * The extra steps this template needs, shown as a ticked list so nothing is
 * discovered only when the report is generated. Status is never colour alone —
 * every row carries the words "Done" or "To do".
 */
export function ReadinessChecklist({ steps }: { steps: ReadinessStep[] }) {
  if (steps.length === 0) return null;
  const outstanding = steps.filter((step) => !step.done).length;

  return (
    <section
      aria-labelledby="readiness-heading"
      className="mt-6 rounded-xl border border-border bg-surface-raised p-4"
    >
      <h3 id="readiness-heading" className="text-sm font-semibold">
        Before you generate this report
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {outstanding === 0
          ? "Everything this report needs is in place."
          : `${outstanding} step${outstanding === 1 ? "" : "s"} still to do.`}
      </p>
      <ul className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-2.5 text-sm">
            {step.done ? (
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pass" />
            ) : (
              <Circle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <span>
              <span className="font-medium">{step.label}</span>
              <span className="sr-only">{step.done ? " — Done" : " — To do"}</span>
              <span className="block text-xs text-muted-foreground">{step.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
