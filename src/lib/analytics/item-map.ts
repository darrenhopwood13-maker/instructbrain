/**
 * The item map: every open item in the organisation as one cell.
 *
 * This is the heavy half of the dashboard. It exists because a list tells you
 * what happened and a map tells you *where the weight is* - and because an item
 * nobody has assessed is invisible in a percentage but obvious as an empty
 * square.
 *
 * All of the reasoning lives here as pure functions, separate from the React
 * that draws it, so the grouping, the state of every cell and the "needs
 * attention" order can be tested rather than trusted.
 */

/** The first value that actually has text in it, or a stated fallback.
 *
 * Deliberately not `??`, which skips only null and undefined: an empty string is
 * a real value to the operator and would win, leaving a blank title where the
 * reference should have been.
 */
export function firstNonEmptyText(
  ...values: Array<string | null | undefined | { toString(): string }>
): string {
  for (const value of values) {
    const trimmed = (typeof value === "string" ? value : (value?.toString() ?? "")).trim();
    if (trimmed) return trimmed;
  }
  return "Untitled item";
}

/** Lifecycle states that mean the item is still someone's problem. */
export const OPEN_LIFECYCLE_STATES = [
  "open",
  "assigned",
  "in_progress",
  "fixed",
  "rejected",
] as const;

/** One finding, flattened with just enough of its report and project to group it. */
export type DashboardItem = {
  id: string;
  ref: string | null;
  title: string | null;
  /** The survey's own status id, e.g. "snag", "not_assessed", "compliant". */
  status: string | null;
  lifecycleState: string | null;
  severity: string | null;
  dueDate: string | null;
  createdAt: string | null;
  assignedTrade: string | null;
  reportId: string;
  reportRef: string | null;
  reportTitle: string | null;
  reportDate: string | null;
  surveyLabel: string | null;
  projectId: string | null;
  projectName: string | null;
  projectRef: string | null;
};

/**
 * The five things a cell can be, in precedence order. Precedence matters: an
 * item that is both allocated and overdue must read as overdue, because that is
 * the one somebody has to do something about.
 */
export type ItemState = "closed" | "overdue" | "assigned" | "not_assessed" | "open";

export const STATE_ORDER: ItemState[] = ["overdue", "not_assessed", "assigned", "open", "closed"];

export const STATE_LABEL: Record<ItemState, string> = {
  closed: "Closed out",
  overdue: "Overdue",
  assigned: "Allocated",
  not_assessed: "Not assessed",
  open: "Open",
};

/**
 * The cell palette.
 *
 * This is a data scale, not theme chrome, so it is defined once here rather than
 * borrowed from whatever surface it happens to sit on. Three deliberate calls:
 *
 * - "Allocated" is NOT `--brand-blue`: that navy is almost the same tone as the
 *   app's own navy surface, so allocated cells disappeared into the map.
 * - "Open" is a mid grey, not `--muted-foreground`, which resolves almost white.
 *   Open is the normal state and should be the quietest thing on the panel; as
 *   the brightest it pulled the eye away from the work that is actually late.
 * - "Not assessed" is an outline rather than a fill, because it is an absence -
 *   and the one thing it must never look like is a normal open item.
 *
 * The values are chosen to stay distinct from each other on a dark navy surface.
 */
export const STATE_FILL: Record<ItemState, string> = {
  closed: "var(--brand-accent)",
  overdue: "var(--fail)",
  assigned: "#4C86FF",
  open: "#7E8AA3",
  not_assessed: "transparent",
};

/** The states that are drawn as an outline instead of a filled square. */
export const OUTLINE_STATES: ItemState[] = ["not_assessed"];

const CLOSED_STATES = ["verified", "closed", "complete", "completed"];
const ASSIGNED_STATES = ["assigned", "in_progress", "fixed", "rejected"];

function isOpenLifecycle(state: string | null): boolean {
  return (OPEN_LIFECYCLE_STATES as readonly string[]).includes(state ?? "");
}

/** The `today` value is passed in, never read from the clock, so tests are stable. */
export function stateOf(item: DashboardItem, today: string): ItemState {
  const lifecycle = (item.lifecycleState ?? "").toLowerCase();
  if (CLOSED_STATES.includes(lifecycle)) return "closed";
  if (isOpenLifecycle(lifecycle) && item.dueDate !== null && item.dueDate < today) return "overdue";
  if (ASSIGNED_STATES.includes(lifecycle)) return "assigned";
  if ((item.status ?? "").toLowerCase() === "not_assessed") return "not_assessed";
  return "open";
}

