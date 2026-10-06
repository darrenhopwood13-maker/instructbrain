import { useMemo, useState } from "react";
import { CheckCheck, Sparkles, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Finding } from "@/lib/types";
import {
  allocationPlan,
  allocationSummary,
  groupByTrade,
  suggestionPlan,
  type AllocatableFinding,
} from "@/lib/review/trade-allocation";

/**
 * Allocating snags to trades, the way photographs are allocated to rooms.
 *
 * Every snag starts in the unallocated bucket. From there a person either names
 * the trade and allocates the ticked snags to it, or accepts the assessment's
 * own suggestion in one press. Both routes end in the same write, and neither
 * happens without a person pressing something.
 *
 * Nothing here decides anything: `trade-allocation` plans, this shows the plan,
 * and the caller stores it.
 */

function asAllocatable(finding: Finding): AllocatableFinding {
  return {
    id: finding.id,
    ref: finding.ref,
    title: finding.title,
    assignedTrade: finding.assignedTrade ?? null,
    aiSuggestedTrade: finding.aiSuggestedTrade ?? null,
    aiTradeConfidence: finding.aiTradeConfidence ?? null,
  };
}

function confidenceLabel(value: number | null): string {
  if (value === null) return "confidence not recorded";
  return `${Math.round(value * 100)}% sure`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function TradeOrganiser({
  findings,
  tradeOptions,
  threshold,
  onAssign,
  disabled,
}: {
  findings: Finding[];
  /** Directory trades for this project, plus the definition's default trades. */
  tradeOptions: string[];
  /** Confidence at or above which a suggestion is applied without a second look. */
  threshold: number;
  /** One route in, one write out: the trade lands in each finding's own record. */
  onAssign: (findingIds: string[], trade: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const allocatable = useMemo(() => findings.map(asAllocatable), [findings]);
  const summary = useMemo(() => allocationSummary(allocatable), [allocatable]);
  const groups = useMemo(() => groupByTrade(allocatable), [allocatable]);

  const unallocatedIds = useMemo(
    () => allocatable.filter((item) => item.assignedTrade === null).map((item) => item.id),
    [allocatable],
  );
  const suggestedIds = useMemo(
    () =>
      allocatable
        .filter((item) => item.assignedTrade === null && item.aiSuggestedTrade !== null)
        .map((item) => item.id),
    [allocatable],
  );

  const isSelected = (id: string) => selected.includes(id);

  const toggle = (id: string) =>
    setSelected((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );

  async function allocate(trade: string, ids: string[] = selected) {
    if (ids.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      // Throws on an unnamed trade before anything is written.
      const plan = allocationPlan(allocatable, ids, trade);
      const [firstAssignment] = plan.assignments;
      if (firstAssignment) {
        await onAssign(
          plan.assignments.map((item) => item.id),
          firstAssignment.trade,
        );
      }
      setSelected([]);
      setDraft("");
      const parts = [`${plural(plan.assignments.length, "finding", "findings")} allocated to ${trade}`];
      if (plan.unchanged.length > 0) {
        parts.push(`${plan.unchanged.length} already there`);
      }
      if (plan.missing.length > 0) {
        parts.push(`${plan.missing.length} not in this report`);
      }
      setNotice(parts.join(" · ") + ".");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That allocation did not go through.");
    } finally {
      setBusy(false);
    }
  }

  async function acceptSuggestions() {
    // With nothing ticked, this covers every unallocated snag the assessment had
    // an answer for — which is the one-press route. With a selection, only those.
    const targets = selected.length > 0 ? selected : suggestedIds;
    if (targets.length === 0) return;

    setBusy(true);
    setNotice(null);
    try {
      const plan = suggestionPlan(allocatable, targets, threshold);
      const quiet = plan.suggestions.filter((item) => !item.confident).length;

      // One write per trade, so a run across several trades stays a single press.
      const byTrade = new Map<string, string[]>();
      for (const suggestion of plan.suggestions) {
        const bucket = byTrade.get(suggestion.trade);
        if (bucket) bucket.push(suggestion.id);
        else byTrade.set(suggestion.trade, [suggestion.id]);
      }
      for (const [trade, ids] of byTrade) await onAssign(ids, trade);

      setSelected([]);
      const parts = [`${plural(plan.suggestions.length, "suggestion", "suggestions")} applied`];
      if (quiet > 0) parts.push(`${quiet} of them low-confidence, marked for a look`);
      if (plan.skipped.length > 0) {
        parts.push(`${plan.skipped.length} had no trade suggested, still to allocate`);
      }
      setNotice(parts.join(" · ") + ".");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That allocation did not go through.");
    } finally {
      setBusy(false);
    }
  }

  const targetCount = selected.length > 0 ? selected.length : suggestedIds.length;
  const canAllocate = selected.length > 0 && draft.trim() !== "";

  return (
    <section aria-labelledby="trades-heading" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="trades-heading" className="text-sm font-semibold">
          Trades
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={disabled || busy || targetCount === 0}
            onClick={() => void acceptSuggestions()}
          >
            <Sparkles aria-hidden="true" className="size-4" />
            {busy
              ? "Allocating…"
              : selected.length > 0
                ? `Use suggestions for ${selected.length}`
                : `Use all ${suggestedIds.length} suggestions`}
          </Button>
          <Button
            type="button"
            variant="quiet"
            className="min-h-11"
            disabled={disabled || busy || unallocatedIds.length === 0}
            onClick={() => setSelected(unallocatedIds)}
          >
            <CheckCheck aria-hidden="true" className="size-4" />
            {unallocatedIds.length > 0
              ? `Tick the ${unallocatedIds.length} unallocated`
              : "Nothing unallocated"}
          </Button>
        </div>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {plural(summary.total, "finding", "findings")} · {summary.allocated} allocated ·{" "}
        {summary.unallocated} unallocated
        {summary.suggested > 0 ? `, ${summary.suggested} of those with a suggestion ready` : ""}. A
        suggestion is applied only when someone accepts it.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-surface p-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="trade-organiser-trade" className="eyebrow block text-muted-foreground">
            Allocate {selected.length > 0 ? selected.length : "selected"} to
          </label>
          <Select
            value={draft === "" ? "__none__" : draft}
            onValueChange={(value) => setDraft(value === "__none__" ? "" : value)}
          >
            <SelectTrigger
              id="trade-organiser-trade"
              aria-label="Trade to allocate to"
              className="mt-2 h-11 w-full bg-surface-raised text-base"
            >
              <SelectValue placeholder="Choose a trade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Choose a trade</SelectItem>
              {tradeOptions.map((trade) => (
                <SelectItem key={trade} value={trade}>
                  {trade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="brand"
          className="min-h-11"
          disabled={disabled || busy || !canAllocate}
          onClick={() => void allocate(draft)}
        >
          {selected.length > 1 ? `Allocate ${selected.length}` : "Allocate"}
        </Button>
      </div>

      {notice ? (
        <p
          className="mt-3 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {groups.map((group) => (
          <li
            key={group.trade ?? "__unallocated"}
            className="rounded-xl border border-border bg-surface p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {group.trade ?? "Unallocated"}{" "}
                <span className="font-normal text-muted-foreground">
                  {plural(group.findings.length, "finding", "findings")}
                </span>
              </p>
              {group.trade ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  disabled={disabled || busy || selected.length === 0}
                  onClick={() => void allocate(group.trade as string)}
                >
                  {selected.length > 0
                    ? `Add ${selected.length} to ${group.trade}`
                    : `Add to ${group.trade}`}
                </Button>
              ) : null}
            </div>

            {group.findings.length === 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Nothing unallocated. Every finding has a trade.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {group.findings.map((finding) => (
                  <li key={finding.id} className="flex items-start gap-3 py-1">
                    <input
                      type="checkbox"
                      id={`allocate-${finding.id}`}
                      checked={isSelected(finding.id)}
                      disabled={disabled || busy}
                      onChange={() => toggle(finding.id)}
                      className="mt-1 size-5 shrink-0"
                    />
                    <label htmlFor={`allocate-${finding.id}`} className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold">{finding.ref}</span>{" "}
                      <span className="break-words">{finding.title}</span>
                      {finding.assignedTrade ? null : finding.aiSuggestedTrade ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Suggested {finding.aiSuggestedTrade},{" "}
                          {confidenceLabel(finding.aiTradeConfidence ?? null)}, unconfirmed
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          No trade suggested. Someone needs to choose.
                        </span>
                      )}
                    </label>
                    {finding.assignedTrade ? (
                      <UserRoundCheck
                        aria-label="Confirmed by a person"
                        className="mt-1 size-4 shrink-0 text-muted-foreground"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
