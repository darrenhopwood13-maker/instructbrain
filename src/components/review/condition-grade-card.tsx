import { useState } from "react";
import { Sparkles, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldCard } from "@/components/field-card";
import type { Finding } from "@/lib/types";
import {
  CONDITION_GRADE_LEGEND,
  conditionGradeOf,
  gradeSuggestion,
} from "@/lib/review/condition-grade";

/**
 * The condition grade control, in the review flow.
 *
 * A grade is a suggestion by the machine and a decision by a person. The
 * assessment's own grade and its confidence number are always shown and are
 * never overwritten; a person picks a grade, or accepts the suggestion in one
 * tap. Nothing is stored until a person saves — an ungraded finding reads as
 * "to be confirmed", never as a silent default.
 */

function confidenceLabel(value: number | null): string {
  if (value === null) return "confidence not recorded";
  return `${Math.round(value * 100)}% sure`;
}

export function ConditionGradeCard({
  finding,
  threshold,
  onGrade,
  disabled,
}: {
  finding: Finding;
  /** Confidence at or above which a suggestion is marked as one to trust. */
  threshold: number;
  /** One route in, one write out: the grade lands in the finding's own record. */
  onGrade: (grade: string | null) => Promise<void> | void;
  disabled?: boolean;
}) {
  const confirmed = conditionGradeOf(finding.conditionGrade);
  const suggestion = gradeSuggestion(
    {
      aiSuggestedGrade: finding.aiSuggestedGrade ?? null,
      aiGradeConfidence: finding.aiGradeConfidence ?? null,
    },
    threshold,
  );

  // The suggestion is pre-selected so confirming it is one tap. It is only a
  // draft in the picker: nothing is stored until a person saves.
  const [draft, setDraft] = useState<string>(confirmed?.code ?? suggestion?.grade.code ?? "");
  const [busy, setBusy] = useState(false);

  const save = async (grade: string | null) => {
    setBusy(true);
    try {
      await onGrade(grade);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FieldCard
      label="Condition grade (your decision)"
      popOutDescription="The grade is a decision, not a finding of fact. A person confirms every grade before anything is published."
      badge={
        confirmed ? (
          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-muted-foreground">
            <UserRoundCheck aria-hidden="true" className="size-3" />
            Confirmed by reviewer
          </span>
        ) : suggestion ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-accent/25 bg-brand-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-accent-ink">
            <Sparkles aria-hidden="true" className="size-3" />
            AI suggestion — unconfirmed
          </span>
        ) : null
      }
      popOut={
        <div>
          <p className="text-sm text-muted-foreground">
            {suggestion ? (
              <>
                The assessment suggests{" "}
                <span className="font-semibold text-foreground">
                  {suggestion.grade.code} — {suggestion.grade.label}
                </span>
                . {confidenceLabel(suggestion.confidence)}.
                {!suggestion.confident
                  ? " That is a low-confidence suggestion: read it, then decide."
                  : ""}
              </>
            ) : (
              "The assessment proposed no grade for this item. Someone needs to choose."
            )}
          </p>

          <label
            htmlFor={`grade-${finding.id}`}
            className="eyebrow mt-4 block text-muted-foreground"
          >
            Grade this element
          </label>
          <select
            id={`grade-${finding.id}`}
            aria-label={`Condition grade for ${finding.ref}`}
            className="mt-2 min-h-11 w-full rounded-md border border-input bg-surface-raised p-2 text-base"
            value={draft}
            disabled={disabled || busy}
            onChange={(event) => setDraft(event.target.value)}
          >
            <option value="">To be confirmed</option>
            {CONDITION_GRADE_LEGEND.map((grade) => (
              <option key={grade.code} value={grade.code}>
                {grade.code} — {grade.label}: {grade.meaning}
              </option>
            ))}
          </select>

          {suggestion ? (
            <Button
              variant="quiet"
              className="mt-2 min-h-11 w-full sm:w-auto"
              disabled={disabled || busy}
              onClick={() => setDraft(suggestion.grade.code)}
            >
              Use the suggestion ({suggestion.grade.code}, {confidenceLabel(suggestion.confidence)})
            </Button>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="brand"
              className="min-h-11 w-full sm:w-auto"
              disabled={disabled || busy || draft === ""}
              aria-label={`Confirm grade for ${finding.ref}`}
              onClick={() => void save(draft)}
            >
              {busy ? "Saving…" : "Confirm grade"}
            </Button>
            {confirmed ? (
              <Button
                variant="quiet"
                className="min-h-11 w-full sm:w-auto"
                disabled={disabled || busy}
                aria-label={`Clear grade for ${finding.ref}`}
                onClick={() => {
                  setDraft("");
                  void save(null);
                }}
              >
                Clear grade
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      {confirmed ? (
        <p>
          <span className="font-semibold">
            {confirmed.code} — {confirmed.label}
          </span>
          <span className="text-muted-foreground"> · {confirmed.meaning}</span>
        </p>
      ) : suggestion ? (
        <p>
          <span className="font-semibold">
            {suggestion.grade.code} — {suggestion.grade.label}
          </span>{" "}
          <span className="text-muted-foreground">
            — suggested, {confidenceLabel(suggestion.confidence)}. Not yet confirmed.
          </span>
        </p>
      ) : (
        <p className="text-muted-foreground">
          No grade yet — to be confirmed. A person decides this, not the machine.
        </p>
      )}
    </FieldCard>
  );
}
