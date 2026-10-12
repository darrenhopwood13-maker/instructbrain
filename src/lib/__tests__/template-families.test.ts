import { describe, expect, it } from "vitest";

import { systemDefinitions } from "@/lib/survey-definitions";
import {
  TEMPLATE_CHOICE,
  TEMPLATE_FAMILIES,
  UNCLAIMED_FAMILY,
  familyOf,
  purposeOf,
  templateGroups,
} from "@/lib/report/template-families";

describe("report template families", () => {
  it("claims every template, so none can fall out of the picker", () => {
    const unclaimed = systemDefinitions
      .filter((definition) => !TEMPLATE_CHOICE[definition.id])
      .map((definition) => definition.id);
    expect(unclaimed).toEqual([]);
  });

  it("prints one heading per family, once - the whole point of the recut", () => {
    const groups = templateGroups();
    const labels = groups.map((group) => group.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(groups.length).toBe(TEMPLATE_FAMILIES.length);
    expect(groups.every((group) => group.definitions.length > 0)).toBe(true);
  });

  it("puts the two pairs of category keys that used to collide in one family each", () => {
    // `condition` and `condition_survey` both printed "Building fabric", so the
    // heading appeared twice with other groups in between.
    expect(familyOf("schedule_of_condition")).toBe("condition");
    expect(familyOf("weatherproofing")).toBe("condition");
    expect(familyOf("damp_moisture")).toBe("condition");
    // `snagging` and `fit_out` both printed "Quality & handover".
    expect(familyOf("snagging")).toBe("snagging");
    expect(familyOf("fitout_quality")).toBe("snagging");

    const condition = templateGroups().find((group) => group.id === "condition");
    expect(condition?.definitions.map((definition) => definition.id)).toEqual([
      "schedule_of_condition",
      "weatherproofing",
      "damp_moisture",
    ]);
  });

  it("lists every template exactly once", () => {
    const ids = templateGroups().flatMap((group) => group.definitions.map((definition) => definition.id));
    expect(ids.length).toBe(systemDefinitions.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every claimed template one line that is not just its name again", () => {
    for (const definition of systemDefinitions) {
      const purpose = purposeOf(definition.id);
      expect(purpose, definition.id).toBeTruthy();
      expect(purpose?.includes("\n"), definition.id).toBe(false);
      expect(purpose?.endsWith("."), definition.id).toBe(true);
      expect((purpose ?? "").length, definition.id).toBeGreaterThan(30);
      expect(purpose?.toLowerCase(), definition.id).not.toBe(definition.label.toLowerCase());
    }
  });

  it("keeps a template no family has claimed visible, under Other", () => {
    const stranger = { ...systemDefinitions[0]!, id: "brand_new_template" };
    const groups = templateGroups([stranger, ...systemDefinitions]);
    const other = groups.find((group) => group.id === UNCLAIMED_FAMILY.id);
    expect(other?.definitions.map((definition) => definition.id)).toEqual(["brand_new_template"]);
    // and it is last, after the families that did claim their templates
    expect(groups[groups.length - 1]?.id).toBe(UNCLAIMED_FAMILY.id);
  });
});
