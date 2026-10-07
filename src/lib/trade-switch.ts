import { requiresTradeAssignment, type SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * Trade allocation is the layer that routes findings to trades: the
 * organisation and project directories, per-trade extracts, the trade portal,
 * the trade column on a finding, and the gate that refuses to publish while a
 * failing item has no trade.
 *
 * It is optional, because most customers never set a directory up. Two switches
 * control it and this module is the only place that decides which one wins:
 *
 *   organisations.trade_allocation_enabled   the account default (default true)
 *   reports.trade_allocation_enabled         one report; NULL inherits the account
 *
 * Default true everywhere on purpose: an account that has never touched the
 * setting behaves exactly as it did before this existed.
 */

/** What a column that has never been set means. */
export const TRADE_ALLOCATION_DEFAULT = true;

/**
 * Resolve the two switches to on or off.
 *
 * A report's own answer wins when it has one; otherwise the account's answer;
 * otherwise the default. Only a real boolean counts — null, undefined and
 * anything else fall through, which is what makes "inherit" work without a
 * sentinel value.
 */
export function resolveTradeAllocation(
  organisationValue: unknown,
  reportValue: unknown,
): boolean {
  if (typeof reportValue === "boolean") return reportValue;
  if (typeof organisationValue === "boolean") return organisationValue;
  return TRADE_ALLOCATION_DEFAULT;
}

/**
 * Is the trade layer actually in play for this report?
 *
 * Two things have to agree: the account must have it switched on, and the
 * survey definition must ask for trades. Switching it off can therefore only
 * ever remove the trade layer, never add one to a template that never had it.
 */
export function tradeAllocationActive(
  snapshot: SurveyTypeSnapshot | null | undefined,
  enabled: boolean,
): boolean {
  return enabled && requiresTradeAssignment(snapshot);
}
