import { describe, expect, it } from "vitest";
import {
  NOT_ASSESSED_ID,
  aiGuidanceOf,
  captureFieldsOf,
  categoryGroupsOf,
  definesField,
  definitionLabel,
  distributionGrouping,
  outputSectionsOf,
  regulatoryReferencesOf,
  resolveStatus,
  severitiesOf,
  statusesOf,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";
import {
  snaggingDefinition,
  siteWalkDefinition,
  systemDefinitions,
  weatherproofingDefinition,
} from "@/lib/survey-definitions";
import { selectDistributionFindings, distributionRefs } from "@/lib/distribution";
import { detachPhoto, nextRef } from "@/lib/finding-refs";
import { findings } from "@/lib/mock-data";

const snapshot = snaggingDefinition;

describe("status coercion", () => {
  const malformed: unknown[] = [
    undefined,
    null,
    "",
    "   ",
    "SNAG",
    "pass",
    "ok",
    "intact",
    0,
    1,
    true,
    {},
    [],
    NaN,
    { id: "snag" },
    "snag-ish",
  ];

  it("resolves every malformed value to not_assessed", () => {
    for (const value of malformed) {
      const status = resolveStatus(snapshot, value);
      expect(status.id).toBe(NOT_ASSESSED_ID);
      expect(status.tone).not.toBe("pass");
    }
  });

  it("never resolves an unknown value to a passing status", () => {
    for (const value of malformed) {
      expect(resolveStatus(snapshot, value).tone).not.toBe("pass");
    }
  });

  it("resolves a defined status id", () => {
    expect(resolveStatus(snapshot, "acceptable").tone).toBe("pass");
    expect(resolveStatus(snapshot, "snag").tone).toBe("fail");
    expect(resolveStatus(snapshot, "monitor").tone).toBe("warn");
  });

  it("guarantees not_assessed exists even when the definition omits it", () => {
    const broken = {
      id: "x",
      label: "Broken",
      version: 1,
      statuses: [{ id: "good", label: "Good", tone: "pass" }],
    } as SurveyTypeSnapshot;
    expect(statusesOf(broken).some((s) => s.id === NOT_ASSESSED_ID)).toBe(true);
    expect(resolveStatus(broken, "explodes").id).toBe(NOT_ASSESSED_ID);
  });

  it("handles a null or malformed snapshot", () => {
    expect(resolveStatus(null, "snag").id).toBe(NOT_ASSESSED_ID);
    expect(resolveStatus({} as SurveyTypeSnapshot, "snag").id).toBe(NOT_ASSESSED_ID);
  });

  it("forces not_assessed to the flag tone even if a definition lies", () => {
    const lying = {
      id: "y",
      label: "Lying",
      version: 1,
      statuses: [{ id: NOT_ASSESSED_ID, label: "Not assessed", tone: "pass" }],
    } as unknown as SurveyTypeSnapshot;
    expect(resolveStatus(lying, NOT_ASSESSED_ID).tone).toBe("flag");
  });

  it("never silently greys out an unrecognised tone", () => {
    const mistyped = {
      id: "z",
      label: "Mistyped",
      version: 1,
      statuses: [{ id: "monitor", label: "Monitor", tone: "caution" }],
    } as unknown as SurveyTypeSnapshot;
    expect(resolveStatus(mistyped, "monitor").tone).toBe("flag");
  });
});

describe("definition engine", () => {
  it("reads the workflow flags each definition declares", () => {
    expect(snaggingDefinition.requiresTradeAssignment).toBe(true);
    expect(distributionGrouping(snaggingDefinition)).toBe("trade");
    expect(distributionGrouping(weatherproofingDefinition)).toBeNull();
  });

  it("exposes category lists generically, whatever the definition calls them", () => {
    expect(categoryGroupsOf(snaggingDefinition).map((g) => g.key)).toEqual(["snagCategories"]);
    expect(categoryGroupsOf(siteWalkDefinition).map((g) => g.key)).toEqual(["hazardCategories"]);
    expect(categoryGroupsOf(weatherproofingDefinition)).toEqual([]);
  });

  it("switches the snagging-only finding fields on by definition, not by id", () => {
    expect(definesField(snaggingDefinition, "likely_cause")).toBe(true);
    expect(definesField(snaggingDefinition, "regulatory_reference")).toBe(true);
    for (const other of [siteWalkDefinition, weatherproofingDefinition]) {
      expect(definesField(other, "likely_cause")).toBe(false);
      expect(definesField(other, "regulatory_reference")).toBe(false);
    }
  });
});

describe("no discipline's vocabulary leaks into another", () => {
  /** Everything the engine would render for one definition. */
  const render = (definition: SurveyTypeSnapshot): string[] => [
    definitionLabel(definition),
    ...statusesOf(definition).flatMap((s) => (s.id === NOT_ASSESSED_ID ? [] : [s.id, s.label])),
    ...severitiesOf(definition).flatMap((s) => [s.id, s.label, s.guidance ?? ""]),
    ...captureFieldsOf(definition).flatMap((f) => [f.label, ...(f.options ?? [])]),
    ...categoryGroupsOf(definition).flatMap((g) => g.items.flatMap((i) => [i.id, i.label])),
    ...regulatoryReferencesOf(definition).flatMap((r) => [r.id, r.label]),
    ...aiGuidanceOf(definition).map((g) => g.text),
    ...outputSectionsOf(definition),
  ];

  /** Words shared by construction generally, not owned by any one discipline. */
  const shared = new Set([
    "location",
    "element",
    "monitor",
    "fire_safety",
    "electrical",
    "cover",
    "scope",
    "methodology",
    "summary",
    "schedule",
    "schedule_by_trade",
    "schedule_by_area",
    "appendix",
    "m&e",
    "principal contractor",
    "low",
    "medium",
    "high",
    "critical",
    "internal",
    "external",
    "unknown",
  ]);

  const tokens = (definition: SurveyTypeSnapshot) =>
    new Set(
      render(definition)
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value !== "" && value.length > 3 && !shared.has(value)),
    );

  it("renders each definition without any other definition's vocabulary", () => {
    for (const definition of systemDefinitions) {
      const own = tokens(definition);
      for (const other of systemDefinitions) {
        if (other.id === definition.id) continue;
        for (const value of tokens(other)) {
          expect.soft(own.has(value), `${value} leaked into ${definition.id}`).toBe(false);
        }
      }
    }
  });

  it("resolves a status id from another discipline to not_assessed", () => {
    expect(resolveStatus(siteWalkDefinition, "snag").id).toBe(NOT_ASSESSED_ID);
    expect(resolveStatus(weatherproofingDefinition, "observation").id).toBe(NOT_ASSESSED_ID);
    expect(resolveStatus(snaggingDefinition, "intact").id).toBe(NOT_ASSESSED_ID);
  });
});

