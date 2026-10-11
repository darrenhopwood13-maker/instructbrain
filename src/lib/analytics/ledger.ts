/**
 * The ledger band: the one number a director reads, plus what moved recently.
 *
 * The distinction this file exists to keep honest:
 *
 * - **The hero is a standing position, not a period.** "Items still open" is a
 *   count of what is open right now. It must NOT move when you change the date
 *   window, because nothing about changing a window closes an item.
 * - **The window only drives activity.** How many reports were raised, how many
 *   items came with them. That is what a date range genuinely changes.
 *
 * A dashboard that rescales its headline figure when you tap "7 days" is
 * inventing data - so this one labels the two separately and the test pins it.
 */

import { attentionItems, daysLate, stateOf, type DashboardItem } from "@/lib/analytics/item-map";

export type LedgerPeriod = "week" | "month" | "quarter" | "all";

export const PERIODS: LedgerPeriod[] = ["week", "month", "quarter", "all"];

export const PERIOD_LABEL: Record<LedgerPeriod, string> = {
  week: "7 days",
  month: "30 days",
  quarter: "90 days",
  all: "All time",
};

export const PERIOD_SENTENCE: Record<LedgerPeriod, string> = {
  week: "in the last 7 days",
  month: "in the last 30 days",
  quarter: "in the last 90 days",
  all: "since the account opened",
};

/** One report, flattened to what the band needs. */
export type DashboardReportRow = {
  id: string;
  reference: string | null;
  title: string | null;
  status: string | null;
  reportDate: string | null;
  createdAt: string | null;
  isQuick: boolean | null;
  projectId: string | null;
  projectName: string | null;
  surveyLabel: string | null;
};

/** The first date included by a period, or null for "all time". */
export function periodStart(period: LedgerPeriod, today: string): string | null {
  const days = { week: 7, month: 30, quarter: 90, all: 0 }[period];
  if (days === 0) return null;
  const end = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(end)) return null;
  return new Date(end - (days - 1) * 86_400_000).toISOString().slice(0, 10);
}

function within(value: string | null, from: string | null): boolean {
  if (from === null) return true;
  if (value === null) return false;
  return value.slice(0, 10) >= from;
}

export type Ledger = {
  period: LedgerPeriod;
  from: string | null;
  /** Current standing. Not affected by the period. */
  standing: {
    openItems: number;
    overdueItems: number;
    notAssessed: number;
    closedOut: number;
    reports: number;
    projects: number;
  };
  /** What happened inside the window. */
  activity: {
    reports: number;
    items: number;
    projects: number;
  };
  attention: DashboardItem[];
  /**
   * How many items qualified for the attention list, before it was capped.
   *
   * Reported so the band can admit when it is showing a subset. This dashboard
   * no longer has a separate overdue section, so if this number ever exceeds
   * `attention.length` and the band stayed silent, the difference would be items
   * that appear nowhere as a row.
   */
  attentionTotal: number;
  /** True when the account has no items at all - the state a new user sees. */
  empty: boolean;
};

export function buildLedger(input: {
  items: DashboardItem[];
  reports: DashboardReportRow[];
  period: LedgerPeriod;
  today: string;
}): Ledger {
  const { items, reports, period, today } = input;
  const from = periodStart(period, today);

  let openItems = 0;
  let overdueItems = 0;
  let notAssessed = 0;
  let closedOut = 0;
  let itemsInWindow = 0;
  for (const item of items) {
    const state = stateOf(item, today);
    if (state === "closed") closedOut += 1;
    else openItems += 1;
    if (state === "overdue") overdueItems += 1;
    if (state === "not_assessed") notAssessed += 1;
    if (within(item.reportDate, from)) itemsInWindow += 1;
  }

  const reportsInWindow = reports.filter((report) => within(report.reportDate ?? report.createdAt, from));

  const projects = new Set<string>();
  for (const report of reports) if (report.projectId) projects.add(report.projectId);
  const projectsInWindow = new Set<string>();
  for (const report of reportsInWindow) if (report.projectId) projectsInWindow.add(report.projectId);

  return {
    period,
    from,
    standing: {
      openItems,
      overdueItems,
      notAssessed,
      closedOut,
      reports: reports.length,
      projects: projects.size,
    },
    activity: {
      reports: reportsInWindow.length,
      items: itemsInWindow,
      projects: projectsInWindow.size,
    },
    attention: attentionItems(items, today, 8),
    attentionTotal: overdueItems + notAssessed,
    empty: items.length === 0 && reports.length === 0,
  };
}

/** "12 days late" / "no date set" - the line on an attention row. */
export function dueLine(item: DashboardItem, today: string): string {
  const late = daysLate(item, today);
  if (late !== null) return late === 1 ? "1 day late" : `${late} days late`;
  if (item.dueDate) return "due";
  return "no date set";
}
