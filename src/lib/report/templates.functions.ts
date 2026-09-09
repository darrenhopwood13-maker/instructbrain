import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitiseSpecialRequest, toneById } from "@/lib/report/brief";

export type ReportTemplate = {
  id: string;
  name: string;
  presetId: string | null;
  tone: string;
  specialRequest: string;
  surveyTypeIds: string[];
  createdAt: string;
};

function toTemplate(row: Record<string, any>): ReportTemplate {
  return {
    id: row["id"] as string,
    name: row["name"] as string,
    presetId: (row["preset_id"] as string | null) ?? null,
    tone: toneById(row["tone"] as string | null).id,
    specialRequest: (row["special_request"] as string | null) ?? "",
    surveyTypeIds: Array.isArray(row["survey_type_ids"])
      ? (row["survey_type_ids"] as unknown[]).filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
    createdAt: row["created_at"] as string,
  };
}

export const listReportTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { organisationId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("report_templates")
      .select("id, name, preset_id, tone, special_request, survey_type_ids, created_at")
      .eq("organisation_id", data.organisationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Array<Record<string, any>>).map(toTemplate);
  });

export const saveReportTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      organisationId: string;
      name: string;
      presetId: string | null;
      tone: string;
      specialRequest: string;
      surveyTypeIds: string[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Give the template a name so you can find it again.");
    const { data: row, error } = await context.supabase
      .from("report_templates")
      .insert({
        organisation_id: data.organisationId,
        name,
        preset_id: data.presetId,
        tone: toneById(data.tone).id,
        special_request: sanitiseSpecialRequest(data.specialRequest) || null,
        survey_type_ids: data.surveyTypeIds,
        created_by: context.userId,
      })
      .select("id, name, preset_id, tone, special_request, survey_type_ids, created_at")
      .single();
    if (error) throw new Error(error.message);
    return toTemplate(row as Record<string, any>);
  });

export const deleteReportTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("report_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
