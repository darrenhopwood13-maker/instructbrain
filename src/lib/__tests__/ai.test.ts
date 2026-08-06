import { describe, expect, it } from "vitest";
import {
  notAssessedDraft,
  observationJsonSchema,
  parseObservations,
  toDraftFinding,
  type Observation,
} from "@/lib/ai/observation";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { mapWithConcurrency } from "@/lib/ai/provider.server";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

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
  aiGuidance: { focus: "Assess the weathering detail only." },
};

const siteWalk: SurveyTypeSnapshot = {
  id: "site_walk",
  version: 1,
  label: "Site Walk",
  findingsPerPhoto: "multiple",
  statuses: [{ id: "observation", label: "Observation", tone: "neutral" }],
};

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    status: "compliant",
    confidence: 0.9,
    category: null,
    severity: null,
    observation: "Lead flashing dressed correctly into the brick joint.",
    remedial: null,
    likely_cause: null,
    regulatory_reference: null,
    suggested_trade: null,
    trade_confidence: null,
    trade_reasoning: null,
    involves_person: null,
    ...overrides,
  };
}

describe("AI failure never becomes a pass", () => {
  it("keeps a confident, recognised status", () => {
    expect(toDraftFinding(observation(), roofing, thresholds).status).toBe("compliant");
  });

  it("routes low confidence to not_assessed", () => {
    const draft = toDraftFinding(observation({ confidence: 0.4 }), roofing, thresholds);
    expect(draft.status).toBe("not_assessed");
  });

  it("routes a null confidence to not_assessed", () => {
    expect(toDraftFinding(observation({ confidence: null }), roofing, thresholds).status).toBe(
      "not_assessed",
    );
  });

  it("routes an unknown status to not_assessed, never to a passing status", () => {
    const draft = toDraftFinding(
      observation({ status: "looks_fine_to_me" }),
      roofing,
      thresholds,
    );
    expect(draft.status).toBe("not_assessed");
  });

  it("yields nothing from malformed provider output", () => {
    expect(parseObservations("not json at all")).toEqual([]);
    expect(parseObservations({ observations: "nope" })).toEqual([]);
    expect(parseObservations(null)).toEqual([]);
  });

  it("marks an error as not_assessed with a readable reason", () => {
    const draft = notAssessedDraft("the provider returned 500.");
    expect(draft.status).toBe("not_assessed");
    expect(draft.finding_text).toContain("the provider returned 500.");
  });
});

const thresholds = { confidenceThreshold: 0.6, tradeConfidenceThreshold: 0.6 };

describe("trade attribution is a suggestion", () => {
  it("never writes assigned_trade", () => {
    const draft = toDraftFinding(
      observation({ suggested_trade: "Roofing", trade_confidence: 0.9, trade_reasoning: "Lead detail." }),
      roofing,
      thresholds,
    );
    expect(draft).not.toHaveProperty("assigned_trade");
    expect(draft.ai_suggested_trade).toBe("Roofing");
    expect(draft.ai_trade_reasoning).toBe("Lead detail.");
  });

  it("drops a low-confidence trade suggestion", () => {
    const draft = toDraftFinding(
      observation({ suggested_trade: "Roofing", trade_confidence: 0.2 }),
      roofing,
      thresholds,
    );
    expect(draft.ai_suggested_trade).toBeNull();
  });
});

describe("people are handled separately", () => {
  it("marks an observation involving a person as confidential", () => {
    const draft = toDraftFinding(observation({ involves_person: true }), roofing, thresholds);
    expect(draft.is_confidential).toBe(true);
  });

  it("instructs the model never to describe a person", () => {
    expect(buildSystemPrompt(roofing)).toContain("Never describe, identify, count");
  });
});

describe("no discipline's vocabulary leaks", () => {
  it("only offers the statuses the definition declares, plus not_assessed", () => {
    const schema = observationJsonSchema(roofing);
    const statuses = schema.properties.observations.items.properties.status.enum as string[];
    expect(statuses).toContain("compliant");
    expect(statuses).toContain("not_assessed");
    expect(statuses).not.toContain("observation");
  });

  it("keeps one definition's words out of another's prompt", () => {
    const walk = buildSystemPrompt(siteWalk);
    expect(walk).not.toContain("Weathertight");
    expect(walk).not.toContain("Flashing");
    expect(buildSystemPrompt(roofing)).toContain("Weathertight");
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
