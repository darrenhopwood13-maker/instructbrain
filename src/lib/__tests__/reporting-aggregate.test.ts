import { describe, expect, it } from "vitest";

import type { DashboardItem } from "@/lib/analytics/item-map";
import { buildPortfolioReport, periodFor, type ReportScope } from "@/lib/reporting/aggregate";

function item(overrides: Partial<DashboardItem> = {}): DashboardItem {
  return {
    id: overrides.id ?? `item-${Math.random().toString(36).slice(2, 9)}`,
    ref: "F-001",
    title: "Cracked render to stair core",
    status: "snag",
    lifecycleState: "open",
    severity: "medium",
    dueDate: null,
    createdAt: "2026-03-02T09:00:00Z",
    closedAt: null,
    updatedAt: null,
    assignedTrade: "Bricklayer",
    reportId: "report-1",
    reportRef: "R-001",
    reportTitle: "Site inspection",
    reportDate: "2026-03-02",
    surveyLabel: "Finding identification",
    projectId: "project-a",
    projectName: "Northbank Phase 3",
    projectRef: "DEMO-01",
    ...overrides,
  };
}

const ALL: ReportScope = { kind: "organisation", projectId: null, label: "Whole account" };

describe("periodFor", () => {
  it("runs this month from the first to today", () => {
    const period = periodFor("this_month", "2026-03-15");
    expect(period.from).toBe("2026-03-01");
    expect(period.to).toBe("2026-03-15");
    expect(period.label).toBe("Mar 2026");
  });

  it("runs last month across the actual month end, including February", () => {
    expect(periodFor("last_month", "2026-01-10")).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodFor("last_month", "2026-03-10")).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("runs the quarter from its first day, and stops today rather than claiming the quarter", () => {
    const period = periodFor("this_quarter", "2026-05-02");
    expect(period.from).toBe("2026-04-01");
    expect(period.to).toBe("2026-05-02");
    expect(period.label).toBe("Q2 2026 to date");
  });

  it("counts the last 90 days inclusive of today", () => {
    const period = periodFor("last_90", "2026-03-31");
    expect(period.from).toBe("2026-01-01");
    expect(period.to).toBe("2026-03-31");
  });
});

describe("buildPortfolioReport", () => {
  const period = periodFor("this_month", "2026-03-20");

  it("counts raised and closed independently, so an old item closed now appears in closed only", () => {
    const report = buildPortfolioReport({
      today: "2026-03-20",
      scope: ALL,
      period,
      items: [
        item({ createdAt: "2026-03-05T09:00:00Z" }),
        item({ createdAt: "2026-01-05T09:00:00Z", lifecycleState: "closed", closedAt: "2026-03-10T09:00:00Z" }),
      ],
    });
    expect(report.headline.raised).toBe(1);
    expect(report.headline.closed).toBe(1);
    expect(report.headline.open).toBe(1);
  });

  it("cannot count a close it cannot date, so an undated close is not in the period", () => {
    const report = buildPortfolioReport({
      today: "2026-03-20",
      scope: ALL,
      period,
      items: [
        item({ createdAt: "2026-03-01T00:00:00Z", lifecycleState: "closed", closedAt: "2026-03-11T00:00:00Z" }),
        item({ createdAt: "2026-03-01T00:00:00Z", lifecycleState: "closed", closedAt: null }),
      ],
    });
    // The second item is closed but records no sign-off date, so it cannot belong to a period.
    expect(report.headline.closed).toBe(1);
    expect(report.headline.medianDaysToClose).toBe(10);
  });

  it("leaves cycle time null and says so rather than estimating", () => {
    const report = buildPortfolioReport({
      today: "2026-03-20",
      scope: ALL,
      period,
      items: [item({ createdAt: "2026-03-01T00:00:00Z", lifecycleState: "closed", closedAt: null })],
    });
    expect(report.headline.medianDaysToClose).toBeNull();
    expect(report.caveats.join(" ")).toContain("no cycle time to report");
  });

  it("counts overdue only against open work, and states it as a share of open", () => {
    const report = buildPortfolioReport({
      today: "2026-03-20",
      scope: ALL,
      period,
      items: [
        item({ dueDate: "2026-03-10" }),
        item({ dueDate: "2026-03-19" }),
        item({ dueDate: "2026-03-01", lifecycleState: "closed", closedAt: "2026-03-12T00:00:00Z" }),
        item({ dueDate: null }),
      ],
    });
    expect(report.headline.open).toBe(3);
    expect(report.headline.overdue).toBe(2);
    expect(report.headline.lateShare).toBe(67);
  });

  it("orders trades worst first, and groups blank trades rather than dropping them", () => {
    const report = buildPortfolioReport({
      today: "2026-03-20",
      scope: ALL,
      period,
      items: [
        item({ assignedTrade: "Electrical", dueDate: "2026-03-01" }),
        item({ assignedTrade: "Electrical", dueDate: "2026-03-02" }),
        item({ assignedTrade: "Joiner", dueDate: "2026-03-18" }),
        item({ assignedTrade: "" }),
      ],
    });
    expect(report.trades[0]?.trade).toBe("Electrical");
    expect(report.trades[0]?.overdue).toBe(2);
    expect(report.trades.map((line) => line.trade)).toContain("Unassigned");
  });

  it("lists past-their-date items worst first, capped, and never a closed one", () => {
    const items = Array.from({ length: 14 }, (_unused, index) =>
      item({ id: `late-${index}`, dueDate: `2026-03-${String(index + 1).padStart(2, "0")}` }),
    );
    items.push(item({ id: "closed-late", dueDate: "2026-01-01", lifecycleState: "closed", closedAt: "2026-02-01T00:00:00Z" }));

    const report = buildPortfolioReport({ today: "2026-03-20", scope: ALL, period, items });
    expect(report.worst).toHaveLength(10);
    expect(report.worst[0]?.daysLate).toBeGreaterThanOrEqual(report.worst[1]?.daysLate ?? 0);
    expect(report.worst.some((entry) => entry.ref === "F-001" && entry.daysLate > 60)).toBe(false);
  });

  it("narrows to a single project when the scope names one", () => {
    const scope: ReportScope = { kind: "project", projectId: "project-b", label: "Wellington Place" };
    const report = buildPortfolioReport({
      today: "2026-03-20",
      scope,
      period,
      items: [item({ projectId: "project-a", projectName: "Northbank" }), item({ projectId: "project-b", projectName: "Wellington Place" })],
    });
    expect(report.headline.open).toBe(1);
    expect(report.projects).toHaveLength(1);
    expect(report.projects[0]?.name).toBe("Wellington Place");
  });

  it("speaks in internal shorthand only for an internal report", () => {
    const items = [
      item({
        createdAt: "2026-03-01T00:00:00Z",
        lifecycleState: "closed",
        closedAt: "2026-03-12T00:00:00Z",
        updatedAt: "2026-03-12T00:00:00Z",
      }),
    ];
    const internal = buildPortfolioReport({ today: "2026-03-20", scope: ALL, period, items, mode: "internal" });
    const client = buildPortfolioReport({ today: "2026-03-20", scope: ALL, period, items, mode: "client" });

    expect(internal.headline.backfilledCloses).toBe(1);
    expect(internal.caveats.join(" ")).toContain("dated from the item's last update");
    expect(client.caveats.join(" ").toLowerCase()).not.toContain("last update");
    expect(client.caveats.join(" ")).toContain("recorded sign-off date");
  });

  it("says the figures are partial when the query hit its row cap", () => {
    const report = buildPortfolioReport({
      today: "2026-03-20",
      scope: ALL,
      period,
      items: [item()],
      truncated: true,
    });
    expect(report.caveats.join(" ")).toContain("most recent rows only");
  });

  it("reports an empty scope as empty rather than as zeroes dressed up", () => {
    const report = buildPortfolioReport({ today: "2026-03-20", scope: ALL, period, items: [] });
    expect(report.empty).toBe(true);
    expect(report.trades).toHaveLength(0);
  });
});
