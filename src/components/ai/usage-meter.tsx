import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Gauge } from "lucide-react";
import { aiUsage } from "@/lib/ai/analyse.functions";

/**
 * Monthly AI spend for the organisation. A cap is a hard stop with a clear
 * message — never a silent failure.
 */
export function AiUsageMeter({ organisationId }: { organisationId: string | null }) {
  const load = useServerFn(aiUsage);
  const query = useQuery({
    queryKey: ["ai-usage", organisationId],
    enabled: !!organisationId,
    queryFn: () => load({ data: { organisationId: organisationId as string } }),
  });

  if (!organisationId || query.isPending) return null;

  if (query.isError) {
    return (
      <p className="text-sm text-muted-foreground">
        AI usage for this month could not be read: {(query.error as Error).message}
      </p>
    );
  }

  const usage = query.data;
  if (!usage) return null;

  const percent = usage.capUsd > 0 ? Math.min(100, (usage.spentUsd / usage.capUsd) * 100) : 100;
  const tokens = usage.inputTokens + usage.outputTokens;

  return (
    <section
      aria-label="AI usage this month"
      className="rounded-xl border border-border bg-surface-raised p-4 shadow-raised"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow flex items-center gap-1.5">
          <Gauge aria-hidden="true" className="size-3.5" />
          AI usage this month
        </p>
        <p className="text-sm font-medium tabular-nums">
          ${usage.spentUsd.toFixed(2)}{" "}
          <span className="text-muted-foreground">of ${usage.capUsd.toFixed(2)}</span>
        </p>
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        aria-label={`${Math.round(percent)} per cent of the monthly AI cap used`}
      >
        <div
          className={usage.exhausted ? "h-full bg-destructive" : "h-full bg-accent"}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {usage.assessments} assessment{usage.assessments === 1 ? "" : "s"} ·{" "}
        {tokens.toLocaleString("en-GB")} tokens
        {usage.cachedAssessments > 0 ? ` · ${usage.cachedAssessments} served from cache` : ""}
      </p>

      {usage.exhausted ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Cap reached.</strong> No further photographs will be assessed this month. An
            owner or admin can raise the cap in organisation settings.
          </span>
        </p>
      ) : null}
    </section>
  );
}
