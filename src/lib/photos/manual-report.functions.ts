import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { coerceSnapshot } from "@/lib/report/snapshot";
import { isManualOnly } from "@/lib/survey-types";
import { coerceMarkup, type MarkupLayer } from "@/lib/photos/markup";

async function manualContext(supabase: any, reportId: string, photoId: string) {
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, organisation_id, survey_type_snapshot, status")
    .eq("id", reportId)
    .maybeSingle();
  if (reportError || !report) throw new Error("This report could not be found.");
  if (!isManualOnly(coerceSnapshot(report.survey_type_snapshot))) {
    throw new Error("Manual photograph editing is not enabled for this report.");
  }
  if (report.status === "issued") throw new Error("Reopen this report before editing it.");
  const { data: photo, error: photoError } = await supabase
    .from("photos")
    .select("id, sequence")
    .eq("id", photoId)
    .eq("report_id", reportId)
    .maybeSingle();
  if (photoError || !photo) throw new Error("That photograph could not be found.");
  return { report, photo };
}

async function ensureFinding(supabase: any, reportId: string, photoId: string, sequence: number) {
  const { data: existing } = await supabase
    .from("finding_photos")
    .select("finding_id, findings!inner(id, report_id, finding_text, confirmed_at)")
    .eq("photo_id", photoId)
    .eq("findings.report_id", reportId)
    .maybeSingle();
  if (existing?.findings) return existing.findings as { id: string; finding_text: string | null; confirmed_at: string | null };
  const { data: refs, error: refError } = await supabase.rpc("next_finding_ref", { _report_id: reportId });
  if (refError) throw new Error(refError.message);
  const allocated = Array.isArray(refs) ? refs[0] : refs;
  if (!allocated?.ref) throw new Error("A stable item reference could not be reserved.");
  const { data: finding, error: findingError } = await supabase
    .from("findings")
    .insert({
      report_id: reportId,
      ref: allocated.ref,
      sequence: Number(allocated.sequence ?? sequence),
      status: "recorded",
      finding_text: "",
      capture_fields: {},
      human_edited: true,
      lifecycle_state: "open",
    })
    .select("id, finding_text, confirmed_at")
    .single();
  if (findingError) throw new Error(findingError.message);
  const { error: linkError } = await supabase
    .from("finding_photos")
    .insert({ finding_id: finding.id, photo_id: photoId, role: "primary" });
  if (linkError) throw new Error(linkError.message);
  return finding as { id: string; finding_text: string | null; confirmed_at: string | null };
}

export const ensureManualPhotoItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reportId: string; photoId: string }) => input)
  .handler(async ({ data, context }) => {
    const { photo } = await manualContext(context.supabase, data.reportId, data.photoId);
    const finding = await ensureFinding(context.supabase, data.reportId, data.photoId, photo.sequence);
    return { findingId: finding.id };
  });

export const getManualPhotoEntry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reportId: string; photoId: string }) => input)
  .handler(async ({ data, context }) => {
    const { photo } = await manualContext(context.supabase, data.reportId, data.photoId);
    const finding = await ensureFinding(context.supabase, data.reportId, data.photoId, photo.sequence);
    const { data: markup } = await context.supabase
      .from("photo_markups")
      .select("layers")
      .eq("photo_id", data.photoId)
      .maybeSingle();
    return {
      description: finding.finding_text ?? "",
      layers: coerceMarkup(markup?.layers),
    };
  });

export const saveManualPhotoEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reportId: string; photoId: string; description: string; layers: MarkupLayer[] }) => input)
  .handler(async ({ data, context }) => {
    const { report, photo } = await manualContext(context.supabase, data.reportId, data.photoId);
    const finding = await ensureFinding(context.supabase, data.reportId, data.photoId, photo.sequence);
    const description = data.description.trim().slice(0, 4000);
    const layers = coerceMarkup(data.layers);
    const now = new Date().toISOString();
    const { error: findingError } = await context.supabase
      .from("findings")
      .update({ finding_text: description, status: "recorded", human_edited: true, confirmed_at: description ? now : null, confirmed_by: description ? context.userId : null })
      .eq("id", finding.id);
    if (findingError) throw new Error(findingError.message);
    const { error: markupError } = await context.supabase
      .from("photo_markups")
      .upsert({ organisation_id: report.organisation_id, report_id: data.reportId, photo_id: data.photoId, layers, created_by: context.userId }, { onConflict: "photo_id" });
    if (markupError) throw new Error(markupError.message);
    return { ok: true };
  });