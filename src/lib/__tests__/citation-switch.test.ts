import { describe, expect, it } from "vitest";

import { buildSystemPrompt, allowsRegulationReferences } from "@/lib/ai/prompt";
import {
  REGULATION_REFERENCES_DEFAULT,
  regulationReferencesFromBrief,
  regulationReferencesRule,
  resolveRegulationReferences,
} from "@/lib/citation-switch";
import { briefPromptSection, coerceBrief, EMPTY_BRIEF, type ReportBrief } from "@/lib/report/brief";
import {
  propertyInventoryDefinition,
  siteWalkDefinition,
  snapshotOf,
} from "@/lib/survey-definitions";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

const siteWalk = snapshotOf(siteWalkDefinition) as SurveyTypeSnapshot;
const noSet = snapshotOf(propertyInventoryDefinition) as SurveyTypeSnapshot;

function brief(overrides: Partial<ReportBrief> = {}): ReportBrief {
  return { ...EMPTY_BRIEF, ...overrides };
}

describe("the regulation reference switch", () => {
  it("defaults on, so a brief that never carried it behaves as it always did", () => {
    expect(REGULATION_REFERENCES_DEFAULT).toBe(true);
    expect(resolveRegulationReferences(undefined)).toBe(true);
    expect(resolveRegulationReferences(null)).toBe(true);
    expect(resolveRegulationReferences("off")).toBe(true);
    expect(resolveRegulationReferences(0)).toBe(true);
  });

  it("only a real boolean turns it off", () => {
    expect(resolveRegulationReferences(false)).toBe(false);
    expect(resolveRegulationReferences(true)).toBe(true);
  });

  it("reads the switch off a raw brief, whatever shape it arrives in", () => {
    expect(regulationReferencesFromBrief({ regulationReferences: false })).toBe(false);
    expect(regulationReferencesFromBrief({ regulationReferences: true })).toBe(true);
    expect(regulationReferencesFromBrief({})).toBe(true);
    expect(regulationReferencesFromBrief(null)).toBe(true);
    expect(regulationReferencesFromBrief("not a brief")).toBe(true);
  });

  it("keeps an older stored brief working: a missing key means on", () => {
    const coerced = coerceBrief({ tone: "plain", reportType: "assessment" });
    expect(coerced?.regulationReferences).toBe(true);
    const off = coerceBrief({ regulationReferences: false });
    expect(off?.regulationReferences).toBe(false);
  });

  it("needs BOTH the template's set and the brief's permission", () => {
    expect(allowsRegulationReferences(siteWalk, null)).toBe(true);
    expect(allowsRegulationReferences(siteWalk, brief({ regulationReferences: true }))).toBe(true);
    expect(allowsRegulationReferences(siteWalk, brief({ regulationReferences: false }))).toBe(false);
    // no set on the template: never cites, whatever the brief says
    expect(allowsRegulationReferences(noSet, brief({ regulationReferences: true }))).toBe(false);
    expect(allowsRegulationReferences(noSet, brief({ regulationReferences: false }))).toBe(false);
  });
});

describe("what the switch does to the composed prompt", () => {
  it("with it on: the template's instruments are offered, from its own list only", () => {
    const prompt = buildSystemPrompt(siteWalk, brief({ regulationReferences: true }));
    expect(prompt).toContain("must be one of these ids exactly, or null. Never invent one");
    expect(prompt).toContain("hswa_1974");
    expect(prompt).toContain("wah_2005");
    expect(prompt).toContain("must name the SINGLE most relevant entry");
    expect(prompt).not.toContain("Regulation references are switched off for this report");
  });

  it("with no brief at all: unchanged from before the switch existed", () => {
    const prompt = buildSystemPrompt(siteWalk, null);
    expect(prompt).toContain("hswa_1974");
    expect(prompt).toContain("must be one of these ids exactly, or null. Never invent one");
  });

  it("with it off: the list is gone AND a prohibition takes its place", () => {
    const prompt = buildSystemPrompt(siteWalk, brief({ regulationReferences: false }));
    // the instruments must not be offered to the model at all
    expect(prompt).not.toContain("hswa_1974");
    expect(prompt).not.toContain("must be one of these ids exactly, or null. Never invent one");
    // and the instruction must be explicit, in two places: the brief section and the field rule
    expect(prompt).toContain("Regulation references are switched off for this report");
    expect(prompt).toContain("return regulatory_reference as null");
    // the phrase that matters: nothing may be named in prose either
    expect(prompt).toContain("Do not name a regulation, a standard or an Approved Document");
  });

  it("a template with no set is prohibited whether the switch is on or off", () => {
    for (const value of [true, false]) {
      const prompt = buildSystemPrompt(noSet, brief({ regulationReferences: value }));
      // the original template-level prohibition, unchanged by this switch
      expect(prompt).toContain("Do not return a regulatory_reference for this survey type");
      expect(prompt).not.toContain("Never invent one");
    }
  });

  it("the brief section alone states the switch, so it cannot be lost by another path", () => {
    const off = briefPromptSection(brief({ regulationReferences: false }));
    expect(off).toContain("switched off for this report");
    const on = briefPromptSection(brief({ regulationReferences: true }));
    expect(on).not.toContain("switched off for this report");
  });

  it("the switch and the rule agree, whichever way it is asked", () => {
    // a brief written before this switch existed: the key is simply absent
    const bare = { ...brief() };
    delete (bare as Partial<ReportBrief>).regulationReferences;
    const cases = [bare, brief({ regulationReferences: true }), brief({ regulationReferences: false })];
    for (const b of cases) {
      expect(regulationReferencesRule(b)).toBe(allowsRegulationReferences(siteWalk, b));
    }
  });
});
