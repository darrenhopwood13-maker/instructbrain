/**
 * Portfolio reporting: the same findings the dashboard and the map count, rolled into a document.
 *
 * The rule this module exists to keep: a report is a claim, so every figure in it is counted from
 * the rows the reader can open, and anything that cannot be counted is stated as missing rather
 * than estimated. It imports the trends maths instead of re-deriving it, so a report can never
 * disagree with the screen it was generated from.
 *
 * `mode` is here from the start. Internal reports may say "56 closes were backfilled"; a client
 * report may not use that shorthand and must state coverage in neutral language instead. The
 * client skin is not built yet, but the seam is, because retrofitting it into a shipped engine is
 * the expensive version of this job.
 */

import { OPEN_LIFECYCLE_STATES, type DashboardItem } from "@/lib/analytics/item-map";
import { buildTrends, type AgeBand } from "@/lib/map/trends";

export type ReportMode = "internal" | "client";

export type PeriodPreset = "this_month" | "last_month" | "this_quarter" | "last_90" | "year_to_date";

export type ReportScope = {
  kind: "organisation" | "project";
  /** Set when the scope is a single project. */
  projectId: string | null;
  label: string;
};

export type ReportPeriod = {
  preset: PeriodPreset;
  /** Inclusive ISO dates, yyyy-mm-dd. */
  from: string;
  to: string;
  label: string;
};

export type TradeLine = {
  trade: string;
  raised: number;
  open: number;
  overdue: number;
  closed: number;
  /** Median days from raised to signed off, over closes that record one. Null when none do. */
  medianDaysToClose: number | null;
  /** Share of this trade's open work that is past its date, as a percentage. */
  lateShare: number | null;
};

export type ProjectLine = {
  projectId: string | null;
  name: string;
  raised: number;
  open: number;
  overdue: number;
  closed: number;
};

export type WorstItem = {
  ref: string | null;
  title: string;
  projectName: string;
  trade: string;
  severity: string | null;
  daysLate: number;
};

export type MonthLine = { label: string; raised: number; closed: number };

export type ReportHeadline = {
  raised: number;
  closed: number;
  open: number;
  overdue: number;
  /** Share of open work past its date, as a percentage. */
  lateShare: number | null;
  /** Median days from raised to signed off for closes inside the period. */
  medianDaysToClose: number | null;
  /** Closes dated from the last update rather than a recorded sign-off. */
  backfilledCloses: number;
};

export type PortfolioReport = {
  mode: ReportMode;
  scope: ReportScope;
  period: ReportPeriod;
  /** The day the report was generated, yyyy-mm-dd. */
  generatedOn: string;
  headline: ReportHeadline;
  months: MonthLine[];
  ageing: AgeBand[];
  trades: TradeLine[];
  projects: ProjectLine[];
  worst: WorstItem[];
  /** Everything the reader must know to read the figures correctly. */
  caveats: string[];
  /** True when nothing at all fell inside the scope and period. */
  empty: boolean;
};

const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const UNASSIGNED = "Unassigned";

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** The date part of a timestamp, or null when there is not one to read. */
function dayOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const trimmed = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / DAY);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  if (upper === undefined) return null;
  const lower = sorted[middle - 1];
  return sorted.length % 2 === 0 && lower !== undefined ? Math.round((lower + upper) / 2) : upper;
}

function percent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

function isClosed(item: DashboardItem): boolean {
  return !OPEN_LIFECYCLE_STATES.includes(
    (item.lifecycleState ?? "open") as (typeof OPEN_LIFECYCLE_STATES)[number],
  );
}

function monthLabel(key: string): string {
  const [year = "", month = ""] = key.split("-");
  const index = Number(month) - 1;
  return `${MONTHS[index] ?? month} ${year.slice(2)}`;
}

/**
 * The period a report covers. `to` is always inclusive, and "to date" presets stop on the day the
 * report is generated rather than at a month or quarter boundary - a report claiming a full quarter
 * three weeks in would be the exact kind of overstatement this feature must not make.
 */
