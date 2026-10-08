import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import {
  electricalInstallationDefinition,
  mechanicalServicesDefinition,
  weatherproofingDefinition,
} from "@/lib/survey-definitions";
import { definesField, regulatoryReferencesOf } from "@/lib/survey-types";

/**
 * The citation surface for the MEP-family reports.
 *
 * Dal, 8 Oct 2026: "can add the full health and safety and building regs to the
 * electrical, hvac and mep reports so they can be referenced."
 *
 * Three things have to be true for that to be safe rather than merely present:
 *
 *  1. The template carries a citation set.
 *  2. Carrying it is enough to switch the rule ON — the prompt must list the ids
 *     and forbid everything else. If the rule does not fire, the model is left
 *     free to invent a regulation number, which is worse than citing nothing.
 *  3. Nothing in the set is a clause number. The set names instruments; the model
 *     may never reach for a section, table or paragraph. That is the whole point
 *     of a constrained set, and it is asserted here rather than trusted.
 *
 * Every entry was verified against its own source URL on 8 Oct 2026 by fetching
 * the page and checking the instrument number appears on it. The record, with the
 * URL behind each entry, is docs/regulatory-citations.md.
 */

const ELECTRICAL = electricalInstallationDefinition;
const MECHANICAL = mechanicalServicesDefinition;

describe("the citation set on the MEP-family reports", () => {
  it("exists on both, with unique ids and a label that names an instrument", () => {
    for (const definition of [ELECTRICAL, MECHANICAL]) {
      const refs = regulatoryReferencesOf(definition);
      expect(refs.length).toBeGreaterThan(0);

      const ids = refs.map((ref) => ref.id);
      expect(new Set(ids).size).toBe(ids.length);

      for (const ref of refs) {
        expect(ref.id).toMatch(/^[a-z0-9_]+$/);
        expect(ref.label.trim().length).toBeGreaterThan(3);
        // A label must name a document, never a clause inside one.
        expect(ref.label).not.toMatch(/\b(clause|paragraph|section\s+\d|table\s+\d|reg\s+\d)/i);
      }
    }
  });

  it("holds the count that was verified, so a silent deletion is caught", () => {
    // A de-dupe or an edit that drops an entry is worse than a duplicate: the
    // instrument silently stops being citable. Pin the counts.
    expect(regulatoryReferencesOf(ELECTRICAL)).toHaveLength(7);
    expect(regulatoryReferencesOf(MECHANICAL)).toHaveLength(20);
  });

  it("turns the citation rule ON simply by being present", () => {
    expect(definesField(ELECTRICAL, "regulatory_reference")).toBe(true);
    expect(definesField(MECHANICAL, "regulatory_reference")).toBe(true);
    // The control: a template with no set must NOT claim the capability.
    expect(definesField(weatherproofingDefinition, "regulatory_reference")).toBe(false);
  });

  it("puts every citable id in the prompt, and forbids inventing one", () => {
    for (const definition of [ELECTRICAL, MECHANICAL]) {
      const prompt = buildSystemPrompt(definition);
      expect(prompt).toContain("Never invent one");
      for (const ref of regulatoryReferencesOf(definition)) {
        expect(prompt).toContain(ref.id);
      }
      // The contradictory instruction must not also be present.
      expect(prompt).not.toContain("Do not return a regulatory_reference for this survey type");
    }
  });

  it("leaves a template without a set actively forbidden from citing anything", () => {
    // This is the direction that matters. A dangling reference — the prompt
    // pointing at a list that was never supplied — is the condition under which
    // a model improvises a number, so the empty case must say so out loud.
    const prompt = buildSystemPrompt(weatherproofingDefinition);
    expect(prompt).toContain("Do not return a regulatory_reference for this survey type");
    expect(prompt).not.toContain("Never invent one");
  });

  it("carries a tailored rule for each, not one shared sentence", () => {
    const electrical = buildSystemPrompt(ELECTRICAL);
    const mechanical = buildSystemPrompt(MECHANICAL);
    expect(electrical).toContain("an exposed conductor");
    expect(mechanical).toContain("a gas appliance or flue");
    // And each must carry the hard rule in its own words.
    for (const prompt of [electrical, mechanical]) {
      expect(prompt).toMatch(/NEVER invent, cite or infer a regulation, clause, section, table or paragraph number/);
    }
  });
});
