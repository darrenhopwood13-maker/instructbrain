import type { RecentReport } from "@/lib/types";

/** The heading a report with no survey type of its own is filed under. */
export const NO_TYPE_LABEL = "No report type";

export type ReportStack = {
  key: string;
  label: string;
  count: number;
  /** Of those, how many are still drafts — the ones nobody has issued yet. */
  drafts: number;
  /** The date the most recently worked-on one was updated, as the list formats it. */
  newest: string | null;
  /** The type's own reports, newest first. */
  reports: RecentReport[];
};

const NONE_KEY = "__no_type";

/**
 * One stack per report type, in the order each type's newest report appears.
 *
 * The input is expected newest-first - that is what the reports query asks for - and
 * the stacks come back in that same order: the type you worked on most recently
 * leads. Within a stack the order is preserved, so its first row is its newest.
 *
 * A report carrying no survey type is a real state (a hand-made or migrated report),
 * so it gets its own stack under a plain heading rather than being dropped from the
 * page or folded into a type it does not belong to.
 */
export function reportStacks(reports: readonly RecentReport[]): ReportStack[] {
  const stacks = new Map<string, ReportStack>();

  for (const report of reports) {
    const label = (report.surveyLabel ?? "").trim();
    const key = label === "" ? NONE_KEY : label;
    let stack = stacks.get(key);
    if (!stack) {
      stack = {
        key,
        label: label === "" ? NO_TYPE_LABEL : label,
        count: 0,
        drafts: 0,
        newest: report.updated,
        reports: [],
      };
      stacks.set(key, stack);
    }
    stack.count += 1;
    if (report.status === "draft") stack.drafts += 1;
    stack.reports.push(report);
  }

  return [...stacks.values()];
}

/** The line under a stack's name: how many, how many are drafts, newest date. */
export function stackSummary(stack: ReportStack): string {
  const parts = [`${stack.count} report${stack.count === 1 ? "" : "s"}`];
  if (stack.drafts > 0) parts.push(`${stack.drafts} draft${stack.drafts === 1 ? "" : "s"}`);
  if (stack.newest) parts.push(`newest ${stack.newest}`);
  return parts.join(" · ");
}

/** How many report types the page is showing, for the line above the stacks. */
export function reportTypeCount(stacks: readonly ReportStack[]): number {
  return stacks.length;
}
