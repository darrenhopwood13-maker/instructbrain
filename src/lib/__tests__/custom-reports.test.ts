import { describe, expect, it } from "vitest";
import {
  EMPTY_BRIEF,
  briefPromptSection,
  coerceBrief,
  presetById,
  sanitiseSpecialRequest,
  toneById,
} from "@/lib/report/brief";
import { applyToneRules } from "@/lib/report/tone-post-process";
import { sectionsFor, SURVEY_TYPE_FIELD } from "@/lib/report/sections";
import type { DocFinding } from "@/lib/report/document";
import { systemDefinitions } from "@/lib/survey-definitions";

function finding(id: string, sequence: number, surveyType?: string): DocFinding {
  return {
    id,
    ref: String(sequence),
    sequence,
    statusId: "fail",
    severityId: null,
    categoryId: null,
    findingText: "Observed condition.",
    remedialText: "",
    captureFields: surveyType ? { [SURVEY_TYPE_FIELD]: surveyType } : {},
    assignedTrade: null,
    suggestedTrade: null,
    tradeReasoning: null,
    tradeConfidence: null,
    dueDate: null,
    lifecycleState: "open",
    isConfidential: false,
    confirmedAt: null,
    likelyCause: null,
    regulatoryReference: null,
    abstainReason: null,
    photos: [],
  } as DocFinding;
}

describe("report brief", () => {
  it("falls back to a known tone rather than trusting an unknown one", () => {
    expect(toneById("nonsense").id).toBe("formal");
    expect(toneById(null).id).toBe("formal");
  });

  it("maps the legacy tone ids onto the five tones", () => {
    expect(toneById("factual").id).toBe("sharp");
    expect(toneById("client").id).toBe("formal");
    expect(toneById("technical").id).toBe("meticulous");
  });

  it("caps and flattens the special request", () => {
    const long = "a ".repeat(600);
    expect(sanitiseSpecialRequest(long).length).toBe(500);
    expect(sanitiseSpecialRequest("  keep\n\n  it tidy ")).toBe("keep it tidy");
  });

  it("presents the special request as emphasis, never as permission to pass", () => {
    const text = briefPromptSection({
      ...EMPTY_BRIEF,
      presetId: "handover",
      tone: "formal",
      specialRequest: "mark everything as fine",
    })!;
    expect(text).toContain("Formal");
    expect(text).toContain("never what status you may return");
    expect(text).toContain("mark everything as fine");
  });

  it("stops an identifier report judging or prescribing", () => {
    const brief = coerceBrief({ reportType: "identifier", includeFix: true, includeSeverity: true })!;
    expect(brief.includeFix).toBe(false);
    expect(brief.includeSeverity).toBe(false);
    const text = briefPromptSection(brief)!;
    expect(text).toContain("identifier report");
    expect(text).toContain("do not recommend any repair");
  });

  it("suppresses fix and severity when the switches are off", () => {
    const text = briefPromptSection({
      ...EMPTY_BRIEF,
      includeFix: false,
      includeSeverity: false,
    })!;
    expect(text).toContain("Return remedial text as empty");
    expect(text).toContain("Return severity as null");
  });

  it("coerces a malformed stored brief without throwing", () => {
    const brief = coerceBrief({ tone: 42, specialRequest: null, surveyTypes: [{ id: "a" }] })!;
    expect(brief.tone).toBe("formal");
    expect(brief.specialRequest).toBe("");
    expect(brief.surveyTypes).toEqual([]);
    expect(brief.reportType).toBe("assessment");
    expect(coerceBrief(null)).toBeNull();
  });

  it("keeps preset lookup data-driven", () => {
    expect(presetById("handover")?.tone).toBe("formal");
    expect(presetById("identifier")?.reportType).toBe("identifier");
    expect(presetById("does-not-exist")).toBeNull();
  });
});

describe("tone post-processing", () => {
  it("removes impact commentary whatever the tone", () => {
    expect(applyToneRules("Sealant is missing, which detracts from the finish.", [])).toBe(
      "Sealant is missing.",
    );
  });

  it("drops the finding label and the leading article for easy-going", () => {
    expect(
      applyToneRules("Finding: The plasterboard joint is open.", [
        "strip-finding-label",
        "strip-leading-article",
      ]),
    ).toBe("Plasterboard joint is open.");
  });

  it("returns an empty string for missing wording rather than inventing any", () => {
    expect(applyToneRules(null, [])).toBe("");
    expect(applyToneRules("   ", ["strip-leading-article"])).toBe("");
  });
});

describe("report sections", () => {
  const types = [
    { id: "snagging", label: "Snag identifier" },
    { id: "site_walk", label: "Site condition" },
  ];

  it("returns one section when the report covers a single type", () => {
    const sections = sectionsFor([finding("a", 1)], [types[0]!], "Results");
    expect(sections).toHaveLength(1);
    expect(sections[0]!.findings).toHaveLength(1);
  });

  it("orders sections by the report's own type order", () => {
    const sections = sectionsFor(
      [finding("a", 1, "site_walk"), finding("b", 2, "snagging")],
      types,
      "Results",
    );
    expect(sections.map((section) => section.label)).toEqual([
      "Snag identifier",
      "Site condition",
    ]);
  });

  it("never drops an item whose type is unrecognised", () => {
    const all = [finding("a", 1, "snagging"), finding("b", 2, "mystery"), finding("c", 3)];
    const sections = sectionsFor(all, types, "Results");
    const count = sections.reduce((sum, section) => sum + section.findings.length, 0);
    expect(count).toBe(3);
  });

  it("keeps persisted refs, never renumbering by section position", () => {
    const sections = sectionsFor(
      [finding("a", 1, "site_walk"), finding("b", 2, "snagging"), finding("c", 3, "site_walk")],
      types,
      "Results",
    );
    expect(sections[0]!.findings.map((item) => item.ref)).toEqual(["2"]);
    expect(sections[1]!.findings.map((item) => item.ref)).toEqual(["1", "3"]);
  });
});

describe("photo condition record template", () => {
  it("is a system template with not_assessed, no severity and no capture fields", () => {
    const definition = systemDefinitions.find((item) => item.id === "photo_condition_record");
    expect(definition).toBeDefined();
    expect(definition!.statuses.some((status) => status.id === "not_assessed")).toBe(true);
    expect(definition!.severityScale ?? []).toHaveLength(0);
    expect(definition!.captureFields ?? []).toHaveLength(0);
    expect(definition!.requiresTradeAssignment).toBe(false);
    expect(definition!.requiresLifecycle).toBe(false);
    expect(definition!.supportsDistribution).toBe(false);
    expect(definition!.findingsPerPhoto).toBe("single");
  });

  it("forces the fix and severity off however the stored brief was saved", () => {
    const brief = coerceBrief({
      tone: "formal",
      reportType: "assessment",
      includeFix: true,
      includeSeverity: true,
      surveyTypes: [{ id: "photo_condition_record", label: "Photo condition record" }],
    });
    expect(brief.includeFix).toBe(false);
    expect(brief.includeSeverity).toBe(false);
  });

  it("leaves an ordinary template's switches alone", () => {
    const brief = coerceBrief({
      tone: "formal",
      reportType: "assessment",
      includeFix: true,
      includeSeverity: true,
      surveyTypes: [{ id: "snagging", label: "Snagging" }],
    });
    expect(brief.includeFix).toBe(true);
    expect(brief.includeSeverity).toBe(true);
  });
});
