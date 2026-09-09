/**
 * Every model identifier, threshold and price lives here. No other module
 * names a model, a provider, a key or a threshold — swapping provider is a
 * configuration change, never a code change.
 *
 * Two tiers:
 *  TRIAGE      fast, inexpensive vision model. First pass over every photograph.
 *  ESCALATION  stronger vision model. Re-runs anything low confidence, anything
 *              that abstained, and anything resolving to a fail-tone status.
 *              A false negative on a defect costs far more than the tokens.
 */

export type ProviderId = "anthropic" | "openai" | "google";
export type AnalysisTier = "triage" | "escalation";

export type ProviderProfile = {
  id: ProviderId;
  /** The Supabase secret that both selects and authenticates this adapter. */
  keyEnv: string;
  triageModel: string;
  escalationModel: string;
};

export type AiConfig = {
  provider: ProviderId;
  apiKey: string;
  models: Record<AnalysisTier, string>;
  /** Below this an observation is not trusted: it becomes `not_assessed`. */
  confidenceThreshold: number;
  /** Same rule, applied separately to a trade attribution. */
  tradeConfidenceThreshold: number;
  /** Concurrent analyses in flight. Capped to 4–6. */
  concurrency: number;
  maxRetries: number;
  baseRetryDelayMs: number;
  requestTimeoutMs: number;
  /** A multi-observation array needs room. */
  maxOutputTokens: number;
  escalationEnabled: boolean;
};

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "No AI provider key is configured on the server. Add ANTHROPIC_API_KEY, OPENAI_API_KEY or GOOGLE_API_KEY in project settings — nothing was assessed.",
    );
    this.name = "AiNotConfiguredError";
  }
}

function env(name: string): string | undefined {
  const raw = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return raw && raw.trim() !== "" ? raw.trim() : undefined;
}

function envNumber(name: string, fallback: number): number {
  const value = Number(env(name));
  return Number.isFinite(value) ? value : fallback;
}

/** Order matters: the first provider with a key present is the one used. */
export function providerProfiles(): ProviderProfile[] {
  return [
    {
      id: "anthropic",
      keyEnv: "ANTHROPIC_API_KEY",
      triageModel: env("AI_TRIAGE_MODEL") ?? "claude-3-5-haiku-latest",
      escalationModel: env("AI_ESCALATION_MODEL") ?? "claude-sonnet-4-5",
    },
    {
      id: "openai",
      keyEnv: "OPENAI_API_KEY",
      triageModel: env("AI_TRIAGE_MODEL") ?? "gpt-4.1-mini",
      escalationModel: env("AI_ESCALATION_MODEL") ?? "gpt-4.1",
    },
    {
      id: "google",
      keyEnv: "GOOGLE_API_KEY",
      triageModel: env("AI_TRIAGE_MODEL") ?? "gemini-2.5-flash",
      escalationModel: env("AI_ESCALATION_MODEL") ?? "gemini-2.5-pro",
    },
  ];
}

/** Which adapter is active, decided by which key is present. */
export function selectProfile(): ProviderProfile | null {
  const profiles = providerProfiles();
  const forced = env("AI_PROVIDER");
  const candidates = forced ? profiles.filter((profile) => profile.id === forced) : profiles;
  return candidates.find((profile) => env(profile.keyEnv) !== undefined) ?? null;
}

export function aiConfig(): AiConfig {
  const profile = selectProfile();
  if (!profile) throw new AiNotConfiguredError();
  const apiKey = env(profile.keyEnv);
  if (!apiKey) throw new AiNotConfiguredError();

  return {
    provider: profile.id,
    apiKey,
    models: { triage: profile.triageModel, escalation: profile.escalationModel },
    confidenceThreshold: envNumber("AI_CONFIDENCE_THRESHOLD", 0.6),
    tradeConfidenceThreshold: envNumber("AI_TRADE_CONFIDENCE_THRESHOLD", 0.6),
    // Raised from 6 to 12: parallelism is where the speed comes from. The
    // photograph handed to the model is never reduced (invariant 3).
    concurrency: Math.min(12, Math.max(4, envNumber("AI_CONCURRENCY", 12))),
    maxRetries: Math.max(0, envNumber("AI_MAX_RETRIES", 4)),
    baseRetryDelayMs: envNumber("AI_RETRY_BASE_MS", 800),
    requestTimeoutMs: envNumber("AI_REQUEST_TIMEOUT_MS", 120_000),
    maxOutputTokens: envNumber("AI_MAX_OUTPUT_TOKENS", 6000),
    escalationEnabled: env("AI_ESCALATION_DISABLED") !== "true",
  };
}

/** True when the server can analyse at all — surfaced to the UI, key never is. */
export function aiIsConfigured(): boolean {
  return selectProfile() !== null;
}

/* ------------------------------------------------------------------ */
/* Cost                                                                */
/* ------------------------------------------------------------------ */

/** USD per million tokens. Overridable per deployment; never per call site. */
export type ModelPrice = { inputPerMillion: number; outputPerMillion: number };

const PRICES: Record<string, ModelPrice> = {
  "claude-3-5-haiku-latest": { inputPerMillion: 0.8, outputPerMillion: 4 },
  "claude-sonnet-4-5": { inputPerMillion: 3, outputPerMillion: 15 },
  "gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  "gpt-4.1": { inputPerMillion: 2, outputPerMillion: 8 },
  "gemini-2.5-flash": { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  "gemini-2.5-pro": { inputPerMillion: 1.25, outputPerMillion: 10 },
};

const FALLBACK_PRICE: ModelPrice = { inputPerMillion: 3, outputPerMillion: 15 };

export function priceFor(model: string): ModelPrice {
  const override = env(`AI_PRICE_${model.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase()}`);
  if (override) {
    const [input, output] = override.split("/").map(Number);
    if (Number.isFinite(input) && Number.isFinite(output)) {
      return { inputPerMillion: input as number, outputPerMillion: output as number };
    }
  }
  return PRICES[model] ?? FALLBACK_PRICE;
}

export function estimateCostUsd(
  model: string,
  usage: { inputTokens: number; outputTokens: number },
): number {
  const price = priceFor(model);
  const cost =
    (usage.inputTokens / 1_000_000) * price.inputPerMillion +
    (usage.outputTokens / 1_000_000) * price.outputPerMillion;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Fallback cap when an organisation has none set. */
export const DEFAULT_MONTHLY_COST_CAP_USD = 25;
