import type { RecentReport, ReportStatus } from "@/lib/types";

/**
 * What the reports page is currently narrowed to.
 *
 * Every field has an "everything" value so the empty filter set is expressible as data
 * rather than as a pile of undefined checks - that keeps the page honest about whether it
 * is filtering, and lets the same value be dropped straight into a picker.
 */
export type ReportFilters = {
  /** Free text over the title, the reference, the report type and the project name. */
  search: string;
  status: ReportStatus | "all";
  /** A report type's label as the stack groups it. Empty string means "carries no type". */
  survey: string | "all";
  /** A project id, "none" for reports never attached to one, or "all". */
  project: string | "all" | "none";
  /** Days back from today, or "all". Matches on the last time the report was worked on. */
  period: "all" | "7" | "30" | "90" | "365";
};

export const NO_FILTERS: ReportFilters = {
  search: "",
  status: "all",
  survey: "all",
  project: "all",
  period: "all",
};

export const periodLabels: Record<ReportFilters["period"], string> = {
  all: "Any time",
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  "365": "Last 12 months",
};

/** How many filters are actually narrowing the page. Drives the "Clear" control. */
export function countActiveFilters(filters: ReportFilters): number {
  let count = 0;
  if (filters.search.trim() !== "") count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.survey !== "all") count += 1;
  if (filters.project !== "all") count += 1;
  if (filters.period !== "all") count += 1;
  return count;
}

export function filtersAreActive(filters: ReportFilters): boolean {
  return countActiveFilters(filters) > 0;
}

type FilterContext = {
  /** Used for the period filter and for the free-text match on project names. */
  now?: Date;
  projectNameById?: Map<string, string>;
};

function matchesSearch(
  report: RecentReport,
  needle: string,
  projectNameById: Map<string, string>,
): boolean {
  if (needle === "") return true;
  const haystack = [
    report.title,
    report.reference,
    report.surveyLabel ?? "",
    report.projectId ? (projectNameById.get(report.projectId) ?? "") : "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

function matchesPeriod(report: RecentReport, period: ReportFilters["period"], now: Date): boolean {
  if (period === "all") return true;
  /* A report with no machine-readable date cannot be shown to fall inside a window, and
     guessing from the formatted label would be a fiction - so it is left out. The list
     query always supplies the date; this only guards older shapes. */
  if (!report.updatedAt) return false;
  const stamped = new Date(report.updatedAt);
  if (Number.isNaN(stamped.getTime())) return false;
  const days = Number(period);
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return stamped.getTime() >= cutoff.getTime() && stamped.getTime() <= now.getTime();
}

/**
 * The reports that survive every active filter.
 *
 * Order is preserved: the query hands the page newest-first and nothing here re-sorts it,
 * so the stacks stay in the order a person expects after narrowing.
 */
export function filterReports(
  reports: readonly RecentReport[],
  filters: ReportFilters,
  context: FilterContext = {},
): RecentReport[] {
  const needle = filters.search.trim().toLowerCase();
  const projectNameById = context.projectNameById ?? new Map<string, string>();
  const now = context.now ?? new Date();

  return reports.filter((report) => {
    if (!matchesSearch(report, needle, projectNameById)) return false;

    if (filters.status !== "all" && report.status !== filters.status) return false;

    if (filters.survey !== "all") {
      const label = (report.surveyLabel ?? "").trim();
      if (label !== filters.survey) return false;
    }

    if (filters.project === "none") {
      if (report.projectId !== null) return false;
    } else if (filters.project !== "all") {
      if (report.projectId !== filters.project) return false;
    }

    return matchesPeriod(report, filters.period, now);
  });
}

/** The report types present in a list, de-duplicated and in the order they appear. */
export function surveyOptions(reports: readonly RecentReport[]): Array<{ value: string; label: string }> {
  const seen = new Map<string, string>();
  for (const report of reports) {
    const label = (report.surveyLabel ?? "").trim();
    if (!seen.has(label)) seen.set(label, label === "" ? "No report type" : label);
  }
  return [...seen.entries()].map(([value, label]) => ({ value, label }));
}
