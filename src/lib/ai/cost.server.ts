/**
 * Per-organisation AI spend. A hard cap with a clear message — never a silent
 * failure, and never a silent overspend.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_MONTHLY_COST_CAP_USD } from "@/lib/ai/config";

type AnyClient = SupabaseClient<any, any, any>;

function table(client: AnyClient, name: string) {
  return client.from(name as never) as any;
}

export class AiBudgetExceededError extends Error {
  readonly spentUsd: number;
  readonly capUsd: number;
  constructor(spentUsd: number, capUsd: number) {
    super(
      `This organisation has reached its monthly AI cap of $${capUsd.toFixed(2)} (spent $${spentUsd.toFixed(2)}). Nothing was assessed. An owner or admin can raise the cap in organisation settings.`,
    );
    this.name = "AiBudgetExceededError";
    this.spentUsd = spentUsd;
    this.capUsd = capUsd;
  }
}

export type UsageSummary = {
  organisationId: string;
  periodStart: string;
  spentUsd: number;
  capUsd: number;
  inputTokens: number;
  outputTokens: number;
  assessments: number;
  cachedAssessments: number;
  remainingUsd: number;
  exhausted: boolean;
};

export function startOfMonthIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function usageSummary(
  client: AnyClient,
  organisationId: string,
): Promise<UsageSummary> {
  const periodStart = startOfMonthIso();

  const { data: organisation } = await table(client, "organisations")
    .select("ai_monthly_cost_cap")
    .eq("id", organisationId)
    .maybeSingle();

  const rawCap = Number(organisation?.ai_monthly_cost_cap);
  const capUsd = Number.isFinite(rawCap) && rawCap >= 0 ? rawCap : DEFAULT_MONTHLY_COST_CAP_USD;

  const { data, error } = await table(client, "ai_usage_events")
    .select("cost_usd, input_tokens, output_tokens, cached")
    .eq("organisation_id", organisationId)
    .gte("created_at", periodStart);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    cost_usd: number | string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    cached: boolean | null;
  }>;

  const spentUsd = rows.reduce((total, row) => total + Number(row.cost_usd ?? 0), 0);

  return {
    organisationId,
    periodStart,
    spentUsd: Math.round(spentUsd * 10_000) / 10_000,
    capUsd,
    inputTokens: rows.reduce((total, row) => total + (row.input_tokens ?? 0), 0),
    outputTokens: rows.reduce((total, row) => total + (row.output_tokens ?? 0), 0),
    assessments: rows.length,
    cachedAssessments: rows.filter((row) => row.cached === true).length,
    remainingUsd: Math.max(0, capUsd - spentUsd),
    exhausted: spentUsd >= capUsd,
  };
}

/** Throws before a single token is spent when the cap is already reached. */
export async function assertWithinBudget(
  client: AnyClient,
  organisationId: string,
): Promise<UsageSummary> {
  const summary = await usageSummary(client, organisationId);
  if (summary.exhausted) throw new AiBudgetExceededError(summary.spentUsd, summary.capUsd);
  return summary;
}

export type UsageEvent = {
  organisationId: string;
  reportId: string | null;
  photoId: string | null;
  tier: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  cached: boolean;
  outcome: string;
};

/** Tokens and cost are logged per photograph, and therefore per report. */
export async function logUsage(client: AnyClient, event: UsageEvent): Promise<void> {
  await table(client, "ai_usage_events").insert({
    organisation_id: event.organisationId,
    report_id: event.reportId,
    photo_id: event.photoId,
    tier: event.tier,
    provider: event.provider,
    model: event.model,
    input_tokens: event.inputTokens,
    output_tokens: event.outputTokens,
    cost_usd: event.costUsd,
    cached: event.cached,
    outcome: event.outcome,
  });
}
