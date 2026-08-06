import { describe, expect, it } from "vitest";
import {
  SchemaValidationError,
  draftsFromEnvelope,
  envelopeJsonSchema,
  needsEscalation,
  notAssessedDraft,
  parseEnvelope,
  toDraftFinding,
  type Envelope,
  type Observation,
} from "@/lib/ai/observation";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { mapWithConcurrency } from "@/lib/ai/provider.server";
import { resolveStatus } from "@/lib/survey-types";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

/** Fixtures live in the test file. No invented data exists in src/ outside tests. */

const roofing: SurveyTypeSnapshot = {
  id: "weatherproofing",
  version: 1,
  label: "Weatherproofing",
  findingsPerPhoto: "single",
  statuses: [
    { id: "compliant", label: "Weathertight", tone: "pass" },
    { id: "defective", label: "Not weathertight", tone: "fail" },
  ],
  hazardCategories: [{ id: "flashing", label: "Flashing", defaultTrades: ["Roofing"] }],
  regulatoryReferences: [{ id: "bs8217", label: "BS 8217 Reinforced bitumen membranes" }],
  aiGuidance: { focus: "Assess the weathering detail only." },
};

const siteWalk: SurveyTypeSnapshot = {
  id: "site_walk",
  version: 1,
  label: "Site Walk",
  findingsPerPhoto: "multiple",
  statuses: [{ id: "observation", label: "Observation", tone: "neutral" }],
};

const options = { confidenceThreshold: 0.6, tradeConfidenceThreshold: 0.6, tier: "triage" };

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    category: null,
    status: "compliant",
    confidence: 0.9,
    finding: "Lead flashing dressed correctly into the brick joint.",
    severity: null,
    severity_rationale: null,
    remedial: null,
    suggested_trade: null,
    trade_reasoning: null,
    trade_confidence: null,
    region: null,
    involves_person: false,
    likely_cause: null,
    regulatory_reference: null,
    ...overrides,
  };
}

function envelope(overrides: Partial<Envelope> = {}): Envelope {
  return { assessable: true, abstain_reason: null, observations: [observation()], ...overrides };
}

const isPass = (status: string) => resolveStatus(roofing, status).tone === "pass";

describe("invariant 1 — AI failure never becomes a pass", () => {
  it("keeps a confident, recognised status", () => {
    expect(toDraftFinding(observation(), roofing, options).status).toBe("compliant");
  });

  it.each([
    ["low confidence", observation({ confidence: 0.4 })],
    ["absent confidence", observation({ confidence: null })],
    ["an unrecognised status", observation({ status: "looks_fine_to_me" })],
    ["a null status", observation({ status: null })],
  ])("routes %s to not_assessed", (_label, input) => {
    const draft = toDraftFinding(input, roofing, options);
    expect(draft.status).toBe("not_assessed");
    expect(isPass(draft.status)).toBe(false);
  });

  it("routes assessable:false to not_assessed and keeps the abstain reason", () => {
    const drafts = draftsFromEnvelope(
      envelope({ assessable: false, abstain_reason: "the photograph is too dark to read." }),
      roofing,
      options,
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.status).toBe("not_assessed");
    expect(drafts[0]!.ai_abstain_reason).toContain("too dark");
  });

  it("rejects an empty observations array on a single-finding type", () => {
    const drafts = draftsFromEnvelope(envelope({ observations: [] }), roofing, options);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.status).toBe("not_assessed");
  });

  it("accepts an empty array on a multi-finding type", () => {
    expect(draftsFromEnvelope(envelope({ observations: [] }), siteWalk, options)).toEqual([]);
  });

  it("rejects two observations on a single-finding type", () => {
    const drafts = draftsFromEnvelope(
      envelope({ observations: [observation(), observation()] }),
      roofing,
      options,
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.status).toBe("not_assessed");
  });

  it("does not throw uncaught on malformed JSON, and preserves the reason", () => {
    let draft;
    try {
      parseEnvelope("not json at all");
      throw new Error("parseEnvelope should have rejected this");
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaValidationError);
      draft = notAssessedDraft((error as Error).message, "triage");
    }
    expect(draft.status).toBe("not_assessed");
    expect(isPass(draft.status)).toBe(false);
    expect(draft.finding_text).toContain("not an object");
  });

  it("marks a transport error as not_assessed with a readable reason", () => {
    const draft = notAssessedDraft("the provider returned 500.", "escalation");
    expect(draft.status).toBe("not_assessed");
    expect(draft.finding_text).toContain("the provider returned 500.");
    expect(draft.ai_tier).toBe("escalation");
  });
});

