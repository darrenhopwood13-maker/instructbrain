import { describe, expect, it } from "vitest";

import type { DashboardItem } from "@/lib/analytics/item-map";
import { daysLate } from "@/lib/analytics/item-map";
import {
  breakdownOf,
  controlRoomTotals,
  overdueItems,
  raisedByWeek,
  severityLabel,
  weekLabel,
  weekStart,
} from "@/lib/analytics/control-room";

const TODAY = "2026-10-12";

function item(over: Partial<DashboardItem> = {}): DashboardItem {
  return {
    id: over.id ?? "i1",
    ref: null,
    title: null,
    status: null,
    lifecycleState: "open",
    severity: null,
    dueDate: null,
    createdAt: null,
    assignedTrade: null,
    reportId: "r1",
    reportRef: null,
    reportTitle: null,
    reportDate: null,
    surveyLabel: null,
    projectId: null,
    projectName: null,
    projectRef: null,
    ...over,
  };
}

describe("what the control room counts", () => {
  it("counts open, overdue, unassessed, unallocated and closed separately", () => {
    const items = [
      item({ id: "a", lifecycleState: "open" }),
      item({ id: "b", lifecycleState: "assigned", dueDate: "2026-10-01" }), // overdue
      item({ id: "c", status: "not_assessed", lifecycleState: null }),
      item({ id: "d", lifecycleState: "fixed", assignedTrade: null }),
      item({ id: "e", lifecycleState: "closed" }),
    ];
    const totals = controlRoomTotals(items, [{}, {}], TODAY);

    expect(totals.items).toBe(5);
    expect(totals.reports).toBe(2);
    expect(totals.openItems).toBe(4);
    expect(totals.overdue).toBe(1);
    expect(totals.notAssessed).toBe(1);
    expect(totals.unallocated).toBe(4);
    expect(totals.closed).toBe(1);
  });

  it("does not count a passed item as work, but does count one nobody has assessed", () => {
    const totals = controlRoomTotals(
      [item({ lifecycleState: null, status: "pass" }), item({ lifecycleState: null, status: "not_assessed" })],
      [],
      TODAY,
    );
    expect(totals.openItems).toBe(1);
    expect(totals.notAssessed).toBe(1);
    expect(totals.closed).toBe(0);
  });
});

