import { describe, expect, it } from "vitest";
import {
  buildRegister,
  isActionOverdue,
  photoMissing,
  registerWeeks,
} from "@/lib/compliance/register";
import type {
  ComplianceAction,
  ComplianceEntry,
  CompliancePoint,
  ComplianceRun,
} from "@/lib/compliance/compliance-data";

function run(id: string, checkDate: string, locked = true): ComplianceRun {
  return {
    id,
    organisationId: "org",
    projectId: "proj",
    checkType: "fire",
    checkDate,
    siteReference: null,
    reportNumber: null,
    performedByName: "A Surveyor",
    signedAt: locked ? `${checkDate}T10:00:00Z` : null,
    competentPerson: null,
    lockedAt: locked ? `${checkDate}T10:00:00Z` : null,
    reportId: null,
    createdAt: `${checkDate}T09:00:00Z`,
  };
}

function point(id: string, unitRef: string, state: CompliancePoint["state"] = "active"): CompliancePoint {
  return {
    id,
    projectId: "proj",
    checkType: "fire",
    location: "Level 1",
    unitRef,
    unitType: "Water",
    state,
    decommissionedAt: state === "decommissioned" ? "2026-08-20" : null,
    decommissionNote: null,
  };
}

const passing = {
  present: true,
  service_in_date: true,
  tag_secured: true,
  gauge_full: true,
  signage: true,
  access_clear: true,
};

function entry(
  id: string,
  runId: string,
  pointId: string,
  answers: Record<string, unknown>,
  photoId: string | null = "photo",
): ComplianceEntry {
  return {
    id,
    runId,
    pointId,
    answers,
    status: "not_applicable",
    naReason: null,
    note: null,
    photoId,
    confirmed: true,
  };
}

const weeks = [
  run("r1", "2026-07-29"),
  run("r2", "2026-08-05"),
  run("r3", "2026-08-12"),
  run("r4", "2026-08-19"),
  run("r5", "2026-08-26"),
  run("r6", "2026-09-02"),
  run("r7", "2026-09-09", false),
];

describe("the compliance register", () => {
  it("keeps six weeks, oldest first", () => {
    const shown = registerWeeks(weeks);
    expect(shown).toHaveLength(6);
    expect(shown[0]?.checkDate).toBe("2026-08-05");
    expect(shown[5]?.checkDate).toBe("2026-09-09");
  });

  it("leaves a cell 'not checked' where the point did not exist yet", () => {
    const model = buildRegister({
      checkTypeId: "fire",
      runs: weeks,
      points: [point("p1", "EXT-1"), point("p2", "EXT-2")],
      // p2 only appears from the last week
      entries: [
        entry("e1", "r6", "p1", passing),
        entry("e2", "r7", "p1", passing),
        entry("e3", "r7", "p2", passing),
      ],
      actions: [],
    });
    const row = model.rows.find((item) => item.point.id === "p2");
    expect(row?.cells.map((cell) => cell.state)).toEqual([
      "not_checked",
      "not_checked",
      "not_checked",
      "not_checked",
      "not_checked",
      "compliant",
    ]);
  });

  it("keeps a decommissioned point in the register with its history", () => {
    const model = buildRegister({
      checkTypeId: "fire",
      runs: weeks,
      points: [point("p1", "EXT-1", "decommissioned")],
      entries: [entry("e1", "r5", "p1", passing)],
      actions: [],
    });
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]?.point.state).toBe("decommissioned");
    expect(model.rows[0]?.cells.some((cell) => cell.state === "compliant")).toBe(true);
  });

  it("counts each week's outcomes and its missing photographs", () => {
    const model = buildRegister({
      checkTypeId: "fire",
      runs: [run("r1", "2026-09-02")],
      points: [point("p1", "EXT-1"), point("p2", "EXT-2")],
      entries: [
        entry("e1", "r1", "p1", passing, null),
        entry("e2", "r1", "p2", { ...passing, gauge_full: false }),
      ],
      actions: [],
    });
    const week = model.weeks[0]!;
    expect(week.checked).toBe(2);
    expect(week.compliant).toBe(1);
    expect(week.nonCompliant).toBe(1);
    expect(week.photosMissing).toBe(1);
  });

  it("a housekeeping point only needs a photograph where it failed", () => {
    const failing = entry("e1", "r1", "p1", { access_egress: false }, null);
    const clean = entry("e2", "r1", "p2", { access_egress: true }, null);
    expect(photoMissing("housekeeping", "non_compliant", failing)).toBe(true);
    expect(photoMissing("housekeeping", "compliant", clean)).toBe(false);
    expect(photoMissing("fire", "compliant", clean)).toBe(true);
  });

  it("marks an action overdue only while it is still open", () => {
    const action = (over: Partial<ComplianceAction>): ComplianceAction => ({
      id: "a",
      projectId: "proj",
      pointId: "p1",
      raisedRunId: "r1",
      description: "Replace the extinguisher",
      owner: "Site team",
      openedOn: "2026-08-01",
      targetDate: "2026-08-08",
      status: "open",
      closedOn: null,
      closeoutPhotoId: null,
      closeoutNote: null,
      ...over,
    });
    const today = new Date("2026-09-09T00:00:00Z");
    expect(isActionOverdue(action({}), today)).toBe(true);
    expect(isActionOverdue(action({ status: "closed", closedOn: "2026-08-05" }), today)).toBe(false);
    expect(isActionOverdue(action({ targetDate: null }), today)).toBe(false);
  });

  it("summarises the open items above the grid", () => {
    const base: ComplianceAction = {
      id: "a1",
      projectId: "proj",
      pointId: "p1",
      raisedRunId: "r1",
      description: "Refill",
      owner: null,
      openedOn: "2026-08-01",
      targetDate: "2026-08-08",
      status: "open",
      closedOn: null,
      closeoutPhotoId: null,
      closeoutNote: null,
    };
    const model = buildRegister({
      checkTypeId: "fire",
      runs: [run("r1", "2026-09-02")],
      points: [point("p1", "EXT-1")],
      entries: [entry("e1", "r1", "p1", passing)],
      actions: [
        base,
        { ...base, id: "a2", openedOn: "2026-08-20", targetDate: "2026-12-01" },
        { ...base, id: "a3", status: "closed", closedOn: "2026-08-10" },
      ],
      today: new Date("2026-09-09T00:00:00Z"),
    });
    expect(model.actions.open).toBe(2);
    expect(model.actions.overdue).toBe(1);
    expect(model.actions.oldestOpenedOn).toBe("2026-08-01");
  });

  it("does not borrow snagging vocabulary", () => {
    const model = buildRegister({
      checkTypeId: "fire",
      runs: [run("r1", "2026-09-02")],
      points: [point("p1", "EXT-1")],
      entries: [entry("e1", "r1", "p1", passing)],
      actions: [],
    });
    const text = JSON.stringify(model).toLowerCase();
    for (const word of ["severity", "critical", "major", "minor", "snag", "trade"]) {
      expect(text).not.toContain(word);
    }
  });
});
