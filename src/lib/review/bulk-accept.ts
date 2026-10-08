import { BULK_TRADE_CONFIRM_THRESHOLD } from "@/lib/ai/config";

/**
 * What one press may safely accept, and what it must leave to a person.
 *
 * The review screen used to offer five separate ways to say yes, and the bulk
 * "confirm all findings" action wrote only `confirmed_at`. Trades and condition
 * grades are separate decisions with their own writers, so a report could be
 * "100% accepted" and still be refused by the publish gate — the number on the
 * button and the number that decides publishing were different numbers.
 *
 * This module is the single answer to "what does accepting everything mean":
 * it decides, from the stored values alone, which items can be settled in one
 * press and which genuinely need a human. The screen writes what this returns,
 * and prints the same numbers it will write.
 *
 * It never invents a value. A trade or a grade is accepted only when the AI
 * offered one at or above the confidence threshold — the same threshold the
 * existing bulk trade action uses. Below it, or with nothing offered, the item
 * goes on the list for a person.
 */

export type AcceptCandidate = {
  id: string;
  ref: string;
  /** The status already resolved against the report's own brief. */
  statusId: string;
  confirmed: boolean;
  assignedTrade: string | null;
  aiSuggestedTrade: string | null;
  aiTradeConfidence: number | null;
  conditionGrade: string | null;
  aiSuggestedGrade: string | null;
  aiGradeConfidence: number | null;
};

export type AttentionReason =
  | "not_assessed"
  | "unsure_trade"
  | "no_trade_suggested"
  | "unsure_grade"
  | "no_grade_suggested";

export type AttentionItem = {
  id: string;
  ref: string;
  reason: AttentionReason;
  /** Plain words for the screen. Never jargon, never a confidence number. */
  detail: string;
};

export type AcceptItem = {
  id: string;
  ref: string;
  /** A trade to write, or null when there is nothing to write. */
  trade: string | null;
  /** A grade to write, or null when there is nothing to write. */
  grade: string | null;
};

export type AcceptPlan = {
  /** Items one press will settle, with whatever values go with them. */
  accept: AcceptItem[];
  /** Items a person must decide, each with the reason in plain words. */
  attention: AttentionItem[];
  /** Already accepted before this press. Counted, never rewritten. */
  alreadyAccepted: number;
  /**
   * True when at least one item on the list is something the publish gate
   * waits for — so the count on the button cannot read as "ready" while the
   * report is still refused.
   */
  blocked: boolean;
};

export function acceptPlan(
  candidates: AcceptCandidate[],
  options: {
    /** The status id meaning the AI could not read the item. */
    notAssessedId: string;
    /** The brief asks for a trade on every failing item. */
    tradeRequired: boolean;
    /** The brief asks for a condition grade. */
    gradeRequired: boolean;
    tradeThreshold?: number;
    gradeThreshold?: number;
  },
): AcceptPlan {
  const tradeThreshold = options.tradeThreshold ?? BULK_TRADE_CONFIRM_THRESHOLD;
  const gradeThreshold = options.gradeThreshold ?? BULK_TRADE_CONFIRM_THRESHOLD;

  const accept: AcceptItem[] = [];
  const attention: AttentionItem[] = [];
  let alreadyAccepted = 0;

  for (const item of candidates) {
    if (item.statusId === options.notAssessedId) {
      attention.push({
        id: item.id,
        ref: item.ref,
        reason: "not_assessed",
        detail: "The AI could not read this one. It needs a status from you.",
      });
      continue;
    }

    if (item.confirmed) {
      alreadyAccepted += 1;
      continue;
    }

    let trade: string | null = null;
    let grade: string | null = null;
    let refused = false;

    if (options.tradeRequired && !item.assignedTrade) {
      const suggested = (item.aiSuggestedTrade ?? "").trim();
      if (!suggested) {
        attention.push({
          id: item.id,
          ref: item.ref,
          reason: "no_trade_suggested",
          detail: "No trade was suggested for this one. Choose one before publishing.",
        });
        refused = true;
      } else if ((item.aiTradeConfidence ?? 0) < tradeThreshold) {
        attention.push({
          id: item.id,
          ref: item.ref,
          reason: "unsure_trade",
          detail: `The suggested trade (${suggested}) was not confident enough to accept in bulk. Check it.`,
        });
        refused = true;
      } else {
        trade = suggested;
      }
    }

    if (!refused && options.gradeRequired && !item.conditionGrade) {
      const suggested = (item.aiSuggestedGrade ?? "").trim();
      if (!suggested) {
        attention.push({
          id: item.id,
          ref: item.ref,
          reason: "no_grade_suggested",
          detail: "No condition grade was suggested for this one. Choose one before publishing.",
        });
        refused = true;
      } else if ((item.aiGradeConfidence ?? 0) < gradeThreshold) {
        attention.push({
          id: item.id,
          ref: item.ref,
          reason: "unsure_grade",
          detail: `The suggested grade (${suggested}) was not confident enough to accept in bulk. Check it.`,
        });
        refused = true;
      } else {
        grade = suggested;
      }
    }

    if (!refused) accept.push({ id: item.id, ref: item.ref, trade, grade });
  }

  return {
    accept,
    attention,
    alreadyAccepted,
    blocked: attention.length > 0,
  };
}
