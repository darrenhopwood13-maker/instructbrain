import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The weekly compliance pack, handed back to the browser as base64 so the
 * person on site can save the exact file the client receives. Nothing sends
 * automatically — this is a person pressing a button.
 */
export const downloadCompliancePack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = (input ?? {}) as Record<string, unknown>;
    const projectId = typeof value["projectId"] === "string" ? value["projectId"].trim() : "";
    const checkType = typeof value["checkType"] === "string" ? value["checkType"].trim() : "";
    const runId = typeof value["runId"] === "string" && value["runId"].trim() ? value["runId"].trim() : null;
    if (!projectId) throw new Error("A project is required.");
    if (!checkType) throw new Error("A check type is required.");
    return { projectId, checkType, runId };
  })
  .handler(async ({ data, context }): Promise<{ filename: string; content: string }> => {
    const { buildCompliancePack, loadPackData } = await import("@/lib/compliance/pack.server");
    const { toBase64 } = await import("@/lib/report/pdf-attachment.server");

    const loaded = await loadPackData(context.supabase as never, data);
    if (loaded.runs.length === 0) {
      throw new Error("There are no weekly checks recorded for this site yet.");
    }
    const built = await buildCompliancePack(loaded, {
      checkType: data.checkType,
      single: !!data.runId,
    });
    return { filename: built.filename, content: toBase64(built.bytes) };
  });