describe("pulling the open items apart", () => {
  const items = [
    item({ id: "a", assignedTrade: "Electrical", dueDate: "2026-10-01" }),
    item({ id: "b", assignedTrade: "Electrical" }),
    item({ id: "c", assignedTrade: "Groundworks" }),
    item({ id: "d", assignedTrade: null }),
    item({ id: "e", assignedTrade: "Electrical", lifecycleState: "closed" }),
  ];

  it("groups by trade, worst first, and leaves the closed ones out", () => {
    const rows = breakdownOf(items, "trade", TODAY);
    expect(rows.map((row) => row.label)).toEqual(["Electrical", "Groundworks", "Nobody allocated"]);
    expect(rows[0]!.count).toBe(2); // the closed one is not open work
    expect(rows[0]!.overdue).toBe(1);
  });

  it("puts the name nobody set in its own bucket rather than guessing one", () => {
    const rows = breakdownOf([item({ id: "z", assignedTrade: "" })], "trade", TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.label).toBe("Nobody allocated");
  });

  it("groups severity onto the urgency ladder, worst first, and keeps unset out of it", () => {
    const rows = breakdownOf(
      [
        item({ id: "a", severity: "danger_present" }),
        item({ id: "b", severity: "housekeeping" }),
        item({ id: "c", severity: null }),
        item({ id: "d", severity: null }),
      ],
      "severity",
      TODAY,
    );
    expect(rows.map((row) => row.label)).toEqual([
      "Do it now",
      "This week",
      "Planned in",
      "Just a record",
      "Not set",
    ]);
    // Order is the ladder, not the count: two unset items do not lead the chart.
    expect(rows[0]!.count).toBe(1);
    expect(rows[4]!.count).toBe(2);
    // The item still reads in its own template's words underneath.
    expect(severityLabel(rows[0]!.items[0]!.severity)).toBe("Danger present");
  });

  it("reads an unknown severity key as words, never as an invented one", () => {
    expect(severityLabel("this_week")).toBe("This week");
    expect(severityLabel("improvement_item")).toBe("Improvement item");
    expect(severityLabel("something_new")).toBe("Something new");
    expect(severityLabel(null)).toBe("Not set");
  });

  it("opens a row to the items in it, most late first", () => {
    const rows = breakdownOf(items, "trade", TODAY);
    const electrical = rows.find((row) => row.label === "Electrical")!;
    expect(electrical.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("groups by date raised and by project too", () => {
    const raised = breakdownOf(
      [
        item({ id: "a", createdAt: "2026-10-07T09:00:00Z" }),
        item({ id: "b", createdAt: "2026-10-08T09:00:00Z" }),
        item({ id: "c", createdAt: null }),
      ],
      "raised",
      TODAY,
    );
    expect(raised.find((row) => row.label === "w/c 5 Oct")!.count).toBe(2);
    expect(raised.find((row) => row.label === "No date")!.count).toBe(1);

    const byProject = breakdownOf(
      [item({ id: "a", projectId: "p1", projectName: "Priory" }), item({ id: "b" })],
      "project",
      TODAY,
    );
    expect(byProject.find((row) => row.label === "Priory")!.count).toBe(1);
    expect(byProject.find((row) => row.label === "No project")!.count).toBe(1);
  });
});

describe("items raised week by week", () => {
  it("gives twelve weeks, oldest first, with the empty ones counted as zero", () => {
    const weeks = raisedByWeek(
      [
        item({ id: "a", createdAt: "2026-10-06T10:00:00Z" }),
        item({ id: "b", createdAt: "2026-10-07T10:00:00Z" }),
        item({ id: "c", createdAt: "2026-09-02T10:00:00Z" }),
      ],
      12,
      TODAY,
    );
    expect(weeks).toHaveLength(12);
    expect(weeks[11]!.week).toBe("2026-10-12");
    expect(weeks[11]!.raised).toBe(0); // nothing this week yet
    expect(weeks[10]!.week).toBe("2026-10-05");
    expect(weeks[10]!.raised).toBe(2);
    expect(weeks.reduce((sum, week) => sum + week.raised, 0)).toBe(3);
    expect(weeks[0]!.week < weeks[11]!.week).toBe(true);
  });

  it("puts a date in the Monday of its week, in UTC", () => {
    expect(weekStart("2026-10-12T00:00:00Z")).toBe("2026-10-12"); // a Monday
    expect(weekStart("2026-10-11T23:59:00Z")).toBe("2026-10-05"); // the Sunday before
    expect(weekStart("not a date")).toBeNull();
    expect(weekLabel("2026-10-05")).toBe("5 Oct");
  });
});

describe("what is past its date", () => {
  it("lists only open, dated, passed items, most late first", () => {
    const items = [
      item({ id: "a", dueDate: "2026-10-11" }),
      item({ id: "b", dueDate: "2026-10-01" }),
      item({ id: "c", dueDate: "2026-10-31" }), // not yet
      item({ id: "d", dueDate: null }),
      item({ id: "e", dueDate: "2026-09-01", lifecycleState: "closed" }),
    ];
    expect(overdueItems(items, TODAY).map((i) => i.id)).toEqual(["b", "a"]);
    expect(daysLate(items[1]!, TODAY)).toBe(11);
    // Lateness is plain date arithmetic on whatever is asked; it is the LISTS that
    // decide what counts, so a closed item is simply never in them.
    expect(daysLate(items[4]!, TODAY)).toBe(41);
    expect(overdueItems(items, TODAY)).not.toContainEqual(expect.objectContaining({ id: "e" }));
    expect(daysLate(items[3]!, TODAY)).toBeNull(); // no date at all
  });
});
