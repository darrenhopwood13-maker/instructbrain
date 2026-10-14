import { describe, expect, it } from "vitest";

import { ladderStepFor } from "@/lib/analytics/severity-ladder";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { LOCATION_FIELD_SET } from "@/lib/report/location";
import { familyOf, purposeOf } from "@/lib/report/template-families";
import { healthSafetyHousekeepingDefinition, systemDefinitions } from "@/lib/survey-definitions";

/**
 * The health, safety and housekeeping inspection is the one template whose subject
 * is the site's own safety arrangements rather than the building. The tests here
 * hold the two decisions that make it different on purpose: it carries no
 * regulatory citation, and it never invites a legal opinion.
 */
describe("health, safety and housekeeping inspection", () => {
  const definition = healthSafetyHousekeepingDefinition;

  it("ships in the reporting area, in the site and safety family", () => {
    expect(systemDefinitions.some((item) => item.id === "health_safety_housekeeping")).toBe(true);
    expect(familyOf(definition.id)).toBe("site");
    expect(purposeOf(definition.id).length).toBeGreaterThan(20);
  });

  it("walks the six checks and nothing about the building", () => {
    expect(definition.hazardCategories?.map((category) => category.id)).toEqual([
      "housekeeping_order",
      "welfare_facilities",
      "protective_equipment",
      "fire_escape_first_aid",
      "routes_and_separation",
      "paperwork_on_site",
    ]);
    // No building-condition vocabulary in the sections: this report is about the
    // site's own arrangements, not about defects in the work.
    const wording = (definition.hazardCategories ?? []).map((c) => c.label.toLowerCase()).join(" ");
    for (const fabric of ["damp", "roof", "membrane", "render", "finish", "electrical"]) {
      expect(wording).not.toContain(fabric);
    }
  });

  it("carries four outcomes, and every one of them means something different", () => {
    expect(definition.statuses.map((status) => status.id)).toEqual([
      "compliant",
      "non_compliant",
      "not_applicable",
      "not_assessed",
    ]);
    expect(new Set(definition.statuses.map((status) => status.tone)).size).toBe(4);
    expect(definition.statuses[3].tone).toBe("flag");
  });

  it("puts every severity on a rung of the urgency ladder", () => {
    const rungs = (definition.severityScale ?? []).map((severity) => [
      severity.id,
      ladderStepFor(severity.id)?.id ?? null,
    ]);
    expect(rungs).toEqual([
      ["stop_activity", "now"],
      ["before_shift_end", "now"],
      ["within_the_week", "week"],
      ["order_and_tidiness", "planned"],
    ]);
  });

  it("says plainly that stopping the activity is the top rung, not a tidy-up", () => {
    const top = definition.severityScale?.[0];
    expect(top?.id).toBe("stop_activity");
    expect(top?.targetHours).toBe(0);
    expect(top?.guidance).toContain("Imminent danger");
    expect(top?.guidance).toContain("site manager");
  });

  it("groups its output by area, so the report reads as a walk zone by zone", () => {
    expect(definition.outputSections).toEqual(["cover", "scope", "summary", "schedule_by_area", "appendix"]);
    const where = (definition.captureFields ?? []).find((field) => field.required);
    expect(where?.id).toBe("location");
    // The area grouping resolves the location from this exact id.
    expect(LOCATION_FIELD_SET.has(where?.id ?? "")).toBe(true);
  });

  it("carries no regulation, because a condition is not a legal finding", () => {
    // A decision, not an omission: a finding here describes a condition and what it
    // needs. Naming an instrument would invite a reader to take the report as an
    // assessment of compliance with it. The certificate register is the template
    // that names instruments, and it names them for a certificate's own expiry.
    expect(definition.regulatoryReferences ?? []).toEqual([]);
    const prompt = buildSystemPrompt(definition);
    expect(prompt).toContain("never give a legal opinion");
    expect(prompt).toContain("not a legal instrument");
    // The definition declares no regulatory_reference field, and the prompt builder
    // reads that as an instruction: the assistant is told to return null for it. The
    // shared instrument index still rides along as reference material, so the line
    // below is the one that actually decides whether a citation can reach a finding.
    expect(prompt).toContain("Do not return a regulatory_reference for this survey type");
  });

  it("tells the assistant that a clean inspection is a result, not a gap", () => {
    const prompt = buildSystemPrompt(definition);
    expect(prompt).toContain("Do not manufacture a finding");
    expect(prompt).toContain("Describe conditions and never people");
  });

  it("leaves the type-specific machinery switched off", () => {
    expect(definition.manualOnly ?? false).toBe(false);
    expect(definition.requiresConditionGrade ?? false).toBe(false);
    expect(definition.asksForDocumentHeader ?? false).toBe(false);
    expect(definition.requiresTradeAssignment).toBe(true);
    expect(definition.version).toBeGreaterThanOrEqual(1);
  });
});
