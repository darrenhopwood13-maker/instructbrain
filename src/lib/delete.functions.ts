import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Permanent deletions. Verified against the caller's org role through the
 * authenticated client (RLS applies); the privileged admin client performs
 * the ordered delete and storage cleanup after verification.
 */

async function isPlatformAdmin(supabase: SupabaseClient<Database>): Promise<boolean> {
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
}

/** Normal users may delete only what they created; the platform admin may delete anything. */
async function assertCanDeleteRow(
  supabase: SupabaseClient<Database>,
  userId: string,
  table: "reports" | "projects",
  id: string,
) {
  if (await isPlatformAdmin(supabase)) return;
  const column = table === "reports" ? "author_id" : "created_by";
  const { data } = await (supabase.from(table) as any).select(column).eq("id", id).maybeSingle();
  if (!data || data[column] !== userId) {
    throw new Error(
      table === "reports"
        ? "You can only delete reports you created."
        : "You can only delete projects you created.",
    );
  }
}

async function assertAdmin(supabase: SupabaseClient<Database>, orgId: string) {
  if (await isPlatformAdmin(supabase)) return;
  const { data } = await supabase.rpc("has_org_role", {
    _org: orgId,
    _roles: ["owner", "admin"],
  });
  if (data !== true) throw new Error("Only owners and admins can do this.");
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
    await assertCanDeleteRow(context.supabase, context.userId, "reports", reportId);

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
    await assertCanDeleteRow(context.supabase, context.userId, "projects", projectId);

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

/**
 * Archive a locked compliance register. One-way: the register stays as
 * evidence (archived_at set) but can no longer block deletion flows.
 */
export const archiveComplianceRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ runId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { runId } = data;
    const { data: run, error } = await context.supabase
      .from("compliance_runs")
      .select("id, organisation_id")
      .eq("id", runId)
      .single();
    if (error || !run) throw new Error("Register not found.");
    await assertAdmin(context.supabase, run.organisation_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: archErr } = await supabaseAdmin
      .from("compliance_runs")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", runId);
    if (archErr) throw new Error(archErr.message);
    return { ok: true };
  });

/** Delete the stored photographs for a report (originals, thumbnails, derivatives). */
type AdminClient = typeof import("@/integrations/supabase/client.server").supabaseAdmin;
async function removeReportPhotos(supabaseAdmin: AdminClient, reportId: string) {
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
}

/** Archive any locked runs attached to a report so its deletion can proceed. */
async function archiveLockedRunsForReport(supabaseAdmin: AdminClient, reportId: string) {
  await supabaseAdmin
    .from("compliance_runs")
    .update({ archived_at: new Date().toISOString() })
    .eq("report_id", reportId)
    .not("locked_at", "is", null);
}

/**
 * Delete several reports in one go. Completed registers attached to any of
 * them are archived (not lost) so the deletion can complete.
 */
export const bulkDeleteReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ reportIds: z.array(z.string().uuid()).min(1).max(200) }).parse(data))
  .handler(async ({ context, data }) => {
    const { reportIds } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: reports, error: rErr } = await context.supabase
      .from("reports")
      .select("id, organisation_id")
      .in("id", reportIds);
    if (rErr) throw new Error(rErr.message);
    if (!reports || reports.length !== reportIds.length) {
      throw new Error("One or more reports could not be found.");
    }

    for (const report of reports) {
      await assertCanDeleteRow(context.supabase, context.userId, "reports", report.id);
    }

    for (const report of reports) {
      await archiveLockedRunsForReport(supabaseAdmin, report.id);
      await removeReportPhotos(supabaseAdmin, report.id);
      const { error } = await supabaseAdmin.from("reports").delete().eq("id", report.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true, deleted: reports.length };
  });

/**
 * Permanently delete an organisation and everything beneath it: projects,
 * reports, photographs (including stored files), compliance registers
 * (locked ones are archived first — evidence is not silently destroyed),
 * directory, audit and membership rows. Owner only, irreversible.
 */
export const deleteOrganisation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ organisationId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { organisationId } = data;
    if (!(await isPlatformAdmin(context.supabase))) {
      throw new Error("Only the platform administrator can delete an organisation.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Stored photographs for every report in the organisation.
    const { data: reports } = await supabaseAdmin
      .from("reports")
      .select("id")
      .eq("organisation_id", organisationId);
    const reportIds = (reports ?? []).map((r) => r.id);
    for (const reportId of reportIds) {
      await removeReportPhotos(supabaseAdmin, reportId);
    }

    // 2. Archive locked registers so the cascade below can finish.
    await supabaseAdmin
      .from("compliance_runs")
      .update({ archived_at: new Date().toISOString() })
      .eq("organisation_id", organisationId)
      .not("locked_at", "is", null);

    // 3. Remove the registers explicitly (entries cascade; archived runs may
    //    now be deleted).
    await supabaseAdmin
      .from("compliance_runs")
      .delete()
      .eq("organisation_id", organisationId);

    // 4. The organisation delete cascades projects -> reports -> findings,
    //    photos, audit, shares, directory, memberships and usage rows.
    const { error } = await supabaseAdmin
      .from("organisations")
      .delete()
      .eq("id", organisationId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

/** Counts shown in the delete-organisation confirmation. */
export const getOrganisationDeleteSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ organisationId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { organisationId } = data;
    const { data: isOwner } = await context.supabase.rpc("has_org_role", {
      _org: organisationId,
      _roles: ["owner"],
    });
    if (isOwner !== true) {
      throw new Error("Only the organisation owner can view this.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const count = async (table: "projects" | "reports" | "compliance_runs", filter: Record<string, unknown>) => {
      let q = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
      for (const [k, v] of Object.entries(filter)) q = q.eq(k as never, v as never);
      const { count: n } = await q;
      return n ?? 0;
    };
    const [projects, reports, lockedRuns] = await Promise.all([
      count("projects", { organisation_id: organisationId }),
      count("reports", { organisation_id: organisationId }),
      count("compliance_runs", { organisation_id: organisationId }),
    ]);
    return { projects, reports, lockedRuns };
  });
