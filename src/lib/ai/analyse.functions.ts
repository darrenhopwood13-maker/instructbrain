import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PhotoAnalysisResult, PhotoAnalysisState } from "@/lib/ai/analyse.server";
import type { UsageSummary } from "@/lib/ai/cost.server";

/** All AI work happens behind these boundaries. No key ever reaches the browser. */

function requiredId(value: unknown, label: string): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (id === "") throw new Error(`A ${label} is required.`);
  return id;
}

export const analysisState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    reportId: requiredId((input as Record<string, unknown>)?.["reportId"], "report id"),
  }))
  .handler(async ({ data, context }): Promise<PhotoAnalysisState[]> => {
    const { photoAnalysisStates } = await import("@/lib/ai/analyse.server");
    return photoAnalysisStates(context.supabase as never, data.reportId);
  });

export const analysePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = (input ?? {}) as Record<string, unknown>;
    return {
      reportId: requiredId(value["reportId"], "report id"),
      photoId: requiredId(value["photoId"], "photograph id"),
      force: value["force"] === true,
      // Opt-in single pass: no second opinion for this call only.
      fast: value["fast"] === true,
    };
  })
  .handler(async ({ data, context }): Promise<PhotoAnalysisResult> => {
    const { analysePhotoForReport } = await import("@/lib/ai/analyse.server");
    return analysePhotoForReport(context.supabase as never, data);
  });

export const aiUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organisationId: requiredId(
      (input as Record<string, unknown>)?.["organisationId"],
      "organisation id",
    ),
  }))
  .handler(async ({ data, context }): Promise<UsageSummary> => {
    const { organisationUsage } = await import("@/lib/ai/analyse.server");
    return organisationUsage(context.supabase as never, data.organisationId);
  });

export const reportAiUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    reportId: requiredId((input as Record<string, unknown>)?.["reportId"], "report id"),
  }))
  .handler(async ({ data, context }) => {
    const { reportUsage } = await import("@/lib/ai/analyse.server");
    return reportUsage(context.supabase as never, data.reportId);
  });
