import { daysLate, stateOf, type DashboardItem } from "@/lib/analytics/item-map";
import { LADDER, LADDER_UNSET_KEY, ladderRank, ladderStepFor } from "@/lib/analytics/severity-ladder";

/**
 * The control room: the reading, not the record.
 *
 * The dashboard used to carry three panels that all described the same items in
 * different shapes - a map of cells, a ledger band and an activity feed. Dal went
 * off that on 12 Oct 2026: "I want the option 1 now with graphs and the total
 * reports open etc details. We don't need all the recent actions list below
 * either." So this module produces exactly the numbers that screen needs, as pure
 * functions, so the arithmetic is tested rather than trusted.
 *
 * Everything here counts what is really in the account. Nothing is estimated, and
 * a value nobody has filled in is shown as unset rather than sorted into a bucket
 * it did not earn - on the live account that is 78 of 142 items with no severity,
 * which is a fact about the data and must not be dressed up as a category.
 */

/**
 * An item is open work while it is not closed out and has not passed.
 *
 * "Not assessed" IS open work - nobody has looked at it yet, which is exactly why
 * the figure is on the screen - and an item whose survey status is "pass" is not,
 * because there is nothing to do about it. The closed/not-closed judgement comes
 * from `stateOf`, the one place a lifecycle state is read, so this cannot drift
 * from the map and the ledger.
 */
export function isOpenItem(item: DashboardItem, today: string): boolean {
  if ((item.status ?? "").toLowerCase() === "pass") return false;
  return stateOf(item, today) !== "closed";
}

export type ControlRoomTotals = {
  reports: number;
  items: number;
  openItems: number;
  overdue: number;
  notAssessed: number;
  /** Of the open ones, how many have a trade on them. */
  unallocated: number;
  /** Every item in the account that is closed out. */
  closed: number;
};

export function controlRoomTotals(
  items: readonly DashboardItem[],
  reports: readonly unknown[],
  today: string,
): ControlRoomTotals {
  let openItems = 0;
  let overdue = 0;
  let notAssessed = 0;
  let unallocated = 0;
  let closed = 0;

  for (const item of items) {
    const state = stateOf(item, today);
    if (state === "closed") {
      closed += 1;
      continue;
    }
    if (!isOpenItem(item, today)) continue;
    openItems += 1;
    if (state === "overdue") overdue += 1;
    if (state === "not_assessed") notAssessed += 1;
    if (!(item.assignedTrade ?? "").trim()) unallocated += 1;
  }

  return {
    reports: reports.length,
    items: items.length,
    openItems,
    overdue,
    notAssessed,
    unallocated,
    closed,
  };
}

export type BreakdownAxis = "trade" | "severity" | "raised" | "project";

export const BREAKDOWN_AXES: BreakdownAxis[] = ["trade", "severity", "raised", "project"];

export const BREAKDOWN_LABEL: Record<BreakdownAxis, string> = {
  trade: "Trade",
  severity: "Severity",
  raised: "Date raised",
  project: "Project",
};

/** One line of the breakdown box. */
export type BreakdownRow = {
  key: string;
  label: string;
  /** Open items in this bucket. */
  count: number;
  overdue: number;
  /** The members, worst first, so a row can be opened. */
  items: DashboardItem[];
  /**
   * One plain sentence saying what the bucket means, where the axis needs one.
   * Only the severity rungs carry it, because "Planned in" is not self-explanatory
   * the way "Electrical" is.
   */
  meaning: string | null;
};

export const UNSET_LABEL = "Not set";

/**
 * The severity scales in the product are per template, and the stored value is the
 * template's own key (`danger_present`, `this_week`, `improvement_item`). Reading
 * them back as they were chosen is the honest thing to do on the record and on the
 * report: the code is not a sentence, and each template's words belong to that
 * template.
 *
 * On the dashboard, where items from every template are read together, those words
 * are grouped onto the urgency ladder instead - see `severity-ladder.ts` for the
 * four rungs and the one place the mapping lives. The item still reads in its own
 * words underneath; only the grouping is on urgency.
 */
const SEVERITY_WORDS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  cosmetic: "Cosmetic",
  workmanship: "Workmanship",
  performance: "Performance",
  compliance: "Compliance",
  structural_safety: "Structural or safety",
  immediate: "Immediate — stop work",
  same_day: "Same day",
  this_week: "This week",
  housekeeping: "Housekeeping",
  danger_present: "Danger present",
  potentially_dangerous: "Potentially dangerous",
  improvement_item: "Improvement item",
  further_investigation: "Further investigation",
  leak_or_imminent_failure: "Leak or imminent failure",
  commissioning_risk: "Commissioning risk",
  efficiency_loss: "Efficiency loss",
  labelling_item: "Labelling or tidy-up",
  prominent_area: "Prominent area",
  specification_difference: "Specification difference",
  interface_unresolved: "Interface unresolved",
  visual_minor: "Visual, minor",
  occupancy_risk: "Mould with occupancy risk",
  widespread_moisture: "Widespread moisture",
  localised_ingress: "Localised ingress",
  surface_marking: "Surface marking",
};

