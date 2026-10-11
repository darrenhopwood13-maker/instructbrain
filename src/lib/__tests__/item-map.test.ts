import { describe, expect, it } from "vitest";

import {
  attentionItems,
  buildItemMap,
  daysLate,
  firstNonEmptyText,
  groupSummary,
  stateOf,
  type DashboardItem,
} from "@/lib/analytics/item-map";

const TODAY = "2026-10-11";

/**
 * Build a test item by spreading over a base.
 *
 * Deliberately NOT `over.x ?? default`: that turns an explicit `null` back into
 * the default, so a test written to check null handling quietly checks something
 * else. Spreading keeps `null` as `null` and only fills what was left out.
 */
const BASE_ITEM: DashboardItem = {
  id: "i1",
  ref: "F-001",
  title: "Something needing attention",
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

describe("picking the text to show for an item", () => {
  it("skips an empty string rather than letting it win", () => {
    // The real bug this exists for: snag_title is frequently "" on live findings,
    // and `??` accepts it, so every such item rendered with a blank title.
    expect(firstNonEmptyText("", "Surface wiring draped across opening", "F-009")).toBe(
      "Surface wiring draped across opening",
    );
  });

  it("skips whitespace-only values too", () => {
    expect(firstNonEmptyText("   ", "\n", "F-002")).toBe("F-002");
  });

  it("skips null and undefined", () => {
    expect(firstNonEmptyText(null, undefined, "F-003")).toBe("F-003");
  });

  it("takes the first real value when everything is present", () => {
    expect(firstNonEmptyText("Cover missing", "Board 2", "F-001")).toBe("Cover missing");
  });

  it("says so plainly rather than rendering nothing at all", () => {
    expect(firstNonEmptyText(null, "", undefined)).toBe("Untitled item");
  });
});

describe("the state of one item", () => {
  it("reads overdue from an open item whose date has passed", () => {
    expect(stateOf(item({ dueDate: "2026-10-04" }), TODAY)).toBe("overdue");
  });

  it("never calls an item overdue when it has no date", () => {
    // The real account has 126 findings with no due date at all. If a missing
    // date counted as late, the dashboard would cry wolf on almost every item.
    expect(stateOf(item({ dueDate: null }), TODAY)).toBe("open");
  });

  it("does not call a future date overdue", () => {
    expect(stateOf(item({ dueDate: "2026-11-01" }), TODAY)).toBe("open");
  });

  it("does not call the due date itself overdue - it is due, not late", () => {
    expect(stateOf(item({ dueDate: TODAY }), TODAY)).toBe("open");
  });

  it("reads an allocated item as allocated", () => {
    expect(stateOf(item({ lifecycleState: "assigned" }), TODAY)).toBe("assigned");
    expect(stateOf(item({ lifecycleState: "in_progress" }), TODAY)).toBe("assigned");
  });

  it("prefers overdue over allocated, because that is the one to act on", () => {
    expect(stateOf(item({ lifecycleState: "assigned", dueDate: "2026-10-01" }), TODAY)).toBe("overdue");
  });

  it("prefers closed over everything else", () => {
    expect(
      stateOf(item({ lifecycleState: "verified", status: "not_assessed", dueDate: "2020-01-01" }), TODAY),
    ).toBe("closed");
  });

  it("reads an unassessed item as unassessed rather than plain open", () => {
    expect(stateOf(item({ status: "not_assessed" }), TODAY)).toBe("not_assessed");
  });

  it("treats an empty lifecycle as not open, so it cannot be overdue", () => {
    expect(stateOf(item({ lifecycleState: null, dueDate: "2026-01-01" }), TODAY)).toBe("open");
  });
});

describe("days late", () => {
  it("counts whole days past the date", () => {
    expect(daysLate(item({ dueDate: "2026-10-01" }), TODAY)).toBe(10);
  });
  it("is null on the day itself and for future dates", () => {
    expect(daysLate(item({ dueDate: TODAY }), TODAY)).toBeNull();
    expect(daysLate(item({ dueDate: "2026-12-01" }), TODAY)).toBeNull();
  });
  it("is null when there is no date at all", () => {
    expect(daysLate(item({ dueDate: null }), TODAY)).toBeNull();
  });
});

describe("building the map", () => {
  const items = [
    item({ id: "a", projectId: "p1", projectName: "Alpha" }),
    item({ id: "b", projectId: "p1", projectName: "Alpha" }),
    item({ id: "c", projectId: "p2", projectName: "Beta" }),
    item({ id: "d", projectId: null, projectName: null, reportRef: "SNG-1" }),
  ];

  it("groups by project and sorts the busiest first", () => {
    const map = buildItemMap(items, { groupBy: "project", today: TODAY });
    expect(map.groups.map((g) => g.label)).toEqual(["Alpha", "Beta", "No project"]);
  });

  it("keeps items with no project visible under their own row", () => {
    // Quick reports have no project. Dropping them would hide real work.
    const map = buildItemMap(items, { groupBy: "project", today: TODAY });
    expect(map.groups.at(-1)?.items).toHaveLength(1);
    expect(map.totals.unassignedToProject).toBe(1);
  });

  it("groups by survey and by report instead", () => {
    const bySurvey = buildItemMap([item({ surveyLabel: "Site condition" })], {
      groupBy: "survey",
      today: TODAY,
    });
    expect(bySurvey.groups[0]?.label).toBe("Site condition");

    const byReport = buildItemMap([item({ reportId: "r9", reportRef: "EIC-1" })], {
      groupBy: "report",
      today: TODAY,
    });
    expect(byReport.groups[0]?.label).toBe("EIC-1");
  });

  it("counts every state, and counts what it is not drawing", () => {
    const mixed = [
      item({ id: "1", dueDate: "2026-10-01" }),
      item({ id: "2", lifecycleState: "assigned" }),
      item({ id: "3", status: "not_assessed" }),
      item({ id: "4" }),
      item({ id: "5", lifecycleState: "verified" }),
    ];
    const map = buildItemMap(mixed, { groupBy: "project", today: TODAY });
    expect(map.totals.byState).toMatchObject({
      overdue: 1,
      assigned: 1,
      not_assessed: 1,
      open: 1,
      closed: 1,
    });
    expect(map.totals.items).toBe(5);
  });

  it("caps the rows it draws and admits what it left out", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      item({ id: `i${i}`, projectId: `p${i}`, projectName: `Project ${String(i).padStart(2, "0")}` }),
    );
    const map = buildItemMap(many, { groupBy: "project", today: TODAY, maxGroups: 12 });
    expect(map.groups).toHaveLength(12);
    expect(map.totalGroups).toBe(20);
    expect(map.omittedGroups).toBe(8);
    expect(map.omittedItems).toBe(8);
    // The totals count the whole organisation, not just the drawn rows.
    expect(map.totals.items).toBe(20);
    expect(map.totals.shown).toBe(12);
  });

  it("summarises a group without double counting", () => {
    const summary = groupSummary(
      [
        item({ id: "1", dueDate: "2026-10-01" }),
        item({ id: "2", dueDate: "2026-10-02" }),
        item({ id: "3", status: "not_assessed" }),
        item({ id: "4" }),
      ],
      TODAY,
    );
    expect(summary).toEqual({ late: 2, unassessed: 1 });
  });

  it("handles an empty account without inventing a row", () => {
    const map = buildItemMap([], { groupBy: "project", today: TODAY });
    expect(map.groups).toEqual([]);
    expect(map.totals.items).toBe(0);
    expect(map.omittedGroups).toBe(0);
  });
});

describe("what needs attention first", () => {
  it("puts the latest-late first, then the unassessed, and honours the limit", () => {
    const list = attentionItems(
      [
        item({ id: "mild", dueDate: "2026-10-09", ref: "F-100" }),
        item({ id: "worst", dueDate: "2026-09-01", ref: "F-101" }),
        item({ id: "mid", dueDate: "2026-10-05", ref: "F-102" }),
        item({ id: "unassessed", status: "not_assessed", ref: "F-103" }),
        item({ id: "fine" }),
      ],
      TODAY,
      3,
    );
    expect(list.map((i) => i.id)).toEqual(["worst", "mid", "mild"]);
  });

  it("leaves out allocated work that is not late", () => {
    const list = attentionItems([item({ id: "allocated", lifecycleState: "assigned" })], TODAY);
    expect(list).toEqual([]);
  });
});
