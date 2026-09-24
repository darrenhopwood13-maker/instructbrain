import type { Finding } from "@/lib/types";
import { BULK_TRADE_CONFIRM_THRESHOLD } from "@/lib/ai/config";

/**
 * Findings a person may confirm in one press: no trade assigned yet, and an
 * AI suggestion at or above the threshold. The person still presses the
 * button — nothing here assigns anything.
 */
export function bulkTradeEligible(
  findings: Finding[],
  threshold: number = BULK_TRADE_CONFIRM_THRESHOLD,
): Finding[] {
  return findings.filter(
    (finding) =>
      !finding.assignedTrade &&
      typeof finding.aiSuggestedTrade === "string" &&
      finding.aiSuggestedTrade.trim() !== "" &&
      typeof finding.aiTradeConfidence === "number" &&
      finding.aiTradeConfidence >= threshold,
  );
}
