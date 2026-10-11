import { describe, expect, it } from "vitest";

import {
  monthKeysEndingAt,
  overviewFrom,
  type OverviewFindingRow,
  type OverviewProjectRow,
  type OverviewReportRow,
} from "@/lib/analytics/overview";

const TODAY = "2026-10-11T09:00:00.000Z";

function report(over: Partial<OverviewReportRow> = {}): OverviewReportRow {
  return {
    id: over.id ?? "r1",
    status: over.status ?? "draft",
    created_at: over.created_at ?? "2026-10-01T10:00:00.000Z",
    project_id: over.project_id ?? "p1",
    is_quick: over.is_quick ?? false,
  };
}

function finding(over: Partial<OverviewFindingRow> = {}): OverviewFindingRow {
  return {
    report_id: over.report_id ?? "r1",
    // `?? "open"` would turn an explicit null back into "open", which would
    // silently test a different case than the one written.
    lifecycle_state: "lifecycle_state" in over ? (over.lifecycle_state ?? null) : "open",
    due_date: over.due_date ?? null,
  };
}

function project(over: Partial<OverviewProjectRow> = {}): OverviewProjectRow {
  return { id: over.id ?? "p1", name: over.name ?? "Sappho 7", reference: over.reference ?? "SP7" };
}

describe("the organisation overview", () => {
  it("counts reports by status and keeps a fixed order", () => {
    const out = overviewFrom({
      reports: [
        report({ id: "a", status: "issued" }),
        report({ id: "b", status: "issued" }),
        report({ id: "c", status: "draft" }),
      ],
      findings: [],
      projects: [],
      today: TODAY,
    });
    expect(out.byStatus.map((entry) => entry.status)).toEqual(["draft", "issued"]);
    expect(out.totals).toMatchObject({ reports: 3, issued: 2, drafts: 1 });
  });

  it("treats a null status as a draft rather than dropping the report", () => {
    const out = overviewFrom({
      reports: [report({ status: null })],
      findings: [],
      projects: [],
      today: TODAY,
    });
    expect(out.totals.reports).toBe(1);
    expect(out.byStatus).toEqual([{ status: "draft", label: "Draft", count: 1 }]);
  });

  it("counts open and closed items from the lifecycle, not from the status", () => {
    const out = overviewFrom({
      reports: [report()],
      findings: [
        finding({ lifecycle_state: "open" }),
        finding({ lifecycle_state: "assigned" }),
        finding({ lifecycle_state: "verified" }),
        finding({ lifecycle_state: null }),
      ],
      projects: [project()],
      today: TODAY,
    });
    expect(out.totals.items).toBe(4);
    expect(out.totals.openItems).toBe(2);
    expect(out.totals.closedItems).toBe(2);
  });

  it("counts an item overdue only when it is still open and the date has passed", () => {
    const out = overviewFrom({
      reports: [report()],
      findings: [
        finding({ due_date: "2026-10-01T00:00:00.000Z" }), // past, open -> overdue
        finding({ due_date: "2026-11-01T00:00:00.000Z" }), // future
        finding({ due_date: null }), // no date is not overdue
        finding({ lifecycle_state: "verified", due_date: "2026-01-01T00:00:00.000Z" }), // closed
      ],
      projects: [project()],
      today: TODAY,
    });
    expect(out.totals.overdueItems).toBe(1);
  });

  it("keeps every project in the league table, including one with nothing on it", () => {
    const out = overviewFrom({
      reports: [report({ id: "a", project_id: "p1" }), report({ id: "b", project_id: "p1" })],
      findings: [finding({ report_id: "a" })],
      projects: [project({ id: "p1", name: "Sappho 7" }), project({ id: "p2", name: "Quiet job" })],
      today: TODAY,
    });
    expect(out.byProject.map((row) => row.name)).toEqual(["Sappho 7", "Quiet job"]);
    expect(out.byProject[1]).toMatchObject({ reports: 0, openItems: 0 });
    expect(out.totals).toMatchObject({ projects: 2, withReports: 1 });
  });

  it("orders the league table by reports, then open items, then name", () => {
    const out = overviewFrom({
      reports: [
        report({ id: "a", project_id: "p1" }),
        report({ id: "b", project_id: "p2" }),
        report({ id: "c", project_id: "p2" }),
      ],
      findings: [],
      projects: [
        project({ id: "p1", name: "Alpha" }),
        project({ id: "p2", name: "Beta" }),
        project({ id: "p3", name: "Gamma" }),
      ],
      today: TODAY,
    });
    expect(out.byProject.map((row) => row.name)).toEqual(["Beta", "Alpha", "Gamma"]);
  });

  it("never attributes an item to a project outside the scoped set", () => {
    const out = overviewFrom({
      reports: [report({ id: "a", project_id: "p1" })],
      // A finding on a report the caller did not scope, and one with no project.
      findings: [finding({ report_id: "somewhere-else" }), finding({ report_id: "a" })],
      projects: [project({ id: "p1" })],
      today: TODAY,
    });
    expect(out.byProject[0]?.openItems).toBe(1);
    // The unscoped item still counts in the org totals, which is the honest
    // reading: it exists, it just does not belong to a project in this list.
    expect(out.totals.items).toBe(2);
  });

  it("builds a six-month trend ending at the current month, oldest first", () => {
    const out = overviewFrom({
      reports: [
        report({ id: "a", created_at: "2026-10-02T00:00:00.000Z" }),
        report({ id: "b", created_at: "2026-10-03T00:00:00.000Z" }),
        report({ id: "c", created_at: "2026-08-03T00:00:00.000Z" }),
        report({ id: "old", created_at: "2025-01-01T00:00:00.000Z" }),
      ],
      findings: [finding({ report_id: "a" })],
      projects: [],
      today: TODAY,
    });
    expect(out.monthly.map((m) => m.key)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(out.monthly.at(-1)).toMatchObject({ key: "2026-10", reports: 2, items: 1 });
    expect(out.monthly.find((m) => m.key === "2026-08")?.reports).toBe(1);
    // A report older than the window is still counted in the totals.
    expect(out.totals.reports).toBe(4);
  });

  it("handles an empty organisation without inventing anything", () => {
    const out = overviewFrom({ reports: [], findings: [], projects: [], today: TODAY });
    expect(out.totals).toMatchObject({
      reports: 0,
      items: 0,
      openItems: 0,
      overdueItems: 0,
      projects: 0,
      withReports: 0,
    });
    expect(out.byStatus).toEqual([]);
    expect(out.byProject).toEqual([]);
    expect(out.monthly).toHaveLength(6);
    expect(out.monthly.every((m) => m.reports === 0)).toBe(true);
  });

  it("rolls the window back across a year boundary", () => {
    expect(monthKeysEndingAt("2026-02-14T00:00:00.000Z", 4)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});
