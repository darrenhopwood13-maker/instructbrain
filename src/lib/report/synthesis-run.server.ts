import { synthesise, type SynthesisResult } from "@/lib/ai/synthesis.server";
import { logUsage } from "@/lib/ai/cost.server";
import { coerceSnapshot } from "@/lib/report/snapshot";
import { severitiesOf, statusesOf, definitionLabel } from "@/lib/survey-types";

type AnyClient = {
  from: (table: string) => any;
};

/**
 * Reads the confirmed findings of a report, runs the synthesis pass and stores
 * the result as AI-generated until a person confirms it. Nothing about a
 * finding is changed by this call.
 */
export async function synthesiseForReport(
  client: AnyClient,
  reportId: string,
): Promise<SynthesisResult> {
  const { data: reportRows, error: reportError } = await client
    .from("reports")
    .select(
      "id, organisation_id, title, survey_type_snapshot, project_id, executive_summary",
    )
    .eq("id", reportId)
    .limit(1);
  if (reportError) throw new Error(reportError.message);
  const report = reportRows?.[0];
  if (!report) throw new Error("That report could not be read.");

  const snapshot = coerceSnapshot(report.survey_type_snapshot);

  const { data: project } = await client
    .from("projects")
    .select("name, client_name, address")
    .eq("id", report.project_id)
    .limit(1);

  const { data: findings, error: findingsError } = await client
    .from("findings")
    .select(
      "ref, status, severity, assigned_trade, capture_fields, finding_text, remedial_text, confirmed_at",
    )
    .eq("report_id", reportId)
    .not("confirmed_at", "is", null)
    .order("sequence", { ascending: true });
  if (findingsError) throw new Error(findingsError.message);

  const rows = (findings ?? []) as Array<Record<string, any>>;
  if (rows.length === 0) {
    throw new Error(
      "There are no confirmed findings to summarise yet. Confirm findings in the Review tab first.",
    );
  }

  const statusLabels = Object.fromEntries(
    statusesOf(snapshot).map((status) => [status.id, status.label]),
  );
  const severityLabels = Object.fromEntries(
    severitiesOf(snapshot).map((severity) => [severity.id, severity.label]),
  );

  const { result, costUsd, model } = await synthesise({
    reportTitle: report.title,
    projectName: project?.[0]?.name ?? null,
    clientName: project?.[0]?.client_name ?? null,
    address: project?.[0]?.address ?? null,
    disciplineLabel: definitionLabel(snapshot),
    statusLabels,
    severityLabels,
    findings: rows.map((row) => ({
      ref: row["ref"],
      status: row["status"] ?? "",
      severity: row["severity"] ?? null,
      trade: row["assigned_trade"] ?? null,
      location: Object.values(row["capture_fields"] ?? {})
        .filter((value): value is string => typeof value === "string" && value.trim() !== "")
        .join(", "),
      finding: row["finding_text"] ?? "",
      remedial: row["remedial_text"] ?? "",
    })),
  });

  await client
    .from("reports")
    .update({
      synthesis: result,
      synthesis_confirmed: false,
      executive_summary: report.executive_summary || result.executiveSummary,
    })
    .eq("id", reportId);

  await logUsage(client as never, {
    organisationId: report.organisation_id,
    reportId,
    photoId: null,
    tier: "escalation",
    provider: "synthesis",
    model,
    inputTokens: 0,
    outputTokens: 0,
    costUsd,
    cached: false,
    outcome: "ok",
  } as never);

  return result;
}
