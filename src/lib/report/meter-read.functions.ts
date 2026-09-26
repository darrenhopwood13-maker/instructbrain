import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MeterSuggestion } from "@/lib/report/meter-read";

/** Suggests a meter reading from a photograph. Read-only; a person accepts it. */
export const readMeterPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const record = (input ?? {}) as Record<string, unknown>;
    const reportId = typeof record["reportId"] === "string" ? record["reportId"].trim() : "";
    const photoId = typeof record["photoId"] === "string" ? record["photoId"].trim() : "";
    const meterLabel = typeof record["meterLabel"] === "string" ? record["meterLabel"].trim().slice(0, 60) : "";
    if (!reportId || !photoId) throw new Error("A report and photograph are required.");
    return { reportId, photoId, meterLabel: meterLabel || "meter" };
  })
  .handler(async ({ data, context }): Promise<MeterSuggestion> => {
    const { suggestMeterReading } = await import("@/lib/report/meter-read.server");
    return suggestMeterReading(context.supabase as never, data);
  });