export function periodFor(preset: PeriodPreset, today: string): ReportPeriod {
  const now = new Date(`${today}T00:00:00Z`);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  switch (preset) {
    case "last_month": {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 0));
      return {
        preset,
        from: isoDay(start),
        to: isoDay(end),
        label: `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
      };
    }
    case "this_quarter": {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      const start = new Date(Date.UTC(year, quarterStartMonth, 1));
      return {
        preset,
        from: isoDay(start),
        to: today,
        label: `Q${Math.floor(month / 3) + 1} ${year} to date`,
      };
    }
    case "last_90": {
      const start = new Date(Date.UTC(year, month, now.getUTCDate() - 89));
      return { preset, from: isoDay(start), to: today, label: "Last 90 days" };
    }
    case "year_to_date":
      return { preset, from: `${year}-01-01`, to: today, label: `${year} to date` };
    case "this_month":
    default: {
      const start = new Date(Date.UTC(year, month, 1));
      return {
        preset: "this_month",
        from: isoDay(start),
        to: today,
        label: `${MONTHS[month]} ${year}`,
      };
    }
  }
}

function within(day: string | null, period: ReportPeriod): boolean {
  return day !== null && day >= period.from && day <= period.to;
}

/** The six months ending with the period's final month, raised against closed. */
function monthSeries(
  items: DashboardItem[],
  period: ReportPeriod,
  months = 6,
): MonthLine[] {
  const endKey = period.to.slice(0, 7);
  const [endYear = "0", endMonth = "1"] = endKey.split("-");
  const keys: string[] = [];
  for (let step = months - 1; step >= 0; step -= 1) {
    const zeroBased = Number(endMonth) - 1 - step;
    const adjustedYear = Number(endYear) + Math.floor(zeroBased / 12);
    const adjustedMonth = ((zeroBased % 12) + 12) % 12;
    keys.push(`${adjustedYear}-${String(adjustedMonth + 1).padStart(2, "0")}`);
  }

  return keys.map((key) => {
    const raised = items.filter((item) => dayOf(item.createdAt)?.slice(0, 7) === key).length;
    const closed = items.filter((item) => dayOf(item.closedAt)?.slice(0, 7) === key).length;
    return { label: monthLabel(key), raised, closed };
  });
}

function tradeLines(items: DashboardItem[], period: ReportPeriod): TradeLine[] {
  const groups = new Map<string, DashboardItem[]>();
  for (const item of items) {
    const trade = (item.assignedTrade ?? "").trim() || UNASSIGNED;
    const bucket = groups.get(trade);
    if (bucket) bucket.push(item);
    else groups.set(trade, [item]);
  }

  const lines: TradeLine[] = [];
  for (const [trade, group] of groups) {
    const open = group.filter((item) => !isClosed(item));
    const overdue = open.filter((item) => {
      const due = dayOf(item.dueDate);
      return due !== null && due < period.to;
    });
    const closes = group
      .filter((item) => isClosed(item))
      .map((item) => {
        const closedOn = dayOf(item.closedAt);
        const raisedOn = dayOf(item.createdAt) ?? dayOf(item.reportDate);
        if (!closedOn || !raisedOn) return null;
        return daysBetween(raisedOn, closedOn);
      })
      .filter((value): value is number => value !== null && value >= 0);

    lines.push({
      trade,
      raised: group.length,
      open: open.length,
      overdue: overdue.length,
      closed: group.filter(isClosed).length,
      medianDaysToClose: median(closes),
      lateShare: percent(overdue.length, open.length),
    });
  }

  // Worst first: most past their date, then the larger backlog, so the top of the table is the
  // thing somebody has to act on rather than an alphabetical accident.
  return lines.sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.trade.localeCompare(b.trade));
}

function projectLines(items: DashboardItem[]): ProjectLine[] {
  const groups = new Map<string | null, DashboardItem[]>();
  for (const item of items) {
    const key = item.projectId;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }

  const lines: ProjectLine[] = [];
  for (const [projectId, group] of groups) {
    const open = group.filter((item) => !isClosed(item));
    const today = isoDay(new Date());
    lines.push({
      projectId,
      name: group[0]?.projectName?.trim() || "Unassigned project",
      raised: group.length,
      open: open.length,
      overdue: open.filter((item) => {
        const due = dayOf(item.dueDate);
        return due !== null && due < today;
      }).length,
      closed: group.filter(isClosed).length,
    });
  }

  return lines.sort((a, b) => b.overdue - a.overdue || b.raised - a.raised || a.name.localeCompare(b.name));
}

function worstItems(items: DashboardItem[], today: string, limit = 10): WorstItem[] {
  return items
    .filter((item) => !isClosed(item))
    .map((item) => {
      const due = dayOf(item.dueDate);
      const daysLate = due ? daysBetween(due, today) : 0;
      return {
        ref: item.ref,
        title: (item.title ?? "").trim() || "Untitled item",
        projectName: item.projectName?.trim() || "Unassigned project",
        trade: (item.assignedTrade ?? "").trim() || UNASSIGNED,
        severity: item.severity,
        daysLate,
      };
    })
    .filter((item) => item.daysLate > 0)
    .sort((a, b) => b.daysLate - a.daysLate)
    .slice(0, limit);
}

export type BuildReportInput = {
  items: DashboardItem[];
  scope: ReportScope;
  period: ReportPeriod;
  today: string;
  mode?: ReportMode;
  /** True when the underlying query hit its row cap, so the report must say it is partial. */
  truncated?: boolean;
};

export function buildPortfolioReport(input: BuildReportInput): PortfolioReport {
  const mode = input.mode ?? "internal";
  const { scope, period, today } = input;

  const scoped =
    scope.kind === "project" && scope.projectId
      ? input.items.filter((item) => item.projectId === scope.projectId)
      : input.items;

  // Raised means raised inside the period. Closed means signed off inside the period. They are
  // deliberately independent: an item raised in July and closed in October belongs to both, and
  // counting it once would make the two halves of the report disagree.
  const raisedInPeriod = scoped.filter((item) => within(dayOf(item.createdAt), period));
  const closedInPeriod = scoped.filter((item) => within(dayOf(item.closedAt), period));

  const open = scoped.filter((item) => !isClosed(item));
  const overdue = open.filter((item) => {
    const due = dayOf(item.dueDate);
    return due !== null && due < today;
  });

  const closesInPeriod = closedInPeriod
    .map((item) => {
      const closedOn = dayOf(item.closedAt);
      const raisedOn = dayOf(item.createdAt) ?? dayOf(item.reportDate);
      if (!closedOn || !raisedOn) return null;
      return daysBetween(raisedOn, closedOn);
    })
    .filter((value): value is number => value !== null && value >= 0);

  const backfilledCloses = closedInPeriod.filter(
    (item) => dayOf(item.closedAt) !== null && dayOf(item.closedAt) === dayOf(item.updatedAt),
  ).length;

  const headline: ReportHeadline = {
    raised: raisedInPeriod.length,
    closed: closedInPeriod.length,
    open: open.length,
    overdue: overdue.length,
    lateShare: percent(overdue.length, open.length),
    medianDaysToClose: median(closesInPeriod),
    backfilledCloses,
  };

  const trends = buildTrends(scoped, today, 6);

  const caveats: string[] = [];
  if (input.truncated) {
    caveats.push(
      "This account has more findings than the report reads in one pass, so the figures cover the most recent rows only. Project-level reports are complete.",
    );
  }
  if (headline.medianDaysToClose === null) {
    caveats.push(
      "No item was signed off inside this period with both dates recorded, so there is no cycle time to report. It is left blank rather than estimated.",
    );
  }
  if (mode === "internal") {
    if (backfilledCloses > 0) {
      caveats.push(
        backfilledCloses === 1
          ? "1 close in this period was dated from the item's last update rather than a recorded sign-off, because it closed before close-out tracking began."
          : `${backfilledCloses} closes in this period were dated from the item's last update rather than a recorded sign-off, because they closed before close-out tracking began.`,
      );
    }
    caveats.push("Counted from the findings on this account. No figure here is typed by hand.");
  } else {
    caveats.push(
      "Figures are counted from the findings recorded in instructBrain for the period shown. Items without a recorded sign-off date are excluded from cycle time rather than estimated.",
    );
  }
  if (scope.kind === "organisation" && scoped.length > 0) {
    caveats.push(
      "Open and overdue counts describe the account as it stands today, not only work raised in this period.",
    );
  }

  return {
    mode,
    scope,
    period,
    generatedOn: today,
    headline,
    months: monthSeries(scoped, period),
    ageing: trends.ageing,
    trades: tradeLines(scoped, period),
    projects: projectLines(scoped),
    worst: worstItems(open, today),
    caveats,
    empty: scoped.length === 0,
  };
}
