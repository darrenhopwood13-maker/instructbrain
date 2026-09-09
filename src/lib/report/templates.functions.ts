import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reportTypeById, sanitiseSpecialRequest, toneById } from "@/lib/report/brief";

const COLUMNS =
  "id, name, preset_id, tone, special_request, survey_type_ids, report_type, include_fix, include_severity, advisory_footer, created_at";

export type ReportTemplate = {
  id: string;
  name: string;
  presetId: string | null;
  tone: string;
  reportType: string;
  includeFix: boolean;
  includeSeverity: boolean;
  advisoryFooter: boolean;
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
    reportType: reportTypeById(row["report_type"] as string | null),
    includeFix: row["include_fix"] !== false,
    includeSeverity: row["include_severity"] !== false,
    advisoryFooter: row["advisory_footer"] === true,
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
      .select(COLUMNS)
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
      reportType: string;
      includeFix: boolean;
      includeSeverity: boolean;
      advisoryFooter: boolean;
      specialRequest: string;
      surveyTypeIds: string[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const name = data.name.trim();
    if (!name) throw new Error("Give the template a name so you can find it again.");
    const reportType = reportTypeById(data.reportType);
    const { data: row, error } = await context.supabase
      .from("report_templates")
      .insert({
        organisation_id: data.organisationId,
        name,
        preset_id: data.presetId,
        tone: toneById(data.tone).id,
        report_type: reportType,
        include_fix: reportType === "identifier" ? false : data.includeFix,
        include_severity: reportType === "identifier" ? false : data.includeSeverity,
        advisory_footer: data.advisoryFooter,
        special_request: sanitiseSpecialRequest(data.specialRequest) || null,
        survey_type_ids: data.surveyTypeIds,
        created_by: context.userId,
      })
      .select(COLUMNS)
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
