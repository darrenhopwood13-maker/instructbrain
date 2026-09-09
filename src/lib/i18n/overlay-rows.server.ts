/**
 * Presenting stored rows in the language a report was issued in.
 *
 * The English rows are the record copy: nothing here writes back, it only
 * overlays a cached translation for output. If the translation cannot be
 * produced the English text is returned unchanged — an untranslated document
 * is always better than a missing one.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

export async function outputStrings(
  db: Db,
  reportId: string,
  language: string | null | undefined,
): Promise<Record<string, string>> {
  if (!language || language === "en") return {};
  try {
    const { reportTranslationStrings } = await import("@/lib/i18n/report-translation.server");
    const { strings } = await reportTranslationStrings(db, reportId, language);
    return strings;
  } catch (error) {
    console.error("Shared output translation failed", error);
    return {};
  }
}

export function overlayReportRow<T extends Record<string, any>>(
  report: T,
  strings: Record<string, string>,
): T {
  if (Object.keys(strings).length === 0) return report;
  const pick = (key: string, value: any) => strings[key] ?? value;
  return {
    ...report,
    title: pick("report.title", report["title"]),
    subtitle: pick("report.subtitle", report["subtitle"]),
    scope_text: pick("report.scope_text", report["scope_text"]),
    methodology_text: pick("report.methodology_text", report["methodology_text"]),
    executive_summary: pick("report.executive_summary", report["executive_summary"]),
  };
}

export function overlayFindingRows<T extends Record<string, any>>(
  findings: T[],
  strings: Record<string, string>,
): T[] {
  if (Object.keys(strings).length === 0) return findings;
  return findings.map((finding) => {
    const id = finding["id"];
    const pick = (field: string, value: any) => strings[`${id}.${field}`] ?? value;
    return {
      ...finding,
      finding_text: pick("finding_text", finding["finding_text"]),
      remedial_text: pick("remedial_text", finding["remedial_text"]),
      likely_cause: pick("likely_cause", finding["likely_cause"]),
      regulatory_reference: pick("regulatory_reference", finding["regulatory_reference"]),
      severity_rationale: pick("severity_rationale", finding["severity_rationale"]),
    };
  });
}
