import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanent deletions. Verified against the caller's org role through the
 * authenticated client (RLS applies); the privileged admin client performs
 * the ordered delete and storage cleanup after verification.
 */

async function assertAdmin(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  orgId: string,
) {
  const { data } = await supabase.rpc("has_org_role", {
    _org: orgId,
    _roles: ["owner", "admin"],
  });
  if (data !== true) {
    throw new Error("Only owners and admins can delete projects or reports.");
  }
}

export const deleteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ reportId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { reportId } = data;
    const { data: report, error } = await context.supabase
      .from("reports")
      .select("id, organisation_id")
      .eq("id", reportId)
      .single();
    if (error || !report) throw new Error("Report not found.");
    await assertAdmin(context.supabase, report.organisation_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Detach rows whose FK does not cascade.
    await supabaseAdmin.from("compliance_runs").update({ report_id: null }).eq("report_id", reportId);
    await supabaseAdmin.from("ai_usage_events").update({ report_id: null }).eq("report_id", reportId);

    // Remove stored photographs (originals, thumbnails, analysis derivatives).
    const { data: photos } = await supabaseAdmin
      .from("photos")
      .select("storage_path, thumbnail_path, blurred_path, analysis_path")
      .eq("report_id", reportId);
    const paths = (photos ?? [])
      .flatMap((p) => [p.storage_path, p.thumbnail_path, p.blurred_path, p.analysis_path])
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    if (paths.length > 0) {
      await supabaseAdmin.storage.from("report-photos").remove(paths);
    }

    const { error: delError } = await supabaseAdmin.from("reports").delete().eq("id", reportId);
    if (delError) throw new Error(delError.message);
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ projectId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { projectId } = data;
    const { data: project, error } = await context.supabase
      .from("projects")
      .select("id, organisation_id")
      .eq("id", projectId)
      .single();
    if (error || !project) throw new Error("Project not found.");
    await assertAdmin(context.supabase, project.organisation_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Delete each report (with photos) so nothing is left behind.
    const { data: reports } = await supabaseAdmin
      .from("reports")
      .select("id")
      .eq("project_id", projectId);
    for (const report of reports ?? []) {
      await supabaseAdmin
        .from("compliance_runs")
        .update({ report_id: null })
        .eq("report_id", report.id);
      await supabaseAdmin
        .from("ai_usage_events")
        .update({ report_id: null })
        .eq("report_id", report.id);
      const { data: photos } = await supabaseAdmin
        .from("photos")
        .select("storage_path, thumbnail_path, blurred_path, analysis_path")
        .eq("report_id", report.id);
      const paths = (photos ?? [])
        .flatMap((p) => [p.storage_path, p.thumbnail_path, p.blurred_path, p.analysis_path])
        .filter((p): p is string => typeof p === "string" && p.length > 0);
      if (paths.length > 0) {
        await supabaseAdmin.storage.from("report-photos").remove(paths);
      }
      const { error: delError } = await supabaseAdmin.from("reports").delete().eq("id", report.id);
      if (delError) throw new Error(delError.message);
    }

    const { error: delError } = await supabaseAdmin.from("projects").delete().eq("id", projectId);
    if (delError) throw new Error(delError.message);
    return { ok: true };
  });
