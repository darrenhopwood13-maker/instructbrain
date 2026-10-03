import { afterEach, describe, expect, it } from "vitest";
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
import { aiConfig, escalationTarget, providerProfiles } from "@/lib/ai/config";
import { adapters } from "@/lib/ai/adapters.server";
import { analysePhotograph, mapWithConcurrency } from "@/lib/ai/provider.server";
import { resolveStatus, statusesOf } from "@/lib/survey-types";
import { systemDefinitions, weatherproofingDefinition } from "@/lib/survey-definitions";
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

describe("house voice", () => {
  const voiced: SurveyTypeSnapshot = {
    ...roofing,
    houseVoice: "You are the instructBrain Oracle: ABSTENTION IS NOT HEDGING.",
    aiGuidance: { persona: "Assessing weatherproofing membrane condition." },
  };

  it("places the snapshot's house voice before the type-specific persona", () => {
    const prompt = buildSystemPrompt(voiced);
    expect(prompt).toContain("ABSTENTION IS NOT HEDGING.");
    expect(prompt.indexOf("instructBrain Oracle")).toBeLessThan(
      prompt.indexOf("Assessing weatherproofing membrane condition."),
    );
  });

  it("supplies no house voice of its own when the snapshot has none", () => {
    expect(buildSystemPrompt(roofing)).not.toContain("Oracle");
  });

  it("keeps the Oracle text out of the prompt builder and the AI server code", async () => {
    const files = [
      "src/lib/ai/prompt.ts",
      "src/lib/ai/analyse.server.ts",
      "src/lib/ai/provider.server.ts",
      "src/lib/ai/adapters.server.ts",
      "src/lib/ai/analyse.functions.ts",
    ];
    const fs = await import("node:fs/promises");
    for (const file of files) {
      const source = await fs.readFile(file, "utf8");
      expect(source).not.toContain("Oracle");
      expect(source).not.toContain("ABSTENTION IS NOT HEDGING");
    }
  });
});

describe("intermediate statuses are reachable", () => {
  it("lists every weatherproofing status label, including the middle and not-assessed states", () => {
    const prompt = buildSystemPrompt(weatherproofingDefinition);
    for (const status of statusesOf(weatherproofingDefinition)) {
      expect(prompt).toContain(status.label);
    }
    expect(prompt).toContain("Serviceable — monitor");
    expect(prompt).toContain("Not assessed");
  });

  it("warns that using only the extreme statuses is poor assessment", () => {
    expect(buildSystemPrompt(weatherproofingDefinition)).toContain(
      "Returning only the extreme statuses",
    );
  });

  it("carries the house voice on every system definition, at a published version", () => {
    for (const definition of systemDefinitions) {
      expect(definition.version).toBeGreaterThanOrEqual(1);
      if (definition.manualOnly) continue;
      expect(buildSystemPrompt(definition)).toContain("instructBrain Oracle");
    }
  });


  it("renders a pre-change report from its own version 1 snapshot, unchanged", () => {
    const legacy: SurveyTypeSnapshot = {
      id: "weatherproofing",
      version: 1,
      label: "Weatherproofing membrane survey",
      statuses: [
        { id: "intact", label: "Intact — no action required", tone: "pass" },
        { id: "damaged", label: "Damaged — remedial required", tone: "fail" },
      ],
      aiGuidance: { persona: "A UK chartered building surveyor assessing weatherproofing membrane condition." },
    };
    const prompt = buildSystemPrompt(legacy);
    expect(prompt).not.toContain("Oracle");
    expect(prompt).toContain("A UK chartered building surveyor");
    expect(resolveStatus(legacy, "monitor").id).toBe("not_assessed");
  });
});