describe("escalation", () => {
  it("escalates low confidence, abstentions and fail-tone results", () => {
    expect(needsEscalation(envelope({ assessable: false }), roofing, 0.6)).toBe(true);
    expect(
      needsEscalation(envelope({ observations: [observation({ confidence: 0.3 })] }), roofing, 0.6),
    ).toBe(true);
    expect(
      needsEscalation(
        envelope({ observations: [observation({ status: "defective" })] }),
        roofing,
        0.6,
      ),
    ).toBe(true);
  });

  it("leaves a confident pass alone", () => {
    expect(needsEscalation(envelope(), roofing, 0.6)).toBe(false);
  });
});

describe("invariant 6 — trade attribution is a suggestion", () => {
  it("never writes assigned_trade", () => {
    const draft = toDraftFinding(
      observation({
        suggested_trade: "Roofing",
        trade_confidence: 0.9,
        trade_reasoning: "Lead detail.",
      }),
      roofing,
      options,
    );
    expect(draft).not.toHaveProperty("assigned_trade");
    expect(draft.ai_suggested_trade).toBe("Roofing");
    expect(draft.ai_trade_reasoning).toBe("Lead detail.");
  });

  it("drops a low-confidence trade suggestion", () => {
    const draft = toDraftFinding(
      observation({ suggested_trade: "Roofing", trade_confidence: 0.2 }),
      roofing,
      options,
    );
    expect(draft.ai_suggested_trade).toBeNull();
  });
});

describe("invariant 7 — people are handled separately", () => {
  it("marks an observation involving a person as confidential", () => {
    expect(toDraftFinding(observation({ involves_person: true }), roofing, options).is_confidential)
      .toBe(true);
  });

  it("instructs the model never to describe a person", () => {
    expect(buildSystemPrompt(roofing)).toContain("Never describe, identify, count");
  });
});

describe("regulatory references", () => {
  it("keeps a reference the definition supplies", () => {
    const draft = toDraftFinding(
      observation({ regulatory_reference: "bs8217" }),
      roofing,
      options,
    );
    expect(draft.regulatory_reference).toBe("bs8217");
  });

  it("discards an invented reference rather than storing it", () => {
    const draft = toDraftFinding(
      observation({ regulatory_reference: "bs9999_invented" }),
      roofing,
      options,
    );
    expect(draft.regulatory_reference).toBeNull();
  });
});

describe("invariant 5 — no discipline's vocabulary leaks", () => {
  it("only offers the statuses the definition declares, plus not_assessed", () => {
    const schema = envelopeJsonSchema(roofing);
    const statuses = schema.properties.observations.items.properties["status"] as {
      enum: string[];
    };
    expect(statuses.enum).toContain("compliant");
    expect(statuses.enum).toContain("not_assessed");
    expect(statuses.enum).not.toContain("observation");
  });

  it("keeps one definition's words out of another's prompt", () => {
    const walk = buildSystemPrompt(siteWalk);
    expect(walk).not.toContain("Weathertight");
    expect(walk).not.toContain("Flashing");
    expect(walk).not.toContain("BS 8217");
    expect(buildSystemPrompt(roofing)).toContain("Weathertight");
  });

  it("shares no distinctive term between two definitions' prompts", () => {
    const distinctive = (text: string) =>
      new Set(
        text
          .toLowerCase()
          .split(/[^a-z0-9_]+/)
          .filter((word) => word.length > 6),
      );
    const roofingWords = distinctive(buildSystemPrompt(roofing));
    const walkWords = distinctive(buildSystemPrompt(siteWalk));
    for (const term of ["weathertight", "weatherproofing", "flashing", "bitumen"]) {
      expect(roofingWords.has(term) && walkWords.has(term)).toBe(false);
    }
  });

  it("tells a single-finding type to return at most one entry", () => {
    expect(buildSystemPrompt(roofing)).toContain("at most one entry");
    expect(buildSystemPrompt(siteWalk)).toContain("one array entry per distinct observation");
  });
});

describe("concurrency", () => {
  it("never runs more than the limit at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 20 }, (_, index) => index);
    const results = await mapWithConcurrency(items, 5, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return item * 2;
    });
    expect(peak).toBeLessThanOrEqual(5);
    expect(results[19]).toBe(38);
  });
});
