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

export type ProviderId = "deepseek" | "anthropic" | "openai" | "google";
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
  /**
   * Whether a tier may reason before it answers. Honoured by the DeepSeek
   * adapter, which is the only provider wired here that exposes a switch for
   * it; a provider without one ignores the field rather than guessing. Off by
   * default — the measurement behind that is in resolveThinking below.
   */
  thinking: Record<AnalysisTier, boolean>;
};

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "No AI provider key is configured on the server. Add ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY or DEEPSEEK_API_KEY in project settings — nothing was assessed.",
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

/**
 * Which model names belong to which provider. Used ONLY to catch a mismatch —
 * a name that plainly belongs to somebody else. Anything not recognised is let
 * through, so a custom, aliased or gateway model name is never rejected by
 * accident. The cost of a false negative here is a confusing 400; the cost of a
 * false positive is a silently wrong model, so the test is deliberately narrow.
 */
const PROVIDER_MODEL_PREFIXES: Record<ProviderId, string[]> = {
  deepseek: ["deepseek-"],
  anthropic: ["claude-"],
  openai: ["gpt-", "o1", "o3", "o4"],
  google: ["gemini-"],
};

function belongsToAnotherProvider(model: string, provider: ProviderId): boolean {
  return (Object.keys(PROVIDER_MODEL_PREFIXES) as ProviderId[])
    .filter((id) => id !== provider)
    .some((id) => PROVIDER_MODEL_PREFIXES[id].some((prefix) => model.startsWith(prefix)));
}

/**
 * The model for a tier, resolved with the provider kept firmly in mind.
 *
 * AI_TRIAGE_MODEL and AI_ESCALATION_MODEL are shared by every provider, so a
 * value left over from a previous provider gets handed to the new one — and
 * DeepSeek simply rejects a Claude model name. Rather than let that surface as
 * a 400 on the first photograph of the first report, a name that plainly
 * belongs to another provider is discarded here and the provider's own default
 * is used, with a warning that says exactly why.
 *
 * Precedence: AI_<TIER>_MODEL_<PROVIDER>, then AI_<TIER>_MODEL, then default.
 * The provider-scoped form is the one to use in a deployment that might move.
 */
function resolveModel(provider: ProviderId, tier: AnalysisTier, fallback: string): string {
  const scopedName = `AI_${tier.toUpperCase()}_MODEL_${provider.toUpperCase()}`;
  const genericName = `AI_${tier.toUpperCase()}_MODEL`;
  const scoped = env(scopedName);
  const candidate = scoped ?? env(genericName);
  if (!candidate) return fallback;
  if (belongsToAnotherProvider(candidate, provider)) {
    console.warn(
      `[ai-config] ignoring ${scoped ? scopedName : genericName}="${candidate}" for provider "${provider}" — that model belongs to a different provider. Using "${fallback}".`,
    );
    return fallback;
  }
  return candidate;
}

/**
 * Whether a tier may reason before it answers.
 *
 * MEASURED, not assumed. The real production prompt (15,415 chars), a real
 * photograph from public/demo, deepseek-flash, two runs each:
 *
 *   thinking on    3,067 output tokens    $0.004892 / photo
 *   thinking off     478 output tokens    $0.001776 / photo
 *
 * Both runs returned a valid envelope carrying the same keys, so on this task
 * the reasoning was not buying a better answer — it was buying 2,600 tokens
 * that are billed at the output rate and then thrown away. Against the model
 * this replaced (gpt-4.1-mini, ~$0.0039 / photo) that is the difference between
 * DeepSeek costing 26% more and costing 54% less.
 *
 * So the default is OFF, and a deployment that wants it asks per tier:
 *
 *   AI_<TIER>_THINKING, then AI_THINKING, then off.
 *
 * Escalation is the tier where a second opinion is actually worth paying for,
 * so AI_ESCALATION_THINKING=true is the sensible way to spend it. Note that
 * escalation cannot currently fire at all on DeepSeek: both of its tiers
 * resolve to the same model, and analysePhotograph only escalates when the two
 * differ. See the profile in providerProfiles().
 */
function resolveThinking(tier: AnalysisTier): boolean {
  const scoped = env(`AI_${tier.toUpperCase()}_THINKING`);
  const value = scoped ?? env("AI_THINKING");
  return value === "true" || value === "1";
}

/** Order matters: the first provider with a key present is the one used. */
export function providerProfiles(): ProviderProfile[] {
  return [
    {
      // DeepSeek first, so it wins wherever a key is present.
      //
      // TWO CONSTRAINTS, both from DeepSeek's own published table:
      //
      //  1. Vision is supported on `deepseek-flash` and NOT on
      //     `deepseek-v4-pro`. This product analyses photographs, so the
      //     escalation tier — which is a second attempt at the same image —
      //     MUST also be a vision model. Pointing escalation at v4-pro would
      //     make every escalation fail on image input. Both tiers therefore
      //     sit on flash until DeepSeek ships a vision-capable pro.
      //  2. DeepSeek takes `max_tokens`, and accepts `response_format:
      //     json_object` but NOT `json_schema` (it answers json_schema with
      //     "This response_format type is unavailable now"). The adapter
      //     below handles both. Do not reuse the OpenAI adapter for this.
      id: "deepseek",
      keyEnv: "DEEPSEEK_API_KEY",
      triageModel: resolveModel("deepseek", "triage", "deepseek-flash"),
      escalationModel: resolveModel("deepseek", "escalation", "deepseek-flash"),
    },
    {
      id: "anthropic",
      keyEnv: "ANTHROPIC_API_KEY",
      triageModel: resolveModel("anthropic", "triage", "claude-3-5-haiku-latest"),
      escalationModel: resolveModel("anthropic", "escalation", "claude-sonnet-4-5"),
    },
    {
      id: "openai",
      keyEnv: "OPENAI_API_KEY",
      triageModel: resolveModel("openai", "triage", "gpt-4.1-mini"),
      escalationModel: resolveModel("openai", "escalation", "gpt-4.1"),
    },
    {
      id: "google",
      keyEnv: "GOOGLE_API_KEY",
      triageModel: resolveModel("google", "triage", "gemini-2.5-flash"),
      escalationModel: resolveModel("google", "escalation", "gemini-2.5-pro"),
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
    thinking: { triage: resolveThinking("triage"), escalation: resolveThinking("escalation") },
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
  // DeepSeek bills by time of day: off-peak is exactly half of peak, and peak
  // is 01:00-04:00 and 06:00-10:00 UTC, Monday to Friday. A flat rate has to
  // choose one, and the thing being protected here is the monthly spend cap, so
  // these are the PEAK, cache-miss rates — an off-peak job then costs less than
  // recorded rather than more, and the cap cannot be blown by an underestimate.
  // Source: api-docs.deepseek.com/quick_start/pricing, read 3 Oct 2026.
  // Override per deployment with AI_PRICE_<MODEL> if a different basis is wanted.
  "deepseek-flash": { inputPerMillion: 0.3, outputPerMillion: 1.2 },
  "deepseek-v4-pro": { inputPerMillion: 1.32, outputPerMillion: 3.96 },
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

/** Trade suggestions at or above this confidence can be confirmed in one press. */
export const BULK_TRADE_CONFIRM_THRESHOLD = 0.8;
