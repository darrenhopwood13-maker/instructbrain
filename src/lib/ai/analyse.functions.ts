import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AnalyseSummary } from "@/lib/ai/analyse.server";

type AnalyseInput = { reportId: string; photoIds?: string[] };

function validate(input: unknown): AnalyseInput {
  const value = (input ?? {}) as Record<string, unknown>;
  const reportId = typeof value["reportId"] === "string" ? value["reportId"].trim() : "";
  if (reportId === "") throw new Error("A report id is required.");
  const photoIds = Array.isArray(value["photoIds"])
    ? value["photoIds"].filter((id): id is string => typeof id === "string")
    : undefined;
  return photoIds && photoIds.length > 0 ? { reportId, photoIds } : { reportId };
}

/** Drafts findings for a report's photographs. All AI work happens here, server-side. */
export const draftFindings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<AnalyseSummary> => {
    const { analyseReportPhotos } = await import("@/lib/ai/analyse.server");
    return analyseReportPhotos(context.supabase as never, data);
  });
