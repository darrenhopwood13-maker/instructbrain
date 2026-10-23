import { daysLate, stateOf, type DashboardItem } from "@/lib/analytics/item-map";

/**
 * What is worth saying about one project when somebody taps its pin.
 *
 * Deliberately short: the popup is a glance, not a report. Everything here is
 * derived from the same items the dashboard reads, so a pin and the dashboard can
 * never disagree about how many things are late.
 */

export type ProjectInsight = {
  /** Days since the oldest still-open item was raised, or null when nothing is open. */
  oldestOpenDays: number | null;
  /** Severity counts for items that are still open, worst first. */
  severity: { label: string; count: number }[];
  /** The trade carrying the most still-open work. */
  busiestTrade: string | null;
  /** Items closed out. */
  closed: number;
  /** How late the late ones are, on average. */
  averageDaysLate: number | null;
};

const SEVERITY_ORDER = ["high", "medium", "low"];

function daysSince(iso: string | null, today: string): number | null {
  if (!iso) return null;
  const then = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(then) || Number.isNaN(now)) return null;
  const days = Math.round((now - then) / 86_400_000);
  return days >= 0 ? days : null;
}

export function insightByProject(items: DashboardItem[], today: string): Map<string, ProjectInsight> {
  type Working = {
    oldest: number | null;
    severity: Map<string, number>;
    trades: Map<string, number>;
    closed: number;
    lateDays: number[];
  };
  const working = new Map<string, Working>();

  for (const item of items) {
    if (!item.projectId) continue;
    const bucket: Working =
      working.get(item.projectId) ??
      { oldest: null, severity: new Map(), trades: new Map(), closed: 0, lateDays: [] };
    working.set(item.projectId, bucket);

    const state = stateOf(item, today);
    if (state === "closed") {
      bucket.closed += 1;
      continue;
    }

    const age = daysSince(item.createdAt ?? item.reportDate, today);
    if (age !== null) bucket.oldest = bucket.oldest === null ? age : Math.max(bucket.oldest, age);

    const severity = (item.severity ?? "unrated").toLowerCase();
    bucket.severity.set(severity, (bucket.severity.get(severity) ?? 0) + 1);

    const trade = (item.assignedTrade ?? "").trim();
    if (trade) bucket.trades.set(trade, (bucket.trades.get(trade) ?? 0) + 1);

    const late = daysLate(item, today);
    if (late !== null) bucket.lateDays.push(late);
  }

  const result = new Map<string, ProjectInsight>();
  for (const [projectId, bucket] of working) {
    const severity = Array.from(bucket.severity.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => {
        const rankA = SEVERITY_ORDER.indexOf(a.label);
        const rankB = SEVERITY_ORDER.indexOf(b.label);
        if (rankA !== rankB) return (rankA === -1 ? 99 : rankA) - (rankB === -1 ? 99 : rankB);
        return b.count - a.count;
      })
      .slice(0, 3);

    const busiestTrade =
      Array.from(bucket.trades.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en-GB"))[0]?.[0] ??
      null;

    result.set(projectId, {
      oldestOpenDays: bucket.oldest,
      severity,
      busiestTrade,
      closed: bucket.closed,
      averageDaysLate:
        bucket.lateDays.length > 0
          ? Math.round(bucket.lateDays.reduce((sum, days) => sum + days, 0) / bucket.lateDays.length)
          : null,
    });
  }

  return result;
}
