import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SynthesisResult } from "@/lib/ai/synthesis.server";

/** The synthesis pass runs server-side only; no key ever reaches the browser. */
export const synthesiseReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const id = (input as Record<string, unknown>)?.["reportId"];
    if (typeof id !== "string" || id.trim() === "") throw new Error("A report id is required.");
    return { reportId: id.trim() };
  })
  .handler(async ({ data, context }): Promise<SynthesisResult> => {
    const { synthesiseForReport } = await import("@/lib/report/synthesis-run.server");
    return synthesiseForReport(context.supabase as never, data.reportId);
  });
