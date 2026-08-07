import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Plan allowances are DATA, not constants. The lookup lives in the database
 * (public.plan_limits) and the same numbers drive the triggers that enforce
 * them, so the UI can never disagree with the wall.
 *
 * A null allowance means UNLIMITED. Never treat it as zero.
 */
export type PlanId = "free" | "standard" | "pro" | "custom" | "internal";

export type PlanLimit = {
  plan: PlanId;
  label: string;
  price_gbp: number | null;
  report_allowance: number | null;
  photo_cap_per_report: number | null;
  sort_order: number;
};

export type OrganisationPlan = {
  plan: PlanId;
  report_allowance: number | null;
  photo_cap_per_report: number | null;
};

function table(name: string) {
  return supabase.from(name as never) as unknown as {
    select: (columns?: string, options?: Record<string, unknown>) => any;
  };
}

export const planLimitsQuery = () =>
  queryOptions({
    queryKey: ["plan-limits"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlanLimit[]> => {
      const { data, error } = await table("plan_limits")
        .select("plan, label, price_gbp, report_allowance, photo_cap_per_report, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as PlanLimit[];
    },
  });

export const organisationPlanQuery = (organisationId: string | null) =>
  queryOptions({
    queryKey: ["organisation-plan", organisationId],
    enabled: !!organisationId,
    queryFn: async (): Promise<OrganisationPlan | null> => {
      const { data, error } = await table("organisations")
        .select("plan, report_allowance, photo_cap_per_report")
        .eq("id", organisationId)
        .limit(1);
      if (error) throw new Error(error.message);
      return ((data ?? [])[0] ?? null) as OrganisationPlan | null;
    },
  });

/** Calendar month in UTC — the same window the database trigger counts. */
export function monthWindowUtc(now: Date = new Date()): { start: Date; nextStart: Date } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const nextStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return { start, nextStart };
}

export function resetDateLabel(now: Date = new Date()): string {
  const { nextStart } = monthWindowUtc(now);
  return nextStart.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * Reports CREATED this month, counted from the immutable creation ledger.
 * Deleting a report does not hand the allowance back.
 */
export const reportUsageQuery = (organisationId: string | null) =>
  queryOptions({
    queryKey: ["report-usage", organisationId],
    enabled: !!organisationId,
    queryFn: async (): Promise<number> => {
      const { start, nextStart } = monthWindowUtc();
      const { count, error } = await table("report_creation_events")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .gte("created_at", start.toISOString())
        .lt("created_at", nextStart.toISOString());
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });

export type PlanUsage = {
  loading: boolean;
  plan: PlanId;
  planLabel: string;
  unlimited: boolean;
  allowance: number | null;
  photoCap: number | null;
  used: number;
  remaining: number | null;
  exhausted: boolean;
  lastOne: boolean;
  resetDate: string;
};

export function usePlanUsage(organisationId: string | null): PlanUsage {
  const plan = useQuery(organisationPlanQuery(organisationId));
  const limits = useQuery(planLimitsQuery());
  const usage = useQuery(reportUsageQuery(organisationId));

  const planId = (plan.data?.plan ?? "free") as PlanId;
  const label = limits.data?.find((item) => item.plan === planId)?.label ?? planId;
  const allowance = plan.data ? plan.data.report_allowance : null;
  const unlimited = allowance === null || allowance === undefined;
  const used = usage.data ?? 0;
  const remaining = unlimited ? null : Math.max(0, (allowance ?? 0) - used);

  return {
    loading: plan.isPending || usage.isPending,
    plan: planId,
    planLabel: label,
    unlimited,
    allowance: unlimited ? null : (allowance ?? null),
    photoCap: plan.data?.photo_cap_per_report ?? null,
    used,
    remaining,
    exhausted: !unlimited && !plan.isPending && !usage.isPending && (remaining ?? 0) <= 0,
    lastOne: !unlimited && remaining === 1,
    resetDate: resetDateLabel(),
  };
}

/**
 * Trigger exceptions arrive as raw Postgres strings. Nobody on a roof should
 * read "new row violates ...", so known limits get a plain sentence.
 */
export function humanisePlanError(message: string): string {
  const text = message ?? "";
  const report = /Report allowance reached for this month\. Your plan includes (\d+) reports?\./.exec(
    text,
  );
  if (report) {
    return `You have used all ${report[1]} reports included in your plan this month. The allowance resets on ${resetDateLabel()}. Upgrade to carry on now.`;
  }
  const photo = /Photo limit reached for this report\. Your plan includes (\d+) photos? per report\./.exec(
    text,
  );
  if (photo) {
    return `This report already holds the ${photo[1]} photographs your plan allows. Upgrade, or start another report for the rest of the walk.`;
  }
  return text;
}
