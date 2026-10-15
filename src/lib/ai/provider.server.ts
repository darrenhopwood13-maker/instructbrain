/**
 * Tiered analysis of one photograph, with retry and backoff.
 *
 * TRIAGE runs over everything. ESCALATION re-runs anything uncertain,
 * abstained, or resolving to a fail-tone status — a false negative on a defect
 * costs far more than the extra tokens.
 */
import { adapters, AiProviderError, type AdapterResponse } from "@/lib/ai/adapters.server";
import {
  aiConfig,
  escalationTarget,
  estimateCostUsd,
  type AiConfig,
  type AnalysisTier,
} from "@/lib/ai/config";
import {
  needsEscalation,
  parseEnvelope,
  SchemaValidationError,
  type BriefFindingsRule,
  type Envelope,
} from "@/lib/ai/observation";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";
import { escalationSkippedBecauseAuth, noteEscalationAuthFailure } from "@/lib/ai/escalation-guard";

export { AiProviderError };

export type TierAttempt = {
  tier: AnalysisTier;
  model: string;
  provider: string;
  usage: { inputTokens: number; outputTokens: number };
  costUsd: number;
  raw: unknown;
  envelope: Envelope | null;
  error: string | null;
};

export type AnalysisOutcome = {
  /** The envelope that will be written, or null when nothing usable came back. */
  envelope: Envelope | null;
  /** Why nothing usable came back. Becomes a `not_assessed` finding. */
  failure: string | null;
  attempts: TierAttempt[];
  tier: AnalysisTier;
  totalCostUsd: number;
  totalTokens: { inputTokens: number; outputTokens: number };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type AnalyseInput = {
  snapshot: SurveyTypeSnapshot;
  systemPrompt: string;
  userPrompt: string;
  imageUrl: string;
  /** Whether the report's brief tightens output to one finding per photograph. */
  findingsRule?: BriefFindingsRule;
};

/** Exponential backoff with jitter, applied only to 429, 5xx and network faults. */
async function callTier(
  input: AnalyseInput,
  tier: AnalysisTier,
  config: AiConfig,
): Promise<TierAttempt> {
  const model = config.models[tier];
  const adapter = adapters[config.provider];
  const attempt: TierAttempt = {
    tier,
    model,
    provider: config.provider,
    usage: { inputTokens: 0, outputTokens: 0 },
    costUsd: 0,
    raw: null,
    envelope: null,
    error: null,
  };

  let lastError: unknown = null;

  for (let index = 0; index <= config.maxRetries; index += 1) {
    try {
      const response: AdapterResponse = await adapter({ ...input, model, tier, config });
      attempt.raw = response.raw;
      attempt.usage = response.usage;
      attempt.costUsd = estimateCostUsd(model, response.usage);
      attempt.envelope = parseEnvelope(response.payload);
      return attempt;
    } catch (error) {
      lastError = error;
      if (error instanceof SchemaValidationError) break;
      const retryable = error instanceof AiProviderError && error.retryable;
      if (!retryable || index === config.maxRetries) break;
      await sleep(config.baseRetryDelayMs * 2 ** index + Math.random() * 250);
    }
  }

  attempt.error =
    lastError instanceof Error ? lastError.message : "the AI call failed for an unknown reason.";
  return attempt;
}

/**
 * Runs triage, then escalation where warranted. Never throws for a provider
 * fault: the caller turns `failure` into a `not_assessed` finding.
 */
export async function analysePhotograph(
  input: AnalyseInput,
  config: AiConfig = aiConfig(),
): Promise<AnalysisOutcome> {
  const attempts: TierAttempt[] = [];

  const triage = await callTier(input, "triage", config);
  attempts.push(triage);

  // Escalation is optional and may live on another provider entirely — see
  // escalationTarget. The derived config differs from the triage config in
  // which provider answers, which model it is asked for, and whether that
  // second pass may reason — so the adapter, the key and the price all follow
  // from it.
  const target = escalationTarget();
  const escalationConfig: AiConfig | null = target
    ? {
        ...config,
        provider: target.provider,
        apiKey: target.apiKey,
        models: { ...config.models, escalation: target.model },
        thinking: {
          ...config.thinking,
          escalation: target.thinking ?? config.thinking.escalation,
        },
      }
    : null;

  const escalationModel = escalationConfig?.models.escalation ?? config.models.escalation;
  const escalationProvider = escalationConfig?.provider ?? config.provider;
  const escalationThinking = escalationConfig?.thinking.escalation ?? config.thinking.escalation;
  // Escalating to the same provider, on the same model, asked the same way, is
  // paying twice for one opinion and is skipped. On a provider with one vision
  // model the way out is a reasoning second pass, which differs by config
  // rather than by model name — hence the third test.
  const escalationDiffers =
    escalationProvider !== config.provider ||
    escalationModel !== config.models.triage ||
    escalationThinking !== config.thinking.triage;

  let chosen = triage;
  if (
    config.escalationEnabled &&
    !escalationSkippedBecauseAuth() &&
    escalationDiffers &&
    (triage.envelope === null ||
      needsEscalation(
        triage.envelope,
        input.snapshot,
        config.confidenceThreshold,
        input.findingsRule,
      ))
  ) {
    const escalation = await callTier(input, "escalation", escalationConfig ?? config);
    attempts.push(escalation);
    // One rejection is enough to know the second opinion is unavailable. Without this
    // the run pays a round trip per escalated photograph to learn the same thing.
    noteEscalationAuthFailure(escalation.error);
    if (escalation.envelope !== null) chosen = escalation;
  }

  const totalTokens = attempts.reduce(
    (total, attempt) => ({
      inputTokens: total.inputTokens + attempt.usage.inputTokens,
      outputTokens: total.outputTokens + attempt.usage.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );

  return {
    envelope: chosen.envelope,
    failure: chosen.envelope === null ? (chosen.error ?? "the AI call failed.") : null,
    attempts,
    tier: chosen.tier,
    totalCostUsd: attempts.reduce((total, attempt) => total + attempt.costUsd, 0),
    totalTokens,
  };
}

/** Bounded concurrency. Order of results matches order of inputs. */
export async function mapWithConcurrency<TIn, TOut>(
  items: TIn[],
  limit: number,
  worker: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  const results = new Array<TOut>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index] as TIn, index);
    }
  });

  await Promise.all(runners);
  return results;
}
