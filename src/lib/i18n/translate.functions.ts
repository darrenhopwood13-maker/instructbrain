import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReportTranslation = {
  language: string;
  /** Keyed "<findingId>.<field>" plus "report.<field>". English on any miss. */
  strings: Record<string, string>;
  cached: boolean;
};

function cleanLanguage(value: unknown): string {
  const language = typeof value === "string" ? value.trim() : "";
  if (language === "") throw new Error("A language is required.");
  return language;
}

function cleanId(value: unknown, label: string): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (id === "") throw new Error(`A ${label} is required.`);
  return id;
}

/** Interface chrome. No report data involved, so no auth requirement. */
export const translateStrings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const value = (input ?? {}) as Record<string, unknown>;
    const strings = value["strings"];
    if (typeof strings !== "object" || strings === null) {
      throw new Error("Nothing to translate.");
    }
    return {
      language: cleanLanguage(value["language"]),
      strings: strings as Record<string, string>,
    };
  })
  .handler(async ({ data }): Promise<{ translations: Record<string, string> }> => {
    if (data.language === "en") return { translations: data.strings };
    const { translateFlat } = await import("@/lib/i18n/translate.server");
    return { translations: await translateFlat(data.language, data.strings) };
  });

/**
 * Report prose in one language. Cached per report AND per language against a
 * checksum of the English source, so a report can be held in several languages
 * at once and every one of them re-translates the moment the English changes.
 */
export const translateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const value = (input ?? {}) as Record<string, unknown>;
    return {
      reportId: cleanId(value["reportId"], "report"),
      language: cleanLanguage(value["language"]),
    };
  })
  .handler(async ({ data, context }): Promise<ReportTranslation> => {
    const { supabase } = context;

    if (data.language === "en") {
      return { language: "en", strings: {}, cached: true };
    }

    const { data: reportRows, error: reportError } = await supabase
      .from("reports")
      .select("id, organisation_id, title, subtitle, scope_text, methodology_text, executive_summary")
      .eq("id", data.reportId)
      .limit(1);
    if (reportError) throw new Error(reportError.message);
    const report = reportRows?.[0];
    if (!report) throw new Error("That report could not be found.");

    const { data: findings, error: findingError } = await supabase
      .from("findings")
      .select("id, finding_text, remedial_text, likely_cause, regulatory_reference, severity_rationale")
      .eq("report_id", data.reportId)
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

    const { checksumOf } = await import("@/lib/i18n/checksum");
    const checksum = await checksumOf(source);

    const { data: cached } = await supabase
      .from("finding_translations")
      .select("document")
      .eq("report_id", data.reportId)
      .eq("language", data.language)
      .eq("source_checksum", checksum)
      .limit(1);

    const hit = cached?.[0]?.document as Record<string, string> | undefined;
    if (hit) {
      return { language: data.language, strings: hit, cached: true };
    }

    const { translateReportStrings } = await import("@/lib/i18n/translate.server");
    const strings = await translateReportStrings(data.language, source);

    await supabase.from("finding_translations").upsert(
      {
        organisation_id: report.organisation_id,
        report_id: data.reportId,
        language: data.language,
        source_checksum: checksum,
        document: strings,
      },
      { onConflict: "report_id,language,source_checksum" },
    );

    return { language: data.language, strings, cached: false };
  });
