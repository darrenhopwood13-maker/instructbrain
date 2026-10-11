/**
 * The organisation overview: every number on the dashboard, computed in one
 * pure function so it can be tested rather than trusted.
 *
 * Two rules this file exists to keep:
 *
 * 1. **The dashboard must not disagree with the rest of the app.** "Overdue" is
 *    the same rule the Overdue items list uses (`orgOverdueItemsQuery`): an item
 *    that is still open and whose due date has passed. If that rule changes
 *    there, it changes here, and a test fails.
 *
 * 2. **A number is never silently filtered.** The caller passes in the rows it
 *    wants counted. Excluding test or demo data is the caller's decision and is
 *    stated on the panel - see `overview-exclusions.ts`. This function counts
 *    what it is given and says how many rows it saw, so a screen can show the
 *    difference rather than hide it.
 */

/** Lifecycle states that mean the item is still someone's problem. */
export const OPEN_LIFECYCLE_STATES = [
  "open",
  "assigned",
  "in_progress",
  "fixed",
  "rejected",
] as const;

/** Lifecycle states that mean the item is finished with. */
export const CLOSED_LIFECYCLE_STATES = ["verified", "closed"] as const;

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  issued: "Issued",
};

/** Order the statuses are shown in, so the chart does not reshuffle between loads. */
const STATUS_ORDER = ["draft", "in_review", "issued"];

export type OverviewReportRow = {
  id: string;
  status: string | null;
  created_at: string | null;
  project_id: string | null;
  is_quick: boolean | null;
};

export type OverviewFindingRow = {
  report_id: string;
  lifecycle_state: string | null;
  due_date: string | null;
};

export type OverviewProjectRow = {
  id: string;
  name: string;
  reference: string | null;
};

export type Overview = {
  totals: {
    reports: number;
    issued: number;
    drafts: number;
    quick: number;
    projectReports: number;
    items: number;
    openItems: number;
    closedItems: number;
    overdueItems: number;
    projects: number;
    withReports: number;
  };
  /** Reports by status, in a fixed order. Empty statuses are absent. */
  byStatus: Array<{ status: string; label: string; count: number }>;
  /**
   * One row per project. Every project appears, including one with no reports
   * yet - a league table that hides the empty ones hides the answer to "which
   * project have we not surveyed?".
   */
  byProject: Array<{
    id: string;
    name: string;
    reference: string | null;
    reports: number;
    openItems: number;
    overdueItems: number;
    lastActivity: string | null;
  }>;
  /** Reports created per calendar month, oldest first, oldest month trimmed. */
  monthly: Array<{ key: string; label: string; reports: number; items: number }>;
};

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

function monthKey(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The `count` month keys ending at the month of `iso`, oldest first. */
export function monthKeysEndingAt(iso: string, count: number): string[] {
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return [];
  const keys: string[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const point = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - back, 1));
    keys.push(`${point.getUTCFullYear()}-${String(point.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function isOpen(state: string | null): boolean {
  return (OPEN_LIFECYCLE_STATES as readonly string[]).includes(state ?? "");
}

export function overviewFrom(input: {
  reports: OverviewReportRow[];
  findings: OverviewFindingRow[];
  projects: OverviewProjectRow[];
  /** "Now", as an ISO date, passed in so the result is deterministic in tests. */
  today: string;
  /** How many months of trend to show. Defaults to six. */
  months?: number;
}): Overview {
  const { reports, findings, projects, today } = input;
  const months = input.months ?? 6;
  const todayMs = new Date(today).getTime();

  const issued = reports.filter((row) => row.status === "issued").length;
  const drafts = reports.filter((row) => row.status !== "issued").length;
  const quick = reports.filter((row) => row.is_quick === true).length;

  const openItems = findings.filter((row) => isOpen(row.lifecycle_state)).length;
  const closedItems = findings.length - openItems;
  const overdueItems = findings.filter(
    (row) => isOpen(row.lifecycle_state) && row.due_date !== null && new Date(row.due_date).getTime() < todayMs,
  ).length;

  const byStatus = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status] ?? status,
    count: reports.filter((row) => (row.status ?? "draft") === status).length,
  })).filter((entry) => entry.count > 0);

  // Findings are joined to their report to attribute them to a project. A
  // finding whose report is outside the caller's set is not counted here - the
  // caller has already scoped both lists to the same organisations.
  const projectOfReport = new Map<string, string | null>();
  for (const report of reports) projectOfReport.set(report.id, report.project_id);

  const perProject = new Map<
    string,
    { reports: number; openItems: number; overdueItems: number; lastActivity: string | null }
  >();
  for (const project of projects) {
    perProject.set(project.id, { reports: 0, openItems: 0, overdueItems: 0, lastActivity: null });
  }

  for (const report of reports) {
    const bucket = report.project_id ? perProject.get(report.project_id) : undefined;
    if (!bucket) continue;
    bucket.reports += 1;
    if (report.created_at && (!bucket.lastActivity || report.created_at > bucket.lastActivity)) {
      bucket.lastActivity = report.created_at;
    }
  }

  for (const finding of findings) {
    const projectId = projectOfReport.get(finding.report_id) ?? null;
    const bucket = projectId ? perProject.get(projectId) : undefined;
    if (!bucket) continue;
    if (isOpen(finding.lifecycle_state)) {
      bucket.openItems += 1;
      if (finding.due_date !== null && new Date(finding.due_date).getTime() < todayMs) {
        bucket.overdueItems += 1;
      }
    }
  }

  const byProject = projects
    .map((project) => ({
      id: project.id,
      name: project.name,
      reference: project.reference,
      ...(perProject.get(project.id) ?? {
        reports: 0,
        openItems: 0,
        overdueItems: 0,
        lastActivity: null,
      }),
    }))
    // Most reports first, then most open items, then alphabetical so the order is
    // stable rather than dependent on the query's row order.
    .sort(
      (a, b) =>
        b.reports - a.reports ||
        b.openItems - a.openItems ||
        a.name.localeCompare(b.name, "en-GB"),
    );

  const keys = monthKeysEndingAt(today, months);
  const reportMonths = new Map<string, number>();
  const itemMonths = new Map<string, number>();
  const monthOfReport = new Map<string, string>();
  for (const report of reports) {
    const key = monthKey(report.created_at);
    if (key) {
      monthOfReport.set(report.id, key);
      reportMonths.set(key, (reportMonths.get(key) ?? 0) + 1);
    }
  }
  for (const finding of findings) {
    const key = monthOfReport.get(finding.report_id);
    if (key) itemMonths.set(key, (itemMonths.get(key) ?? 0) + 1);
  }

  const monthly = keys.map((key) => ({
    key,
    label: MONTH_LABEL.format(new Date(`${key}-01T00:00:00Z`)),
    reports: reportMonths.get(key) ?? 0,
    items: itemMonths.get(key) ?? 0,
  }));

  return {
    totals: {
      reports: reports.length,
      issued,
      drafts,
      quick,
      projectReports: reports.length - quick,
      items: findings.length,
      openItems,
      closedItems,
      overdueItems,
      projects: projects.length,
      withReports: byProject.filter((project) => project.reports > 0).length,
    },
    byStatus,
    byProject,
    monthly,
  };
}