describe("ai config — thinking, and which model a tier actually gets", () => {
  /**
   * Everything below reads process.env, so each case runs with a scrubbed
   * environment and puts it back afterwards. Without the scrub a stray key on
   * the developer's machine decides which provider is selected and the test
   * proves nothing.
   */
  const MANAGED = [
    "DEEPSEEK_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GOOGLE_API_KEY",
    "AI_PROVIDER",
    "AI_THINKING",
    "AI_TRIAGE_THINKING",
    "AI_ESCALATION_THINKING",
    "AI_TRIAGE_MODEL",
    "AI_ESCALATION_MODEL",
    "AI_TRIAGE_MODEL_DEEPSEEK",
    "AI_ESCALATION_MODEL_DEEPSEEK",
    "AI_ESCALATION_PROVIDER",
    "AI_ESCALATION_MODEL_ANTHROPIC",
  ];

  function withEnv(vars: Record<string, string>, run: () => void): void {
    const before = MANAGED.map((name) => [name, process.env[name]] as const);
    for (const name of MANAGED) delete process.env[name];
    Object.assign(process.env, vars);
    try {
      run();
    } finally {
      for (const [name, value] of before) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  }

  const DEEPSEEK = { DEEPSEEK_API_KEY: "test-key-not-used" };

  it("defaults thinking to OFF on both tiers", () => {
    // Not a style choice: reasoning is billed as output and, measured on the
    // real prompt with a real photograph, it tripled the cost of a photograph
    // while returning the same envelope. See resolveThinking in config.ts.
    withEnv(DEEPSEEK, () => {
      const config = aiConfig();
      expect(config.thinking.triage).toBe(false);
      expect(config.thinking.escalation).toBe(false);
    });
  });

  it("turns both tiers on from AI_THINKING", () => {
    withEnv({ ...DEEPSEEK, AI_THINKING: "true" }, () => {
      const config = aiConfig();
      expect(config.thinking.triage).toBe(true);
      expect(config.thinking.escalation).toBe(true);
    });
  });

  it("turns one tier on with the per-tier variable, leaving the other alone", () => {
    withEnv({ ...DEEPSEEK, AI_ESCALATION_THINKING: "true" }, () => {
      const config = aiConfig();
      expect(config.thinking.triage).toBe(false);
      expect(config.thinking.escalation).toBe(true);
    });
  });

  it("lets the per-tier variable override the global one, including back to off", () => {
    withEnv({ ...DEEPSEEK, AI_THINKING: "true", AI_TRIAGE_THINKING: "false" }, () => {
      const config = aiConfig();
      expect(config.thinking.triage).toBe(false);
      expect(config.thinking.escalation).toBe(true);
    });
  });

  it("puts DeepSeek first, and keeps both of its tiers on a vision model", () => {
    // deepseek-v4-pro cannot accept an image, and escalation re-examines the
    // same photograph, so escalation must be vision-capable too.
    withEnv(DEEPSEEK, () => {
      const profiles = providerProfiles();
      expect(profiles[0].id).toBe("deepseek");
      expect(profiles[0].triageModel).toBe("deepseek-flash");
      expect(profiles[0].escalationModel).toBe("deepseek-flash");
      const config = aiConfig();
      expect(config.provider).toBe("deepseek");
      expect(config.models.escalation).toBe(config.models.triage);
    });
  });

  it("discards a model name belonging to another provider, and says why", () => {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message?: unknown) => warnings.push(String(message));
    try {
      withEnv({ ...DEEPSEEK, AI_TRIAGE_MODEL: "claude-sonnet-4-5" }, () => {
        const config = aiConfig();
        expect(config.models.triage).toBe("deepseek-flash");
      });
    } finally {
      console.warn = original;
    }
    expect(warnings.join("\n")).toContain("claude-sonnet-4-5");
    expect(warnings.join("\n")).toContain("deepseek-flash");
  });

  it("still lets a deliberate DeepSeek model through the shared variable", () => {
    withEnv({ ...DEEPSEEK, AI_TRIAGE_MODEL: "deepseek-flash" }, () => {
      expect(aiConfig().models.triage).toBe("deepseek-flash");
    });
  });

  it("lets a provider-scoped variable win, and an unknown name pass untouched", () => {
    withEnv({ ...DEEPSEEK, AI_TRIAGE_MODEL_DEEPSEEK: "deepseek-flash" }, () => {
      expect(aiConfig().models.triage).toBe("deepseek-flash");
    });
    // A custom or gateway name is not a mismatch — it must not be discarded.
    withEnv({ ...DEEPSEEK, AI_TRIAGE_MODEL: "my-gateway-alias-v2" }, () => {
      expect(aiConfig().models.triage).toBe("my-gateway-alias-v2");
    });
  });
});

