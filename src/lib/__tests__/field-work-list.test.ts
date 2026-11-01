import { describe, expect, it } from "vitest";

import {
  bucketWork,
  isoDate,
  orderedBuckets,
  overdueDays,
  summariseWork,
  type FieldWorkItem,
} from "@/lib/field/work-list";

function item(id: string, dueOn: string): FieldWorkItem {
  return {
    id,
    projectId: "project-1",
    projectName: "Riverside Works",
    checkType: "fire",
    dueOn,
  };
}

describe("bucketWork", () => {
  it("puts a check from last week in overdue and one from today in due today", () => {
    const buckets = bucketWork([item("a", "2026-10-26"), item("b", "2026-11-02")], "2026-11-02");
    expect(buckets.overdue.map((entry) => entry.id)).toEqual(["a"]);
    expect(buckets.dueToday.map((entry) => entry.id)).toEqual(["b"]);
  });

  it("counts the rest of this week separately from further ahead", () => {
    const buckets = bucketWork(
      [item("soon", "2026-11-05"), item("later", "2026-12-01")],
      "2026-11-02",
    );
    expect(buckets.thisWeek.map((entry) => entry.id)).toEqual(["soon"]);
    expect(buckets.later.map((entry) => entry.id)).toEqual(["later"]);
  });

  it("treats the seventh day as this week, not as further ahead", () => {
    const buckets = bucketWork([item("edge", "2026-11-09")], "2026-11-02");
    expect(buckets.thisWeek).toHaveLength(1);
    expect(buckets.later).toHaveLength(0);
  });

  it("shows the most overdue first", () => {
    const buckets = bucketWork(
      [item("recent", "2026-10-30"), item("old", "2026-10-05"), item("middling", "2026-10-20")],
      "2026-11-02",
    );
    expect(buckets.overdue.map((entry) => entry.id)).toEqual(["old", "middling", "recent"]);
  });
});

describe("overdueDays", () => {
  it("counts the days past the week", () => {
    expect(overdueDays({ dueOn: "2026-10-21" }, "2026-11-02")).toBe(12);
  });

  it("is zero on the day itself and in the future", () => {
    expect(overdueDays({ dueOn: "2026-11-02" }, "2026-11-02")).toBe(0);
    expect(overdueDays({ dueOn: "2026-11-09" }, "2026-11-02")).toBe(0);
  });
});

describe("summariseWork", () => {
  it("says the two things that change a decision: how late, and how much for today", () => {
    const summary = summariseWork(
      bucketWork([item("a", "2026-10-21"), item("b", "2026-11-02")], "2026-11-02"),
      "2026-11-02",
    );
    expect(summary).toBe("1 overdue by up to 12 days, 1 due today");
  });

  it("says nothing when there is nothing to do", () => {
    expect(summariseWork(bucketWork([], "2026-11-02"), "2026-11-02")).toBe("");
  });
});

describe("orderedBuckets", () => {
  it("drops empty buckets and keeps the order of the day", () => {
    const groups = orderedBuckets(
      bucketWork([item("today", "2026-11-02"), item("late", "2026-10-01")], "2026-11-02"),
    );
    expect(groups.map((group) => group.title)).toEqual(["Overdue", "Due today"]);
  });
});

describe("isoDate", () => {
  it("uses the local calendar day, not UTC", () => {
    const date = new Date(2026, 10, 2, 23, 30);
    expect(isoDate(date)).toBe("2026-11-02");
  });
});