/** A stored severity as words. An unknown key is tidied, never invented. */
export function severityLabel(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return UNSET_LABEL;
  if (SEVERITY_WORDS[raw]) return SEVERITY_WORDS[raw];
  const words = raw.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Monday of the week a date falls in, as YYYY-MM-DD. */
export function weekStart(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

/** e.g. "w/c 6 Oct". */
export function weekLabel(mondayIso: string): string {
  const date = new Date(`${mondayIso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return mondayIso;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function tradeLabel(item: DashboardItem): string {
  const trade = (item.assignedTrade ?? "").trim();
  return trade || "Nobody allocated";
}

function projectLabel(item: DashboardItem): string {
  if (item.projectName) return item.projectName;
  return item.projectId ? "Project not named" : "No project";
}

function bucket(items: readonly DashboardItem[], axis: BreakdownAxis, today: string): Map<string, BreakdownRow> {
  const rows = new Map<string, BreakdownRow>();

  const add = (key: string, label: string, item: DashboardItem, meaning: string | null = null) => {
    let row = rows.get(key);
    if (!row) {
      row = { key, label, count: 0, overdue: 0, items: [], meaning };
      rows.set(key, row);
    }
    row.count += 1;
    if (stateOf(item, today) === "overdue") row.overdue += 1;
    row.items.push(item);
  };

  for (const item of items) {
    switch (axis) {
      case "trade":
        add(tradeLabel(item), tradeLabel(item), item);
        break;
      case "severity": {
        const step = ladderStepFor(item.severity);
        if (!step) {
          add(LADDER_UNSET_KEY, UNSET_LABEL, item);
          break;
        }
        add(step.id, step.label, item, step.meaning);
        break;
      }
      case "raised": {
        const week = item.createdAt ? weekStart(item.createdAt) : null;
        add(week ?? "undated", week ? `w/c ${weekLabel(week)}` : "No date", item);
        break;
      }
      case "project":
        add(item.projectId ?? "none", projectLabel(item), item);
        break;
    }
  }

  return rows;
}

/**
 * The breakdown, worst first: most items, then most overdue, then by name so the
 * order cannot wobble between renders.
 */
export function breakdownOf(
  items: readonly DashboardItem[],
  axis: BreakdownAxis,
  today: string,
): BreakdownRow[] {
  const open = items.filter((item) => isOpenItem(item, today));
  const rows = [...bucket(open, axis, today).values()];
  for (const row of rows) {
    row.items.sort((a, b) => (daysLate(b, today) ?? -1) - (daysLate(a, today) ?? -1) || a.id.localeCompare(b.id));
  }
  // The severity axis is a scale, not a list: it is drawn worst first, every rung
  // is shown even when nothing is on it (an empty "Do it now" is information), and
  // anything the ladder cannot read stays at the bottom under its own heading.
  if (axis === "severity") {
    const present = new Map(rows.map((row) => [row.key, row]));
    const ordered: BreakdownRow[] = [];
    for (const step of LADDER) {
      ordered.push(
        present.get(step.id) ?? {
          key: step.id,
          label: step.label,
          count: 0,
          overdue: 0,
          items: [],
          meaning: step.meaning,
        },
      );
      present.delete(step.id);
    }
    for (const row of [...present.values()].sort((a, b) => ladderRank(a.key) - ladderRank(b.key))) {
      ordered.push(row);
    }
    return ordered;
  }
  return rows.sort(
    (a, b) =>
      b.count - a.count ||
      b.overdue - a.overdue ||
      a.label.localeCompare(b.label),
  );
}

export type RaisedWeek = {
  week: string;
  label: string;
  raised: number;
};

/** Items raised per week for the last `weeks` weeks, oldest first. */
export function raisedByWeek(
  items: readonly DashboardItem[],
  weeks: number,
  today: string,
): RaisedWeek[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.createdAt) continue;
    const week = weekStart(item.createdAt);
    if (week) counts.set(week, (counts.get(week) ?? 0) + 1);
  }

  const thisMonday = weekStart(`${today}T00:00:00Z`);
  if (!thisMonday) return [];

  const out: RaisedWeek[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const d = new Date(`${thisMonday}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const week = d.toISOString().slice(0, 10);
    out.push({ week, label: `${weekLabel(week)}`, raised: counts.get(week) ?? 0 });
  }
  return out;
}

/** Every open item with a date that has passed, most late first. */
export function overdueItems(items: readonly DashboardItem[], today: string): DashboardItem[] {
  return items
    .filter((item) => isOpenItem(item, today) && stateOf(item, today) === "overdue")
    .sort((a, b) => (daysLate(b, today) ?? -1) - (daysLate(a, today) ?? -1) || a.id.localeCompare(b.id));
}
