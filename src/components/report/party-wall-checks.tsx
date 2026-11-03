import { Check, X } from "lucide-react";
import { partyWallChecklist } from "@/lib/report/party-wall";
import { isFactsOnly } from "@/lib/survey-types";
import type { ReportDocument } from "@/lib/report/document";

/**
 * The four checks a facts-only record runs over itself, shown as a list rather
 * than a count.
 *
 * A party wall schedule is the evidence in a damage dispute. The failures that
 * lose that argument are not bad prose, they are gaps: the element nobody
 * recorded, the entry with no photograph, the exclusion that does not say why,
 * and the sentence that slipped an opinion into a document which states on its
 * face that it gives none. Each of these is checked while the person is still on
 * the report, so the gap is closed before the schedule is issued rather than
 * after a neighbour's surveyor finds it.
 *
 * Renders nothing at all for any template that is not facts-only.
 */
export function PartyWallChecks({ document }: { document: ReportDocument }) {
  if (!isFactsOnly(document.snapshot)) return null;

  const checks = partyWallChecklist(document);
  const failing = checks.filter((check) => !check.passed);

  return (
    <section
      aria-label="Record checks"
      className="mt-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Record checks</h3>
        <p className="text-xs text-muted-foreground">
          {failing.length === 0
            ? "All four checks pass. This schedule can be published."
            : `${failing.length} of ${checks.length} to close before this can be published.`}
        </p>
      </div>

      <ul className="mt-3 space-y-2">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2 text-sm">
            <span
              aria-hidden="true"
              className={
                check.passed
                  ? "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-accent/15 text-foreground"
                  : "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-flag/15 text-flag"
              }
            >
              {check.passed ? <Check className="size-3" /> : <X className="size-3" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-foreground">{check.label}</span>
              <span className="block break-words text-xs text-muted-foreground">
                {check.detail}
              </span>
            </span>
            <span className="sr-only">{check.passed ? "Passed" : "Outstanding"}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
        This document records facts and gives no opinion. Cause, significance and remedy wording is
        refused at publish, because the schedule&apos;s own limitations say it gives none.
      </p>
    </section>
  );
}
