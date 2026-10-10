import { useMemo, useState } from "react";
import { Sparkles, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Finding } from "@/lib/types";
import {
  CONDITION_GRADE_LEGEND,
  conditionGradeOf,
  conditionGradeSummary,
  gradeSuggestion,
  orderByWorstFirst,
  type GradableFinding,
} from "@/lib/review/condition-grade";

/**
 * Grading a whole schedule, the way trades are allocated to snags.
 *
 * The ungraded items come first and are visibly outstanding — they are the work
 * still to do, and burying them under the confirmed ones would hide the only
 * thing holding the schedule back. From there a person grades each element, or
 * accepts the assessment's own suggestion in one press. Nothing here decides
 * anything: `condition-grade` plans the reading, this shows it, and the caller
 * stores it.
 */

function asGradable(finding: Finding): GradableFinding {
  return {
    id: finding.id,
    ref: finding.ref,
    conditionGrade: finding.conditionGrade ?? null,
    aiSuggestedGrade: finding.aiSuggestedGrade ?? null,
    aiGradeConfidence: finding.aiGradeConfidence ?? null,
  };
}

function confidenceLabel(value: number | null): string {
  if (value === null) return "confidence not recorded";
  return `${Math.round(value * 100)}% sure`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function ConditionGradeOrganiser({
  findings,
  threshold,
  onGrade,
  disabled,
}: {
  findings: Finding[];
  /** Confidence at or above which a suggestion is applied without a second look. */
  threshold: number;
  /** One route in, one write out: the grade lands in each finding's own record. */
  onGrade: (findingIds: string[], grade: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const gradable = useMemo(() => findings.map(asGradable), [findings]);
  const summary = useMemo(() => conditionGradeSummary(gradable), [gradable]);
  // Ungraded first, then worst grade down to best. The confirmed list keeps the
  // report's own order inside each grade.
  const ordered = useMemo(() => orderByWorstFirst(gradable), [gradable]);
  const byId = useMemo(() => new Map(findings.map((finding) => [finding.id, finding])), [findings]);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const suggestedIds = useMemo(
    () =>
      gradable
        .filter((item) => item.conditionGrade === null && gradeSuggestion(item, threshold) !== null)
        .map((item) => item.id),
    [gradable, threshold],
  );

  async function grade(ids: string[], value: string) {
    if (ids.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      await onGrade(ids, value);
      const label = conditionGradeOf(value);
      setNotice(
        `${plural(ids.length, "element", "elements")} graded ${value}${label ? ` — ${label.label}` : ""}.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That grade did not go through.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptSuggestions() {
    if (suggestedIds.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      // One write per grade, so a run across several grades stays a single press.
      const byGrade = new Map<string, string[]>();
      for (const item of gradable) {
        const suggestion = gradeSuggestion(item, threshold);
        if (item.conditionGrade !== null || suggestion === null) continue;
        const bucket = byGrade.get(suggestion.grade.code);
        if (bucket) bucket.push(item.id);
        else byGrade.set(suggestion.grade.code, [item.id]);
      }
      for (const [code, ids] of byGrade) await onGrade(ids, code);

      const quiet = gradable.filter((item) => {
        const suggestion = gradeSuggestion(item, threshold);
        return item.conditionGrade === null && suggestion !== null && !suggestion.confident;
      }).length;
      const parts = [`${plural(suggestedIds.length, "suggestion", "suggestions")} applied`];
      if (quiet > 0) parts.push(`${quiet} of them low-confidence, marked for a look`);
      const without = summary.ungraded - suggestedIds.length;
      if (without > 0) parts.push(`${without} had no grade suggested, still to confirm`);
      setNotice(parts.join(" · ") + ".");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That grade did not go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="grades-heading" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="grades-heading" className="text-sm font-semibold">
          Condition grades
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={disabled || busy || suggestedIds.length === 0}
            onClick={() => void acceptSuggestions()}
            aria-label={`Use all ${suggestedIds.length} grade suggestions`}
          >
            <Sparkles aria-hidden="true" className="size-4" />
            {busy
              ? "Grading…"
              : suggestedIds.length > 0
                ? `Use all ${suggestedIds.length} suggestions`
                : "No suggestions to use"}
          </Button>
        </div>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {plural(summary.total, "element", "elements")} · {summary.graded} graded ·{" "}
        {summary.ungraded} to be confirmed
        {suggestedIds.length > 0 ? `, ${suggestedIds.length} of those with a suggestion ready` : ""}
        . A suggestion is applied only when someone accepts it.
      </p>

      <ul className="mt-3 space-y-3">
        {ordered.map((item) => {
          const finding = byId.get(item.id);
          if (!finding) return null;
          const confirmed = conditionGradeOf(item.conditionGrade);
          const suggestion = gradeSuggestion(item, threshold);
          const outstanding = confirmed === null;
          return (
            <li
              key={item.id}
              className={
                "rounded-xl border bg-surface p-3 " +
                (outstanding ? "border-flag/40" : "border-border")
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{finding.ref}</span>{" "}
                    <span className="break-words">{finding.title}</span>
                  </p>
                  {outstanding ? (
                    <p className="mt-0.5 text-xs font-semibold text-flag">To be confirmed</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {confirmed!.code} — {confirmed!.label}. Confirmed.
                    </p>
                  )}
                  {outstanding && suggestion ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Suggested {suggestion.grade.code} — {suggestion.grade.label},{" "}
                      {confidenceLabel(suggestion.confidence)}, unconfirmed
                    </p>
                  ) : null}
                  {outstanding && !suggestion ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      No grade suggested. Someone needs to choose.
                    </p>
                  ) : null}
                </div>
                {confirmed ? (
                  <UserRoundCheck
                    aria-label="Confirmed by a person"
                    className="mt-1 size-4 shrink-0 text-muted-foreground"
                  />
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="min-w-56 flex-1">
                  <span className="eyebrow block text-muted-foreground">Grade {finding.ref}</span>
                  <select
                    aria-label={`Grade ${finding.ref}`}
                    className="mt-1 min-h-11 w-full rounded-md border border-input bg-surface-raised p-2 text-base"
                    value={confirmed?.code ?? ""}
                    disabled={disabled || busy}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next !== "") void grade([item.id], next);
                    }}
                  >
                    <option value="">To be confirmed</option>
                    {CONDITION_GRADE_LEGEND.map((gradeOption) => (
                      <option key={gradeOption.code} value={gradeOption.code}>
                        {gradeOption.code} — {gradeOption.label}
                      </option>
                    ))}
                  </select>
                </label>
                {outstanding && suggestion ? (
                  <Button
                    type="button"
                    variant="quiet"
                    className="min-h-11"
                    disabled={disabled || busy}
                    aria-label={`Use the suggestion for ${finding.ref}`}
                    onClick={() => void grade([item.id], suggestion.grade.code)}
                  >
                    Use {suggestion.grade.code}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {notice ? (
        <p
          className="mt-3 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm"
          role="status"
        >
          {notice}
        </p>
      ) : null}
    </section>
  );
}
