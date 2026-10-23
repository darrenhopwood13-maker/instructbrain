import { describe, expect, it } from "vitest";
import type { DashboardItem } from "@/lib/analytics/item-map";
import { buildTrends } from "@/lib/map/trends";
import { insightByProject } from "@/lib/map/insight";

const TODAY = "2026-10-23";

function item(over: Partial<DashboardItem>): DashboardItem {
  return {
    id: Math.random().toString(36).slice(2),
    ref: "F-1",
    title: "Cracked render",
    status: "snag",
    lifecycleState: "open",
    severity: "medium",
    dueDate: "2026-10-30",
    createdAt: "2026-10-02T09:00:00Z",
    assignedTrade: "Plastering",
    reportId: "r1",
    reportRef: "SNG-2026-10-001",
    reportTitle: "Snagging",
    reportDate: "2026-10-02",
    surveyLabel: "Snagging",
    projectId: "p1",
    projectName: "Northbank",
    projectRef: "DEMO-01",
    ...over,
  };
}

describe("buildTrends", () => {
  it("returns one cohort per month, oldest first, ending on the current month", () => {
    const report = buildTrends([item({})], TODAY, 6);
    expect(report.cohorts).toHaveLength(6);
    expect(report.cohorts[5]?.key).toBe("2026-10");
    expect(report.cohorts[0]?.key).toBe("2026-05");
  });

  it("counts a month's items and how many of them are still open", () => {
    const items = [
      item({ id: "a", createdAt: "2026-10-01T09:00:00Z" }),
      item({ id: "b", createdAt: "2026-10-02T09:00:00Z", lifecycleState: "closed" }),
    ];
    const report = buildTrends(items, TODAY, 6);
    const october = report.cohorts[5];
    expect(october?.raised).toBe(2);
    expect(october?.stillOpen).toBe(1);
  });

  it("marks the overdue ones inside their cohort", () => {
    const items = [item({ id: "a", dueDate: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" })];
    expect(buildTrends(items, TODAY, 6).cohorts[5]?.overdue).toBe(1);
  });

  it("reports month-on-month change, and null when there is nothing to compare against", () => {
    const quiet = buildTrends([item({ createdAt: "2026-09-05T09:00:00Z" })], TODAY, 6);
    expect(quiet.raisedThisMonth).toBe(0);
    expect(quiet.raisedPreviousMonth).toBe(1);
    expect(quiet.raisedChange).toBe(-100);
    expect(buildTrends([], TODAY, 6).raisedChange).toBeNull();
  });

  it("measures clearance against everything on record", () => {
    const items = [
      item({ id: "a" }),
      item({ id: "b", lifecycleState: "closed" }),
      item({ id: "c", lifecycleState: "closed" }),
      item({ id: "d", lifecycleState: "closed" }),
    ];
    expect(buildTrends(items, TODAY, 6).clearanceRate).toBe(75);
  });

  it("puts open items into age bands using when they were raised", () => {
    const items = [
      item({ id: "a", createdAt: "2026-10-20T09:00:00Z" }),
      item({ id: "b", createdAt: "2026-10-01T09:00:00Z" }),
      item({ id: "c", createdAt: "2026-07-01T09:00:00Z" }),
    ];
    const bands = buildTrends(items, TODAY, 6).ageing;
    expect(bands.map((band) => band.count)).toEqual([1, 1, 0, 1]);
  });

  it("names the trade holding the most late work, and the oldest band still open", () => {
    const items = [
      item({ id: "a", assignedTrade: "Groundworks", dueDate: "2026-09-01" }),
      item({ id: "b", assignedTrade: "Groundworks", dueDate: "2026-09-02" }),
      item({ id: "c", assignedTrade: "Electrical", dueDate: "2026-12-01" }),
      item({ id: "d", assignedTrade: "Electrical", createdAt: "2026-06-01T09:00:00Z", dueDate: "2026-12-01" }),
    ];
    const report = buildTrends(items, TODAY, 6);
    expect(report.stalls[0]?.label).toBe("Groundworks");
    expect(report.stalls[1]?.label).toContain("90");
  });

  it("always returns the caveat, so the screen cannot show the numbers without it", () => {
    expect(buildTrends([], TODAY, 6).caveat).toContain("no close-out date");
  });
});

describe("insightByProject", () => {
  it("finds the oldest open item and ignores closed ones", () => {
    const items = [
      item({ id: "a", projectId: "p1", createdAt: "2026-10-20T09:00:00Z" }),
      item({ id: "b", projectId: "p1", createdAt: "2026-09-01T09:00:00Z" }),
      item({ id: "c", projectId: "p1", createdAt: "2026-01-01T09:00:00Z", lifecycleState: "closed" }),
    ];
    expect(insightByProject(items, TODAY).get("p1")?.oldestOpenDays).toBe(52);
  });

  it("counts severity worst first and names the busiest trade", () => {
    const items = [
      item({ id: "a", severity: "low", assignedTrade: "Joinery" }),
      item({ id: "b", severity: "high", assignedTrade: "Joinery" }),
      item({ id: "c", severity: "high", assignedTrade: "Electrical" }),
    ];
    const insight = insightByProject(items, TODAY).get("p1");
    expect(insight?.severity[0]).toEqual({ label: "high", count: 2 });
    expect(insight?.busiestTrade).toBe("Joinery");
  });

  it("averages how late the late ones are", () => {
    const items = [
      item({ id: "a", dueDate: "2026-10-13" }),
      item({ id: "b", dueDate: "2026-10-03" }),
    ];
    expect(insightByProject(items, TODAY).get("p1")?.averageDaysLate).toBe(15);
  });

  it("has no opinion about projects with nothing open", () => {
    const insight = insightByProject([item({ lifecycleState: "closed" })], TODAY).get("p1");
    expect(insight?.oldestOpenDays).toBeNull();
    expect(insight?.averageDaysLate).toBeNull();
    expect(insight?.closed).toBe(1);
  });
});
