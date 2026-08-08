import { useMemo, useState } from "react";
import { Sparkles, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldCard } from "@/components/field-card";
import type { Finding } from "@/lib/types";
import { deriveDueDate, formatTarget } from "@/lib/findings/due-date";
import { resolveSeverity, type SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * Invariant 6: naming a trade as responsible is a commercial act.
 *
 * The AI's suggestion, its confidence and its reasoning are always shown, and
 * are never overwritten. A person chooses; only their choice is distributed.
 */

export type TradeAssignment = {
  trade: string | null;
  dueDate: string | null;
  dueDateOverridden: boolean;
};

function confidenceLabel(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Confidence not recorded";
  return `Confidence ${Math.round(value * 100)}%`;
}

export function TradeAssignmentCard({
  finding,
  snapshot,
  tradeOptions,
  onAssign,
  onAddTradeToDirectory,
  disabled,
}: {
  finding: Finding;
  snapshot: SurveyTypeSnapshot;
  /** Directory trades for this project, plus the definition's default trades. */
  tradeOptions: string[];
  onAssign: (assignment: TradeAssignment) => Promise<void> | void;
  /** Offered when a person types a trade the project directory does not hold. */
  onAddTradeToDirectory?: (trade: string) => void;
  disabled?: boolean;
}) {
  const assigned = finding.assignedTrade ?? null;
  const suggested = finding.aiSuggestedTrade ?? null;

  // The suggestion is pre-selected so confirming it is one tap. It is only a
  // draft in the picker: nothing is stored until a person saves (Invariant 6).
  const [draft, setDraft] = useState<string>(assigned ?? suggested ?? "");

  const [freeText, setFreeText] = useState("");
  const [dueDraft, setDueDraft] = useState<string>(finding.dueDate ?? "");
  const [saving, setSaving] = useState(false);

  const severity = resolveSeverity(snapshot, finding.severity);
  const immediate = severity?.targetHours === 0;
  const inDirectory = useMemo(
    () => new Set(tradeOptions.map((trade) => trade.toLowerCase())),
    [tradeOptions],
  );

  const chosen = draft === "__other__" ? freeText.trim() : draft.trim();
  const unknownTrade = chosen !== "" && !inDirectory.has(chosen.toLowerCase());

  const save = async (trade: string | null, overrideDate?: string | null) => {
    setSaving(true);
    try {
      const confirmedAt = new Date();
      const derived = deriveDueDate(snapshot, finding.severity, confirmedAt);
      const overridden = overrideDate !== undefined;
      await onAssign({
        trade,
        dueDate: overridden ? (overrideDate || null) : derived.dueDate,
        dueDateOverridden: overridden,
      });
    } finally {
      setSaving(false);
    }
  };

  const targetText = formatTarget(snapshot, finding.severity, finding.dueDate);

  return (
    <FieldCard
      label="Responsible trade"
      popOutDescription="An assessment, not a finding of fact. A person confirms every assignment before anything is distributed."
      badge={
        assigned ? (
          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-muted-foreground">
            <UserRoundCheck aria-hidden="true" className="size-3" />
            Confirmed by reviewer
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-accent/25 bg-brand-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-brand-accent-ink">
            <Sparkles aria-hidden="true" className="size-3" />
            AI suggestion — unconfirmed
          </span>
        )
      }
      popOut={
        <div>
          <p className="text-sm text-muted-foreground">
            {suggested ? (
              <>
                The assessment suggests <span className="font-semibold text-foreground">{suggested}</span>.{" "}
                {confidenceLabel(finding.aiTradeConfidence)}.
              </>
            ) : (
              "No trade suggested — assign or send to fallback."
            )}
          </p>
          {finding.aiTradeReasoning ? (
            <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-surface-sunken p-3 text-sm">
              {finding.aiTradeReasoning}
            </p>
          ) : null}

          <label
            htmlFor={`trade-${finding.id}`}
            className="eyebrow mt-4 block text-muted-foreground"
          >
            Assign to
          </label>
          <select
            id={`trade-${finding.id}`}
            value={draft}
            disabled={disabled || saving}
            onChange={(event) => setDraft(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-md border border-input bg-surface-raised p-2 text-base"
          >
            <option value="">No trade assigned</option>
            {tradeOptions.map((trade) => (
              <option key={trade} value={trade}>
                {trade}
              </option>
            ))}
            <option value="__other__">Another trade…</option>
          </select>

          {draft === "__other__" ? (
            <div className="mt-2">
              <label htmlFor={`trade-other-${finding.id}`} className="sr-only">
                Trade name
              </label>
              <input
                id={`trade-other-${finding.id}`}
                value={freeText}
                onChange={(event) => setFreeText(event.target.value)}
                placeholder="For example, Dry lining"
                className="min-h-11 w-full rounded-md border border-input bg-surface-raised p-2 text-base"
              />
            </div>
          ) : null}

          {suggested && draft !== suggested ? (
            <Button
              variant="quiet"
              className="mt-2 min-h-11 w-full sm:w-auto"
              disabled={disabled || saving}
              onClick={() => setDraft(suggested)}
            >
              Use the suggestion ({suggested})
            </Button>
          ) : null}

          <div className="mt-4">
            <label htmlFor={`due-${finding.id}`} className="eyebrow block text-muted-foreground">
              Target date
            </label>
            {immediate ? (
              <p className="mt-2 text-sm font-semibold text-fail">
                Immediate — stop work. This severity has no target date; it is due now.
              </p>
            ) : (
              <>
                <input
                  id={`due-${finding.id}`}
                  type="date"
                  value={dueDraft}
                  disabled={disabled || saving}
                  onChange={(event) => setDueDraft(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-md border border-input bg-surface-raised p-2 text-base sm:w-auto"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {severity?.targetHours === undefined || severity?.targetHours === null
                    ? "This survey type sets no target window for this severity, so no date is derived. Set one here if the job needs it."
                    : `Derived from the ${severity.label} target of ${severity.targetHours} hours. You can change it.`}
                </p>
              </>
            )}
          </div>

          {unknownTrade && onAddTradeToDirectory ? (
            <p className="mt-3 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2 text-sm">
              {chosen} is not in this project's directory, so there is nobody to send it to yet.{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => onAddTradeToDirectory(chosen)}
              >
                Add {chosen} to the directory
              </button>
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="brand"
              className="min-h-11 w-full sm:w-auto"
              disabled={disabled || saving}
              onClick={() => void save(chosen === "" ? null : chosen, dueDraft || null)}
            >
              {saving ? "Saving…" : "Confirm assignment"}
            </Button>
            {assigned ? (
              <Button
                variant="quiet"
                className="min-h-11 w-full sm:w-auto"
                disabled={disabled || saving}
                onClick={() => {
                  setDraft("");
                  void save(null, null);
                }}
              >
                Clear assignment
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <p className="break-words">
        {assigned ? (
          <span className="font-semibold">{assigned}</span>
        ) : suggested ? (
          <>
            <span className="font-semibold">{suggested}</span>{" "}
            <span className="text-muted-foreground">
              — suggested, {confidenceLabel(finding.aiTradeConfidence).toLowerCase()}. Not yet
              confirmed.
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">
            No trade suggested — assign or send to fallback.
          </span>
        )}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Target: {targetText}
        {finding.dueDateOverridden ? " · set by a reviewer" : ""}
      </p>
    </FieldCard>
  );
}
