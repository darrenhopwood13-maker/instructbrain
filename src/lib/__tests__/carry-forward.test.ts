import { describe, expect, it } from "vitest";

import type { ComplianceEntry } from "@/lib/compliance/compliance-data";
import { confirmableIds, planCarryForward } from "@/lib/compliance/carry-forward";

const FIELDS = ["alarm_sounds", "call_point", "next_due"];

function entry(
  pointId: string,
  answers: Record<string, unknown>,
  extra: Partial<ComplianceEntry> = {},
): ComplianceEntry {
  return {
    id: extra.id ?? `entry-${pointId}`,
    runId: extra.runId ?? "this-week",
    pointId,
    answers,
    status: extra.status ?? "compliant",
    naReason: null,
    note: null,
    photoId: null,
    confirmed: extra.confirmed ?? false,
  };
}

const ids = () => FIELDS;

describe("planCarryForward", () => {
  it("takes last week's answers for points left blank this week", () => {
    const plan = planCarryForward({
      current: [entry("p1", {})],
      previous: [entry("p1", { alarm_sounds: true, call_point: true })],
      comparableFieldIds: ids,
    });

    expect(plan.takeFromPrevious).toHaveLength(1);
    expect(plan.takeFromPrevious[0]!.answers).toEqual({ alarm_sounds: true, call_point: true });
    expect(plan.changed).toHaveLength(0);
    expect(plan.noHistory).toHaveLength(0);
  });

  it("leaves an answer the inspector has already given this week alone", () => {
    const plan = planCarryForward({
      current: [entry("p1", { alarm_sounds: false })],
      previous: [entry("p1", { alarm_sounds: true, call_point: true })],
      comparableFieldIds: ids,
    });

    expect(plan.takeFromPrevious).toHaveLength(0);
    expect(plan.changed).toHaveLength(1);
  });

  it("counts a point that matches last week as unchanged", () => {
    const plan = planCarryForward({
      current: [entry("p1", { alarm_sounds: true, call_point: true })],
      previous: [entry("p1", { alarm_sounds: true, call_point: true })],
      comparableFieldIds: ids,
    });

    expect(plan.unchanged).toHaveLength(1);
    expect(plan.changed).toHaveLength(0);
  });

  it("never carries a computed due date even when the previous entry holds one", () => {
    const plan = planCarryForward({
      current: [entry("p1", {})],
      previous: [entry("p1", { alarm_sounds: true, next_due: "2026-10-01" })],
      comparableFieldIds: () => ["alarm_sounds"],
    });

    expect(plan.takeFromPrevious[0]!.answers).toEqual({ alarm_sounds: true });
    expect("next_due" in plan.takeFromPrevious[0]!.answers).toBe(false);
  });

  it("treats a point nobody answered on either side as outstanding, not as a match", () => {
    const plan = planCarryForward({
      current: [entry("p1", {})],
      previous: [entry("p1", {})],
      comparableFieldIds: ids,
    });

    expect(plan.noHistory).toHaveLength(1);
    expect(plan.unchanged).toHaveLength(0);
    expect(plan.takeFromPrevious).toHaveLength(0);
  });

  it("treats a point with no previous entry as work, not as a match", () => {
    const plan = planCarryForward({
      current: [entry("new-point", {})],
      previous: [entry("p1", { alarm_sounds: true })],
      comparableFieldIds: ids,
    });

    expect(plan.noHistory).toHaveLength(1);
  });

  it("treats text the same as it treats yes and no", () => {
    const plan = planCarryForward({
      current: [entry("p1", { call_point: "  Level 3 lobby " })],
      previous: [entry("p1", { call_point: "Level 3 lobby" })],
      comparableFieldIds: () => ["call_point"],
    });

    expect(plan.unchanged).toHaveLength(1);
  });

  it("keeps a changed answer out of the bulk confirm", () => {
    const plan = planCarryForward({
      current: [entry("p1", { alarm_sounds: false }), entry("p2", {})],
      previous: [
        entry("p1", { alarm_sounds: true }),
        entry("p2", { alarm_sounds: true }),
      ],
      comparableFieldIds: ids,
    });

    const ids2 = confirmableIds(plan);
    expect(ids2).not.toContain("entry-p1");
    expect(ids2).toContain("entry-p2");
  });

  it("matches points by id, so a reordered list still lines up", () => {
    const plan = planCarryForward({
      current: [entry("p2", {}), entry("p1", {})],
      previous: [entry("p1", { alarm_sounds: true }), entry("p2", { alarm_sounds: false })],
      comparableFieldIds: () => ["alarm_sounds"],
    });

    const carried = new Map(plan.takeFromPrevious.map(({ entry: e, answers }) => [e.pointId, answers]));
    expect(carried.get("p1")).toEqual({ alarm_sounds: true });
    expect(carried.get("p2")).toEqual({ alarm_sounds: false });
  });

  it("says nothing at all when there is no previous check", () => {
    const plan = planCarryForward({
      current: [entry("p1", {})],
      previous: [],
      comparableFieldIds: ids,
    });

    expect(plan.takeFromPrevious).toHaveLength(0);
    expect(plan.unchanged).toHaveLength(0);
    expect(plan.noHistory).toHaveLength(1);
  });
});
