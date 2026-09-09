import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { safeResultView } from "@/lib/report/grouping";

/**
 * The same PDF the emails carry, handed back to the browser as base64 so the
 * person looking at the report can save the exact file their client receives.
 */
export const downloadReportPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = (input ?? {}) as Record<string, unknown>;
    const reportId = typeof value["reportId"] === "string" ? value["reportId"].trim() : "";
    if (!reportId) throw new Error("A report id is required.");
    return { reportId, view: safeResultView(value["view"]) };
  })
  .handler(async ({ data, context }): Promise<{ filename: string; content: string }> => {
    const { loadReportDocument } = await import("@/lib/report/document.server");
    const { buildReportPdf } = await import("@/lib/report/pdf.server");
    const { toBase64 } = await import("@/lib/report/pdf-attachment.server");

    const { documentForOutput } = await import("@/lib/i18n/report-translation.server");
    const loaded = await loadReportDocument(context.supabase as never, data.reportId);
    if (!loaded) throw new Error("That report could not be read.");
    const document = await documentForOutput(context.supabase, loaded);

    const built = await buildReportPdf(document, { variant: "full", view: data.view });
    return { filename: built.filename, content: toBase64(built.bytes) };
  });
