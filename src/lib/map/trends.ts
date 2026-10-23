import { daysLate, stateOf, type DashboardItem } from "@/lib/analytics/item-map";

/**
 * Trends that come out of data we actually hold.
 *
 * The honest limit first: a finding records when it was raised, its target date and its
 * lifecycle state - it does NOT record when it was closed. So "clearance" here is measured
 * once, today, as what is still open against the cohort it was raised in. It is a real
 * number, not a time series dressed up as one, and the caveat is returned with the report so
 * the screen cannot show the figures without it.
 */

export type Cohort = {
  /** yyyy-mm */
  key: string;
  /** Short month label, e.g. "Aug 26". */
  label: string;
  raised: number;
  stillOpen: number;
  overdue: number;
};

export type AgeBand = { label: string; count: number };

export type Stall = { label: string; count: number; detail: string };

export type TrendReport = {
  cohorts: Cohort[];
  ageing: AgeBand[];
  raisedThisMonth: number;
  raisedPreviousMonth: number;
  /** Percentage change in items raised, month on month, or null when there is no prior month. */
  raisedChange: number | null;
  /** Items per survey - how much a survey is finding. Null when there are no surveys. */
  depthPerSurvey: number | null;
  /** Share of everything on record that is closed out. */
  clearanceRate: number | null;
  /** Share of still-open items that are past their date. */
  overdueShare: number | null;
  medianDaysLate: number | null;
  /** Where the backlog is sitting: worst trade, worst age band. */
  stalls: Stall[];
  caveat: string;
};

const CAVEAT =
  "Findings carry no close-out date, so clearance is what is still open today against the month it was raised - not how long it took to close.";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(iso: string | null): string | null {
  if (!iso) return null;
  const trimmed = iso.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function labelFor(key: string): string {
  const [year = "", month = ""] = key.split("-");
  const index = Number(month) - 1;
  return `${MONTHS[index] ?? month} ${year.slice(2)}`;
}

function ageDays(item: DashboardItem, today: string): number | null {
  const iso = item.createdAt ?? item.reportDate;
  if (!iso) return null;
  const then = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(then) || Number.isNaN(now)) return null;
  const days = Math.round((now - then) / 86_400_000);
  return days >= 0 ? days : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? null;
  if (upper === null) return null;
  const lower = sorted[middle - 1];
  return sorted.length % 2 === 0 && lower !== undefined ? Math.round((lower + upper) / 2) : upper;
}

export function buildTrends(items: DashboardItem[], today: string, months = 6): TrendReport {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));

  // Walk back from the current month so the newest cohort is always shown, even when empty.
  const keys: string[] = [];
  for (let step = months - 1; step >= 0; step -= 1) {
    const zeroBased = month - 1 - step;
    const adjustedYear = year + Math.floor(zeroBased / 12);
    const adjustedMonth = ((zeroBased % 12) + 12) % 12;
    keys.push(`${adjustedYear}-${String(adjustedMonth + 1).padStart(2, "0")}`);
  }

  const byMonth = new Map<string, Cohort>(
    keys.map((key) => [key, { key, label: labelFor(key), raised: 0, stillOpen: 0, overdue: 0 }]),
  );

  const bands: AgeBand[] = [
    { label: "0-7 days", count: 0 },
    { label: "8-30 days", count: 0 },
    { label: "31-90 days", count: 0 },
    { label: "90+ days", count: 0 },
  ];

  const tradeOpen = new Map<string, { open: number; late: number }>();
  const reports = new Set<string>();
  const lateDays: number[] = [];
  let closed = 0;
  let open = 0;
  let overdue = 0;

  for (const item of items) {
    reports.add(item.reportId);
    const state = stateOf(item, today);
    const monthOfItem = monthKey(item.createdAt ?? item.reportDate);

    // Every item counts as activity in the month it was raised, closed or not. How much of
    // that month's work is still open is the interesting half.
    if (monthOfItem && byMonth.has(monthOfItem)) byMonth.get(monthOfItem)!.raised += 1;

    if (state === "closed") {
      closed += 1;
      continue;
    }

    open += 1;
    if (monthOfItem && byMonth.has(monthOfItem)) {
      const cohort = byMonth.get(monthOfItem)!;
      cohort.stillOpen += 1;
      if (state === "overdue") cohort.overdue += 1;
    }

    if (state === "overdue") {
      overdue += 1;
      const late = daysLate(item, today);
      if (late !== null) lateDays.push(late);
    }

    const age = ageDays(item, today);
    if (age !== null) {
      const index = age <= 7 ? 0 : age <= 30 ? 1 : age <= 90 ? 2 : 3;
      const band = bands[index];
      if (band) band.count += 1;
    }

    const trade = (item.assignedTrade ?? "").trim() || "Unallocated";
    const entry = tradeOpen.get(trade) ?? { open: 0, late: 0 };
    entry.open += 1;
    if (state === "overdue") entry.late += 1;
    tradeOpen.set(trade, entry);
  }

  const cohorts = keys.map((key) => byMonth.get(key)!);
  const thisMonth = cohorts[cohorts.length - 1]?.raised ?? 0;
  const previousMonth = cohorts[cohorts.length - 2]?.raised ?? 0;

  const worstTrade = Array.from(tradeOpen.entries()).sort(
    (a, b) => b[1].late - a[1].late || b[1].open - a[1].open || a[0].localeCompare(b[0], "en-GB"),
  )[0];

  const stalls: Stall[] = [];
  if (worstTrade && worstTrade[1].open > 0) {
    stalls.push({
      label: worstTrade[0],
      count: worstTrade[1].open,
      detail: `${worstTrade[1].late} of them past their date`,
    });
  }
  const oldestBand = [...bands].reverse().find((band) => band.count > 0 && band.label !== "0-7 days");
  if (oldestBand) {
    const firstDay = oldestBand.label.startsWith("90") ? 90 : Number(oldestBand.label.split("-")[0]) - 1;
    stalls.push({
      label: `Open over ${firstDay} days`,
      count: oldestBand.count,
      detail: "raising faster than they are being cleared",
    });
  }

  return {
    cohorts,
    ageing: bands,
    raisedThisMonth: thisMonth,
    raisedPreviousMonth: previousMonth,
    raisedChange:
      previousMonth > 0 ? Math.round(((thisMonth - previousMonth) / previousMonth) * 100) : null,
    depthPerSurvey: reports.size > 0 ? Math.round((items.length / reports.size) * 10) / 10 : null,
    clearanceRate: items.length > 0 ? Math.round((closed / items.length) * 100) : null,
    overdueShare: open > 0 ? Math.round((overdue / open) * 100) : null,
    medianDaysLate: median(lateDays),
    stalls,
    caveat: CAVEAT,
  };
}
