import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { PlanUsage } from "@/lib/plans";

/**
 * Allowance is shown as a number and a sentence, never colour alone.
 * Unlimited plans get the plan name — a meter with no ceiling is noise.
 */
export function PlanUsageMeter({
  usage,
  className,
}: {
  usage: PlanUsage;
  className?: string;
}) {
  if (usage.loading) return null;

  if (usage.unlimited) {
    return (
      <div
        className={`rounded-xl border border-border bg-surface-raised p-4 ${className ?? ""}`}
      >
        <p className="eyebrow">Plan</p>
        <p className="mt-1 text-sm font-semibold">{usage.planLabel} — unlimited reports</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {usage.used} report{usage.used === 1 ? "" : "s"} created this month.
        </p>
      </div>
    );
  }

  const allowance = usage.allowance ?? 0;
  const pct = allowance === 0 ? 100 : Math.min(100, Math.round((usage.used / allowance) * 100));

  return (
    <div className={`rounded-xl border border-border bg-surface-raised p-4 ${className ?? ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow">{usage.planLabel} plan</p>
          <p className="mt-1 text-sm font-semibold tabular-nums">
            {usage.used} of {allowance} reports used this month
          </p>
        </div>
        <Button variant="quiet" size="sm" asChild>
          <Link to="/upgrade">See plans</Link>
        </Button>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={allowance}
        aria-valuenow={usage.used}
        aria-label={`${usage.used} of ${allowance} reports used this month`}
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <span
          aria-hidden="true"
          className={`block h-full rounded-full ${usage.exhausted ? "bg-fail" : "bg-brand-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {usage.exhausted
          ? `No reports left this month. Your allowance resets on ${usage.resetDate}.`
          : usage.lastOne
            ? `One report left this month — it resets on ${usage.resetDate}.`
            : `Resets on ${usage.resetDate}.`}
      </p>
    </div>
  );
}