describe("confidential exclusion", () => {
  it("never returns a confidential finding for distribution", () => {
    const selected = selectDistributionFindings(findings);
    expect(findings.some((f) => f.isConfidential)).toBe(true);
    expect(selected.every((f) => !f.isConfidential)).toBe(true);
  });

  it("excludes confidential findings from a per-trade extract", () => {
    const refs = distributionRefs(findings, "Principal contractor");
    const confidentialRefs = findings.filter((f) => f.isConfidential).map((f) => f.ref);
    for (const ref of confidentialRefs) expect(refs).not.toContain(ref);
  });
});

describe("reference stability", () => {
  it("deleting a photo does not change any finding ref", () => {
    const before = findings.map((f) => f.ref);
    const after = detachPhoto(findings, "ph-12").map((f) => f.ref);
    expect(after).toEqual(before);
  });

  it("detaches only the deleted photo", () => {
    const result = detachPhoto(findings, "ph-12");
    expect(result.every((f) => !f.photoIds.includes("ph-12"))).toBe(true);
    expect(result[0]?.photoIds).toContain("ph-11");
  });

  it("new refs continue from the highest issued ref, not the array length", () => {
    const remaining = findings.slice(0, 2).map((f) => f.ref);
    expect(nextRef(findings.map((f) => f.ref))).toBe("F-007");
    expect(nextRef([...remaining, "F-006"])).toBe("F-007");
  });
});
