import type { Finding } from "@/lib/types";

/**
 * Allocating trades to snags, the way rooms are allocated to photographs.
 *
 * This module proposes and plans. It never writes: the caller shows the plan and
 * a person applies it. Two routes lead to the same write —
 *
 *   - a person picks a trade and allocates the selected snags to it
 *   - a person accepts the assessment's own suggestion, in one tap
 *
 * — and both end up as a value in the finding's own `assignedTrade` field. There
 * is no second table and no separate queue, so a snag cannot be allocated in one
 * place and un-allocated in another.
 */

/** The part of a finding this module reasons about. */
export type AllocatableFinding = Pick<
  Finding,
  "id" | "ref" | "title" | "assignedTrade" | "aiSuggestedTrade" | "aiTradeConfidence"
>;

export type AllocationTarget = {
  id: string;
  trade: string;
};

export type SkippedAllocation = {
  id: string;
  ref: string;
  reason: string;
};

export type AllocationPlan = {
  /** Snags that will change, in the order they were asked for. */
  assignments: AllocationTarget[];
  /** Already allocated to that trade: counted, not requested again. */
  unchanged: string[];
  /** Asked for but not present in this report. */
  missing: string[];
};

export type SuggestionPlan = {
  /** Snags the assessment has a trade for, best first. */
  suggestions: Array<AllocationTarget & { confidence: number | null; confident: boolean }>;
  /** Snags with nothing to accept — someone must choose. */
  skipped: SkippedAllocation[];
};

export type TradeGroup = {
  /** Null is the unallocated bucket. It is always shown, even when empty. */
  trade: string | null;
  findings: AllocatableFinding[];
};

function normaliseTrade(trade: string | null | undefined): string | null {
  if (typeof trade !== "string") return null;
  const trimmed = trade.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * The identity of a trade, as opposed to how it is written.
 *
 * A person can type a trade the directory spells differently, and "Roofing" and
 * "roofing" are one trade to everyone except a string comparison. Identity is
 * therefore case-insensitive and trimmed; the spelling that was stored is what
 * gets displayed, so nothing is silently rewritten behind a person's back.
 */
function tradeKey(trade: string | null | undefined): string | null {
  const named = normaliseTrade(trade);
  return named === null ? null : named.toLowerCase();
}

function orderOf(ids: string[]): Map<string, number> {
  const order = new Map<string, number>();
  ids.forEach((id, index) => {
    if (!order.has(id)) order.set(id, index);
  });
  return order;
}

/**
 * Plan a manual allocation: every selected snag takes the chosen trade.
 *
 * The trade must be named. An empty trade would write "allocated to nobody",
 * which reads as an allocation on the report and is worse than no allocation at
 * all — so it is refused rather than stored.
 */
export function allocationPlan(
  findings: readonly AllocatableFinding[],
  selectedIds: readonly string[],
  trade: string,
): AllocationPlan {
  const named = normaliseTrade(trade);
  if (named === null) {
    throw new Error("Choose a trade before allocating. An unnamed trade cannot be allocated.");
  }

  const known = new Map(findings.map((finding) => [finding.id, finding]));
  const requested = [...new Set(selectedIds)];

  const assignments: AllocationTarget[] = [];
  const unchanged: string[] = [];
  const missing: string[] = [];

  for (const id of requested) {
    const finding = known.get(id);
    if (!finding) {
      missing.push(id);
      continue;
    }
    if (tradeKey(finding.assignedTrade) === tradeKey(named)) {
      unchanged.push(id);
      continue;
    }
    assignments.push({ id, trade: named });
  }

  return { assignments, unchanged, missing };
}

/**
 * Plan a suggestion run: take the assessment's own trade for each selected snag.
 *
 * A suggestion is only ever taken where there is one. Where the assessment said
 * nothing, the snag is reported back as skipped and left unallocated — it is not
 * given a trade it never had, and it is not quietly dropped from the count.
 *
 * `threshold` marks which suggestions carry enough confidence to be applied
 * without a second look. It is a presentation of trust, not a filter: every
 * suggestion is returned, and the caller decides what to do with the quiet ones.
 */
export function suggestionPlan(
  findings: readonly AllocatableFinding[],
  selectedIds: readonly string[],
  threshold: number,
): SuggestionPlan {
  const known = new Map(findings.map((finding) => [finding.id, finding]));
  const requested = [...new Set(selectedIds)];
  const order = orderOf(requested);

  const suggestions: SuggestionPlan["suggestions"] = [];
  const skipped: SkippedAllocation[] = [];

  for (const id of requested) {
    const finding = known.get(id);
    if (!finding) {
      skipped.push({ id, ref: id, reason: "Not part of this report." });
      continue;
    }

    const suggested = normaliseTrade(finding.aiSuggestedTrade);
    if (suggested === null) {
      skipped.push({
        id,
        ref: finding.ref,
        reason: "The assessment named no trade for this snag.",
      });
      continue;
    }

    const confidence =
      typeof finding.aiTradeConfidence === "number" && Number.isFinite(finding.aiTradeConfidence)
        ? finding.aiTradeConfidence
        : null;

    suggestions.push({
      id,
      trade: suggested,
      confidence,
      confident: confidence !== null && confidence >= threshold,
    });
  }

  // Best supported first, so the sure ones can be accepted and the rest read.
  suggestions.sort((a, b) => {
    if (a.confident !== b.confident) return a.confident ? -1 : 1;
    const aScore = a.confidence ?? -1;
    const bScore = b.confidence ?? -1;
    if (aScore !== bScore) return bScore - aScore;
    return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
  });

  return { suggestions, skipped };
}

/**
 * Group snags by allocated trade, unallocated first.
 *
 * Order inside a group is the order the report already uses, so grouping never
 * reshuffles the evidence. Trades are ordered alphabetically after the
 * unallocated bucket so the same report always reads the same way.
 */
export function groupByTrade(findings: readonly AllocatableFinding[]): TradeGroup[] {
  const unallocated: AllocatableFinding[] = [];
  const groups = new Map<string, { trade: string; findings: AllocatableFinding[] }>();

  for (const finding of findings) {
    const trade = normaliseTrade(finding.assignedTrade);
    const key = tradeKey(finding.assignedTrade);
    if (trade === null || key === null) {
      unallocated.push(finding);
      continue;
    }
    const bucket = groups.get(key);
    if (bucket) bucket.findings.push(finding);
    // The first spelling seen names the group; everyone in it is on that trade.
    else groups.set(key, { trade, findings: [finding] });
  }

  const named = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => group);

  return [{ trade: null, findings: unallocated }, ...named];
}

export type AllocationSummary = {
  total: number;
  allocated: number;
  unallocated: number;
  /** Unallocated snags the assessment has a trade for — one tap from done. */
  suggested: number;
};

export function allocationSummary(findings: readonly AllocatableFinding[]): AllocationSummary {
  let allocated = 0;
  let suggested = 0;

  for (const finding of findings) {
    if (normaliseTrade(finding.assignedTrade) !== null) {
      allocated += 1;
      continue;
    }
    if (normaliseTrade(finding.aiSuggestedTrade) !== null) suggested += 1;
  }

  return {
    total: findings.length,
    allocated,
    unallocated: findings.length - allocated,
    suggested,
  };
}
