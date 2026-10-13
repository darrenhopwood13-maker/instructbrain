import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { defaultResultView } from "@/lib/report/grouping";

/**
 * The exact published PDF of a report, handed back to the browser as base64 so the
 * person looking at the report can save the same file their client receives.
 *
 * ONE SOURCE: an issued report is served from its frozen issued copy, so the file
 * downloaded here is byte-identical to the one the email and the share link carry.
 * A draft is still built live from what is on screen, and is named as a draft.
 *
 * ONE GROUPING RULE: the document never follows whichever tab happens to be open.
 * It is always grouped the way the report itself opens, so the same report cannot
 * produce two different documents depending on where it was clicked from.
 */
export const downloadReportPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = (input ?? {}) as Record<string, unknown>;
    const reportId = typeof value["reportId"] === "string" ? value["reportId"].trim() : "";
    if (!reportId) throw new Error("A report id is required.");
    return { reportId };
  })
  .handler(async ({ data, context }): Promise<{ filename: string; content: string }> => {
    const { buildIssuedPdfBytes, toBase64 } = await import("@/lib/report/pdf-attachment.server");

    // Issued reports come back frozen, exactly as they were sent. No view is passed, so
    // the builder falls back to the report's own grouping.
    try {
      const issued = await buildIssuedPdfBytes(context.supabase as never, data.reportId, {
        variant: "full",
      });
      if (issued) return { filename: issued.filename, content: toBase64(issued.bytes) };
    } catch {
      // Not issued yet - fall through and build the draft below.
    }

    const { loadReportDocument } = await import("@/lib/report/document.server");
    const { buildReportPdf } = await import("@/lib/report/pdf.server");
    const { documentForOutput } = await import("@/lib/i18n/report-translation.server");

    const loaded = await loadReportDocument(context.supabase as never, data.reportId);
    if (!loaded) throw new Error("That report could not be read.");
    const document = await documentForOutput(context.supabase, loaded);

    const built = await buildReportPdf(document, {
      variant: "full",
      view: defaultResultView(document.snapshot, document.tradeEnabled ?? true),
    });
    return { filename: built.filename, content: toBase64(built.bytes) };
  });
