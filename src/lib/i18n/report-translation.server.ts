import { applyTranslation } from "@/lib/i18n/apply-translation";
import type { ReportDocument } from "@/lib/report/document";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

/**
 * The English prose of a report, keyed exactly as `applyTranslation` expects.
 * This is the source of record — a translation is only ever built from it.
 */
async function sourceStrings(
  db: Db,
  reportId: string,
): Promise<{ organisationId: string; source: Record<string, string> } | null> {
  const { data: reportRows, error: reportError } = await db
    .from("reports")
    .select(
      "id, organisation_id, title, subtitle, scope_text, methodology_text, executive_summary",
    )
    .eq("id", reportId)
    .limit(1);
  if (reportError) throw new Error(reportError.message);
  const report = reportRows?.[0];
  if (!report) return null;

  const { data: findings, error: findingError } = await db
    .from("findings")
    .select(
      "id, finding_text, remedial_text, likely_cause, regulatory_reference, severity_rationale",
    )
    .eq("report_id", reportId)
    .order("sequence", { ascending: true });
  if (findingError) throw new Error(findingError.message);

  const source: Record<string, string> = {};
  const add = (key: string, value: unknown) => {
    if (typeof value === "string" && value.trim() !== "") source[key] = value;
  };
  add("report.title", report.title);
  add("report.subtitle", report.subtitle);
  add("report.scope_text", report.scope_text);
  add("report.methodology_text", report.methodology_text);
  add("report.executive_summary", report.executive_summary);
  for (const finding of findings ?? []) {
    add(`${finding.id}.finding_text`, finding.finding_text);
    add(`${finding.id}.remedial_text`, finding.remedial_text);
    add(`${finding.id}.likely_cause`, finding.likely_cause);
    add(`${finding.id}.regulatory_reference`, finding.regulatory_reference);
    add(`${finding.id}.severity_rationale`, finding.severity_rationale);
  }

  return { organisationId: report.organisation_id as string, source };
}

/**
 * Translated prose for one report in one language, cached per report, language
 * and checksum of the English source. English is never overwritten: this is a
 * display layer held alongside the record.
 */
export async function reportTranslationStrings(
  db: Db,
  reportId: string,
  language: string,
): Promise<{ language: string; strings: Record<string, string>; cached: boolean }> {
  if (!language || language === "en") return { language: "en", strings: {}, cached: true };

  const loaded = await sourceStrings(db, reportId);
  if (!loaded) throw new Error("That report could not be found.");
  const { organisationId, source } = loaded;

  const { checksumOf } = await import("@/lib/i18n/checksum");
  const checksum = await checksumOf(source);

  const { data: cached } = await db
    .from("finding_translations")
    .select("document")
    .eq("report_id", reportId)
    .eq("language", language)
    .eq("source_checksum", checksum)
    .limit(1);

  const hit = cached?.[0]?.document as Record<string, string> | undefined;
  if (hit) return { language, strings: hit, cached: true };

  const { translateReportStrings } = await import("@/lib/i18n/translate.server");
  const strings = await translateReportStrings(language, source);

  await db.from("finding_translations").upsert(
    {
      organisation_id: organisationId,
      report_id: reportId,
      language,
      source_checksum: checksum,
      document: strings,
    },
    { onConflict: "report_id,language,source_checksum" },
  );

  return { language, strings, cached: false };
}

/**
 * The output view of a document in the report's own issue language. If the
 * translation fails for any reason the English record is returned unchanged —
 * an untranslated document is always better than a missing one.
 */
export async function documentForOutput(
  db: Db,
  document: ReportDocument,
): Promise<ReportDocument> {
  const language = document.report.outputLanguage;
  if (!language || language === "en") return document;
  try {
    const { strings } = await reportTranslationStrings(db, document.report.id, language);
    if (Object.keys(strings).length === 0) return document;
    return applyTranslation(document, strings);
  } catch (error) {
    console.error("Report output translation failed", error);
    return document;
  }
}
