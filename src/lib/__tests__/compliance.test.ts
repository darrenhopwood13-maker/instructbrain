import { describe, expect, it } from "vitest";
import {
  CHECK_TYPES,
  COMPLIANCE_STATUSES,
  checkType,
  deriveStatus,
  derivedDueDate,
  fieldsForUnitType,
  isOverdue,

} from "@/lib/compliance/checks";
import { runBlockers } from "@/lib/compliance/compliance-data";
import { complianceDefinition } from "@/lib/compliance/definition";
import { categoriesOf, severitiesOf } from "@/lib/survey-types";

const fire = checkType("fire");

const point = (id: string, unitType: string) => ({
  id,
  projectId: "p",
  checkType: "fire",
  location: "Level 2",
  unitRef: id,
  unitType,
  state: "active" as const,
  decommissionedAt: null,
  decommissionNote: null,
});

const entry = (id: string, pointId: string, answers: Record<string, unknown>, extra = {}) => ({
  id,
  runId: "r1",
  pointId,
  answers,
  status: "not_applicable" as const,
  naReason: null,
  note: null,
  photoId: "photo-1",
  confirmed: true,
  ...extra,
});

describe("compliance vocabulary", () => {
  it("has exactly three outcomes and no severity scale", () => {
    expect(COMPLIANCE_STATUSES.map((status) => status.id)).toEqual([
      "compliant",
      "non_compliant",
      "not_applicable",
    ]);
    const definition = complianceDefinition("fire");
    expect(severitiesOf(definition)).toHaveLength(0);
    expect(categoriesOf(definition)).toHaveLength(0);
  });

  it("names all six check types in the agreed order, all live", () => {
    expect(CHECK_TYPES.map((type) => type.id)).toEqual([
      "fire",
      "excavation",
      "scaffold",
      "welfare",
      "lifting_plant",
      "housekeeping",
    ]);
    expect(CHECK_TYPES.every((type) => type.live)).toBe(true);
    expect(CHECK_TYPES.every((type) => type.fields.some((field) => field.compliance))).toBe(true);
  });
});

describe("templates two to six", () => {
  const excavation = checkType("excavation");
  const scaffold = checkType("scaffold");
  const lifting = checkType("lifting_plant");
  const housekeeping = checkType("housekeeping");

  it("derives compliant only once every relevant check is answered yes", () => {
    const answers: Record<string, unknown> = {};
    for (const field of excavation.fields) {
      if (field.compliance) answers[field.id] = true;
    }
    expect(deriveStatus(excavation, "Trench", answers, false)).toBe("compliant");
    expect(
      deriveStatus(excavation, "Trench", { ...answers, edge_protection: false }, false),
    ).toBe("non_compliant");
  });

  it("fails an out-of-date thorough examination whatever else is answered", () => {
    const answers: Record<string, unknown> = { thorough_exam_in_date: false };
    for (const field of lifting.fields) {
      if (field.compliance && field.id !== "thorough_exam_in_date") answers[field.id] = true;
    }
    expect(deriveStatus(lifting, "MEWP", answers, false)).toBe("non_compliant");
    // Even marked not applicable, the statutory gate still reads non-compliant.
    expect(deriveStatus(lifting, "MEWP", answers, true)).toBe("non_compliant");
  });

  it("works out the scaffold seven-day report date from first use", () => {
    const due = scaffold.fields.find((field) => field.id === "report_due")!;
    expect(derivedDueDate(due, { first_use: "2026-09-01" })).toBe("2026-09-08");
    expect(derivedDueDate(due, {})).toBeNull();
    expect(isOverdue(scaffold, { first_use: "2026-09-01" }, new Date("2026-09-20"))).toBe(true);
    expect(isOverdue(scaffold, { first_use: "2026-09-01" }, new Date("2026-09-02"))).toBe(false);
  });

  it("keeps snagging vocabulary out of every register template", () => {
    const words = JSON.stringify(CHECK_TYPES).toLowerCase();
    for (const term of ["snag", "defect", "severity", "hazard category", "trade"]) {
      expect(words).not.toContain(term);
    }
    expect(housekeeping.photoRequired).toBe("on_fail");
  });
});


describe("per-type fire checks", () => {
  it("asks water units for a gauge and CO2 units for a seal, never the other way round", () => {
    const water = fieldsForUnitType(fire, "Water").map((field) => field.id);
    const co2 = fieldsForUnitType(fire, "CO2").map((field) => field.id);
    expect(water).toContain("gauge_full");
    expect(water).not.toContain("seal_intact");
    expect(co2).toContain("seal_intact");
    expect(co2).not.toContain("gauge_full");
  });

  it("never derives compliant from an unanswered check", () => {
    expect(deriveStatus(fire, "Water", {}, false)).toBe("not_applicable");
    expect(deriveStatus(fire, "Water", { present: true }, false)).toBe("not_applicable");
  });

  it("derives non-compliant from any failed check", () => {
    expect(deriveStatus(fire, "CO2", { present: true, seal_intact: false }, false)).toBe(
      "non_compliant",
    );
  });

  it("records an explicit not-applicable rather than skipping", () => {
    expect(deriveStatus(fire, "Water", { present: true }, true)).toBe("not_applicable");
  });
});

describe("run completion blockers", () => {
  const base = {
    type: "fire",
    points: [point("EXT-1", "Water")],
    runId: "r1",
    actions: [],
  };

  it("blocks completion when a point has no photograph this week", () => {
    const blockers = runBlockers({
      ...base,
      entries: [
        entry("e1", "EXT-1", {
          present: true,
          service_in_date: true,
          tag_secured: true,
          gauge_full: true,
          signage: true,
          access_clear: true,
        }, { photoId: null }),
      ],
    });
    expect(blockers.some((text) => text.includes("no photograph"))).toBe(true);
  });

  it("blocks completion when a non-compliant point has no action raised", () => {
    const blockers = runBlockers({
      ...base,
      entries: [entry("e1", "EXT-1", { present: true, gauge_full: false })],
    });
    expect(blockers.some((text) => text.includes("no action"))).toBe(true);
  });

  it("blocks completion while a point is unconfirmed", () => {
    const blockers = runBlockers({
      ...base,
      entries: [
        entry(
          "e1",
          "EXT-1",
          {
            present: true,
            service_in_date: true,
            tag_secured: true,
            gauge_full: true,
            signage: true,
            access_clear: true,
          },
          { confirmed: false },
        ),
      ],
    });
    expect(blockers.some((text) => text.includes("not yet confirmed"))).toBe(true);
  });

  it("clears once every point is confirmed, photographed and compliant", () => {
    const blockers = runBlockers({
      ...base,
      entries: [
        entry("e1", "EXT-1", {
          present: true,
          service_in_date: true,
          tag_secured: true,
          gauge_full: true,
          signage: true,
          access_clear: true,
        }),
      ],
    });
    expect(blockers).toEqual([]);
  });
});