export type ItemGroup = {
  key: string;
  label: string;
  /** A second line under the label - a reference, or a count. */
  sublabel: string | null;
  items: DashboardItem[];
};

export type GroupBy = "project" | "survey" | "report";

export const GROUP_LABEL: Record<GroupBy, string> = {
  project: "Project",
  survey: "Survey",
  report: "Report",
};

/** How many days past its due date an item is, or null when it has no date or is not late. */
export function daysLate(item: DashboardItem, today: string): number | null {
  if (!item.dueDate) return null;
  const due = Date.parse(`${item.dueDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) return null;
  const days = Math.round((now - due) / 86_400_000);
  return days > 0 ? days : null;
}

function groupKeyOf(item: DashboardItem, groupBy: GroupBy): { key: string; label: string; sublabel: string | null } {
  if (groupBy === "project") {
    return {
      key: item.projectId ?? "__none",
      label: item.projectName ?? "No project",
      sublabel: item.projectRef ?? `${item.reportRef ?? "quick report"}`,
    };
  }
  if (groupBy === "survey") {
    return {
      key: item.surveyLabel ?? "__unclassified",
      label: item.surveyLabel ?? "Unclassified",
      sublabel: null,
    };
  }
  return {
    key: item.reportId,
    label: item.reportRef ?? "Untitled report",
    sublabel: item.reportTitle ?? null,
  };
}

export type ItemMap = {
  groups: ItemGroup[];
  /** Groups that exist but were left out of the grid to keep it readable. */
  omittedGroups: number;
  omittedItems: number;
  totalGroups: number;
  /** Every item in scope, grouped or not - the totals never depend on the cap. */
  totals: {
    items: number;
    shown: number;
    byState: Record<ItemState, number>;
    /** Items with no project, which is normal for a quick report. */
    unassignedToProject: number;
  };
};

/**
 * Build the grid.
 *
 * `maxGroups` caps how many rows are drawn. The cap is reported, never silent:
 * a grid that quietly drops half the account is worse than one that says so.
 */
export function buildItemMap(
  items: DashboardItem[],
  options: { groupBy: GroupBy; today: string; maxGroups?: number },
): ItemMap {
  const { groupBy, today } = options;
  const maxGroups = options.maxGroups ?? 12;

  const byState: Record<ItemState, number> = {
    closed: 0,
    overdue: 0,
    assigned: 0,
    not_assessed: 0,
    open: 0,
  };
  for (const item of items) byState[stateOf(item, today)] += 1;

  const buckets = new Map<string, ItemGroup>();
  for (const item of items) {
    const { key, label, sublabel } = groupKeyOf(item, groupBy);
    let group = buckets.get(key);
    if (!group) {
      group = { key, label, sublabel, items: [] };
      buckets.set(key, group);
    }
    group.items.push(item);
  }

  const groups = Array.from(buckets.values()).sort(
    (a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label, "en-GB"),
  );

  const shown = groups.slice(0, maxGroups);
  const hidden = groups.slice(maxGroups);

  return {
    groups: shown,
    omittedGroups: hidden.length,
    omittedItems: hidden.reduce((total, group) => total + group.items.length, 0),
    totalGroups: groups.length,
    totals: {
      items: items.length,
      shown: shown.reduce((total, group) => total + group.items.length, 0),
      byState,
      unassignedToProject: items.filter((item) => item.projectId === null).length,
    },
  };
}

/**
 * What to do first: whatever is past its date, oldest first, then anything
 * nobody has assessed. Allocated-but-in-date work is not urgent and stays out.
 */
export function attentionItems(items: DashboardItem[], today: string, limit = 8): DashboardItem[] {
  const late = items
    .filter((item) => stateOf(item, today) === "overdue")
    .sort((a, b) => (daysLate(b, today) ?? 0) - (daysLate(a, today) ?? 0));
  const unassessed = items
    .filter((item) => stateOf(item, today) === "not_assessed")
    .sort((a, b) => (a.reportRef ?? "").localeCompare(b.reportRef ?? "", "en-GB"));
  return [...late, ...unassessed].slice(0, limit);
}

/** The line under a group label, e.g. "12 of these are overdue". */
export function groupSummary(items: DashboardItem[], today: string): { late: number; unassessed: number } {
  let late = 0;
  let unassessed = 0;
  for (const item of items) {
    const state = stateOf(item, today);
    if (state === "overdue") late += 1;
    if (state === "not_assessed") unassessed += 1;
  }
  return { late, unassessed };
}
