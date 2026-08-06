/**
 * Every model identifier and tuning value lives here. No other module names a
 * model, a provider or a threshold — swapping provider is a config change.
 *
 * Nothing in this file is secret; keys are read server-side only, inside the
 * provider adapter.
 */

export type AiConfig = {
  /** Provider adapter to use. Adding one is a new case in provider.server.ts. */
  provider: "openai";
  /** Vision model identifier. Never hardcoded at a call site. */
  visionModel: string;
  /** Below this, the observation is not trusted and becomes `not_assessed`. */
  confidenceThreshold: number;
  /** Same rule, applied separately to a trade attribution. */
  tradeConfidenceThreshold: number;
  /** Concurrent image analyses in flight. */
  concurrency: number;
  /** Retries on 429 / 5xx, exponential with jitter. */
  maxRetries: number;
  baseRetryDelayMs: number;
  /** A multi-observation array needs room. */
  maxOutputTokens: number;
};

function envNumber(name: string, fallback: number): number {
  const raw = typeof process !== "undefined" ? process.env?.[name] : undefined;
  const value = raw === undefined ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function envString(name: string, fallback: string): string {
  const raw = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return raw && raw.trim() !== "" ? raw.trim() : fallback;
}

export function aiConfig(): AiConfig {
  return {
    provider: "openai",
    visionModel: envString("AI_VISION_MODEL", "gpt-4.1"),
    confidenceThreshold: envNumber("AI_CONFIDENCE_THRESHOLD", 0.6),
    tradeConfidenceThreshold: envNumber("AI_TRADE_CONFIDENCE_THRESHOLD", 0.6),
    concurrency: Math.min(6, Math.max(1, envNumber("AI_CONCURRENCY", 5))),
    maxRetries: 4,
    baseRetryDelayMs: 800,
    maxOutputTokens: 4096,
  };
}
