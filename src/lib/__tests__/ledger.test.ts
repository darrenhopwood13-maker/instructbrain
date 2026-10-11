import { describe, expect, it } from "vitest";

import type { DashboardItem } from "@/lib/analytics/item-map";
import {
  buildLedger,
  dueLine,
  periodStart,
  type DashboardReportRow,
} from "@/lib/analytics/ledger";

const TODAY = "2026-10-11";

/** Spread over a base, never `?? default`, so an explicit null stays null. */
const BASE_ITEM: DashboardItem = {
  id: "i1",
  ref: "F-001",
  title: "Item",
  status: "snag",
  lifecycleState: "open",
  severity: null,
  dueDate: null,
  createdAt: "2026-10-02T09:00:00.000Z",
  assignedTrade: null,
  reportId: "r1",
  reportRef: "DEMO-INV-001",
  reportTitle: "Property inventory",
  reportDate: "2026-10-02",
  surveyLabel: "Property inventory",
  projectId: "p1",
  projectName: "Demonstration property",
  projectRef: "DEMO-001",
};

function item(over: Partial<DashboardItem> = {}): DashboardItem {
  return { ...BASE_ITEM, ...over };
}

const BASE_REPORT: DashboardReportRow = {
  id: "r1",
  reference: "DEMO-INV-001",
  title: "Property inventory",
  status: "issued",
  reportDate: "2026-10-02",
  createdAt: "2026-10-02T09:00:00.000Z",
  isQuick: false,
  projectId: "p1",
  projectName: "Demonstration property",
  surveyLabel: "Property inventory",
};

function report(over: Partial<DashboardReportRow> = {}): DashboardReportRow {
  return { ...BASE_REPORT, ...over };
}

describe("period windows", () => {
  it("counts the period inclusively, so 7 days is 7 days", () => {
    expect(periodStart("week", TODAY)).toBe("2026-10-05");
    expect(periodStart("month", TODAY)).toBe("2026-09-12");
    expect(periodStart("quarter", TODAY)).toBe("2026-07-14");
  });

  it("has no start for all time", () => {
    expect(periodStart("all", TODAY)).toBeNull();
  });

  it("rolls back across a month and year boundary", () => {
    expect(periodStart("week", "2026-01-03")).toBe("2025-12-28");
    expect(periodStart("month", "2026-01-05")).toBe("2025-12-07");
  });
});

describe("the ledger", () => {
  const items = [
    item({ id: "late", dueDate: "2026-10-01" }),
    item({ id: "assigned", lifecycleState: "assigned" }),
    item({ id: "unassessed", status: "not_assessed" }),
    item({ id: "plain" }),
    item({ id: "done", lifecycleState: "verified" }),
  ];
  const reports = [
    report({ id: "r1", reportDate: "2026-10-09" }),
    report({ id: "r2", reportDate: "2026-09-01" }),
    report({ id: "r3", reportDate: "2026-08-01", projectId: "p2", projectName: "Riverside" }),
  ];

  it("THE INVARIANT: changing the date window cannot move the standing figure", () => {
    // Nothing about tapping "7 days" closes an item. If this test ever fails, the
    // dashboard has started inventing its headline number.
    const windows = (["week", "month", "quarter", "all"] as const).map(
      (period) => buildLedger({ items, reports, period, today: TODAY }).standing,
    );
    for (const standing of windows) {
      expect(standing).toEqual(windows[0]);
    }
    expect(windows[0]).toMatchObject({ openItems: 4, closedOut: 1, overdueItems: 1, notAssessed: 1 });
  });

  it("does move the activity figures, which is what a window genuinely changes", () => {
    const week = buildLedger({ items, reports, period: "week", today: TODAY });
    const all = buildLedger({ items, reports, period: "all", today: TODAY });
    // Only 9 Oct falls inside the last 7 days (which start on 5 Oct).
    expect(week.activity.reports).toBe(1);
    expect(all.activity.reports).toBe(3);
    expect(week.activity.reports).toBeLessThan(all.activity.reports);
  });

  it("counts a report with no date as outside any window, but inside all time", () => {
    const undated = [report({ id: "rx", reportDate: null, createdAt: null })];
    expect(buildLedger({ items: [], reports: undated, period: "all", today: TODAY }).activity.reports).toBe(1);
    expect(buildLedger({ items: [], reports: undated, period: "month", today: TODAY }).activity.reports).toBe(0);
  });

  it("counts distinct projects, not reports", () => {
    const ledger = buildLedger({ items, reports, period: "all", today: TODAY });
    expect(ledger.standing.projects).toBe(2);
    expect(ledger.standing.reports).toBe(3);
  });

  it("flags an empty account, which is the state a new user actually sees", () => {
    const ledger = buildLedger({ items: [], reports: [], period: "all", today: TODAY });
    expect(ledger.empty).toBe(true);
    expect(ledger.standing.openItems).toBe(0);
    expect(ledger.attention).toEqual([]);
  });

  it("orders attention with the oldest lateness first", () => {
    const ledger = buildLedger({
      items: [item({ id: "a", dueDate: "2026-10-09" }), item({ id: "b", dueDate: "2026-09-20" })],
      reports,
      period: "all",
      today: TODAY,
    });
    expect(ledger.attention.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("reports a window start so the sentence under the number is true", () => {
    expect(buildLedger({ items, reports, period: "week", today: TODAY }).from).toBe("2026-10-05");
    expect(buildLedger({ items, reports, period: "all", today: TODAY }).from).toBeNull();
  });
});

describe("the due line", () => {
  it("says how late in plain words", () => {
    expect(dueLine(item({ dueDate: "2026-10-01" }), TODAY)).toBe("10 days late");
    expect(dueLine(item({ dueDate: "2026-10-10" }), TODAY)).toBe("1 day late");
  });
  it("is honest when there is no date rather than implying one", () => {
    expect(dueLine(item({ dueDate: null }), TODAY)).toBe("no date set");
  });
});