describe("escalation may live on another provider", () => {
  const ANTHROPIC = { ANTHROPIC_API_KEY: "test-key-not-used" };
  const DEEPSEEK = { DEEPSEEK_API_KEY: "test-key-not-used" };

  // aiConfig and escalationTarget both read process.env, so this block needs the
  // same scrub as the one above.
  const MANAGED = [
    "DEEPSEEK_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GOOGLE_API_KEY",
    "AI_PROVIDER",
    "AI_TRIAGE_MODEL",
    "AI_ESCALATION_MODEL",
    "AI_TRIAGE_MODEL_DEEPSEEK",
    "AI_ESCALATION_MODEL_DEEPSEEK",
    "AI_ESCALATION_PROVIDER",
    "AI_ESCALATION_MODEL_ANTHROPIC",
    "AI_ESCALATION_DISABLED",
  ];

  function withEnv(vars: Record<string, string>, run: () => void): void {
    const before = MANAGED.map((name) => [name, process.env[name]] as const);
    for (const name of MANAGED) delete process.env[name];
    Object.assign(process.env, vars);
    try {
      run();
    } finally {
      for (const [name, value] of before) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  }

  function silenceWarnings(run: () => void): string[] {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message?: unknown) => warnings.push(String(message));
    try {
      run();
    } finally {
      console.warn = original;
    }
    return warnings;
  }

  it("is off unless asked for, so nothing changes by default", () => {
    withEnv(DEEPSEEK, () => expect(escalationTarget()).toBeNull());
  });

  it("resolves the named provider, its key and its own escalation model", () => {
    withEnv({ ...DEEPSEEK, ...ANTHROPIC, AI_ESCALATION_PROVIDER: "anthropic" }, () => {
      expect(escalationTarget()).toEqual({
        provider: "anthropic",
        apiKey: "test-key-not-used",
        model: "claude-sonnet-4-5",
      });
    });
  });

  it("discards a model name belonging to the triage provider", () => {
    // The trap: AI_ESCALATION_MODEL is shared, so a DeepSeek name left over
    // from the triage side would be handed to Anthropic and rejected.
    withEnv(
      { ...DEEPSEEK, ...ANTHROPIC, AI_ESCALATION_PROVIDER: "anthropic", AI_ESCALATION_MODEL: "deepseek-flash" },
      () => {
        const warnings = silenceWarnings(() => {
          expect(escalationTarget()?.model).toBe("claude-sonnet-4-5");
        });
        expect(warnings.join("\n")).toContain("deepseek-flash");
      },
    );
  });

  it("refuses a provider it does not know, and says so", () => {
    withEnv({ ...DEEPSEEK, AI_ESCALATION_PROVIDER: "mistral" }, () => {
      let target: unknown = "unset";
      const warnings = silenceWarnings(() => {
        target = escalationTarget();
      });
      expect(target).toBeNull();
      expect(warnings.join("\n")).toContain("mistral");
    });
  });

  it("refuses a provider whose key is missing, rather than sending a bad call", () => {
    withEnv({ ...DEEPSEEK, AI_ESCALATION_PROVIDER: "anthropic" }, () => {
      let target: unknown = "unset";
      const warnings = silenceWarnings(() => {
        target = escalationTarget();
      });
      expect(target).toBeNull();
      expect(warnings.join("\n")).toContain("ANTHROPIC_API_KEY");
    });
  });

  describe("and actually runs there, or does not", () => {
    const original = { deepseek: adapters.deepseek, anthropic: adapters.anthropic };

    function stub(label: string, calls: string[], payload: unknown) {
      return (async () => {
        calls.push(label);
        return { payload, raw: {}, usage: { inputTokens: 10, outputTokens: 5 } };
      }) as unknown as typeof adapters.deepseek;
    }

    // confidence 0.3 is below the 0.6 threshold, so triage asks for a second look.
    const unsure = envelope({ observations: [observation({ confidence: 0.3 })] });
    const definite = envelope({ observations: [observation({ confidence: 0.9 })] });

    const input = {
      snapshot: roofing,
      systemPrompt: "system",
      userPrompt: "user",
      imageUrl: "data:image/jpeg;base64,AAAA",
    };

    afterEach(() => {
      adapters.deepseek = original.deepseek;
      adapters.anthropic = original.anthropic;
    });

    async function run(vars: Record<string, string>) {
      const calls: string[] = [];
      (adapters as Record<string, unknown>).deepseek = stub("deepseek", calls, unsure);
      (adapters as Record<string, unknown>).anthropic = stub("anthropic", calls, definite);
      let outcome: Awaited<ReturnType<typeof analysePhotograph>> | null = null;
      // withEnv is synchronous, so the env must be applied around the await.
      const before = MANAGED.map((name) => [name, process.env[name]] as const);
      for (const name of MANAGED) delete process.env[name];
      Object.assign(process.env, vars);
      try {
        outcome = await analysePhotograph(input, aiConfig());
      } finally {
        for (const [name, value] of before) {
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        }
      }
      return { calls, outcome: outcome! };
    }

    it("skips escalation entirely when both tiers are the same model", async () => {
      // This is DeepSeek as shipped: one vision model, so the second look has
      // nowhere to go and silently never happens.
      const { calls, outcome } = await run(DEEPSEEK);
      expect(calls).toEqual(["deepseek"]);
      expect(outcome.tier).toBe("triage");
      expect(outcome.attempts).toHaveLength(1);
    });

    it("escalates to the named provider, and records which model answered", async () => {
      const { calls, outcome } = await run({
        ...DEEPSEEK,
        ...ANTHROPIC,
        AI_ESCALATION_PROVIDER: "anthropic",
      });
      expect(calls).toEqual(["deepseek", "anthropic"]);
      expect(outcome.tier).toBe("escalation");
      expect(outcome.attempts.map((attempt) => attempt.provider)).toEqual(["deepseek", "anthropic"]);
      expect(outcome.attempts[1].model).toBe("claude-sonnet-4-5");
      // The escalation's own answer is the one kept. parseEnvelope normalises
      // the payload on the way through, so this checks the answer rather than
      // the object identity.
      expect(outcome.envelope?.observations[0].confidence).toBe(0.9);
      expect(outcome.attempts[0].envelope?.observations[0].confidence).toBe(0.3);
    });
  });
});
