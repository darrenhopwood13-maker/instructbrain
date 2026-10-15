import type { ReportDocument } from "@/lib/report/document";

/**
 * Overlays a translation onto a document for DISPLAY. The English document is
 * untouched and remains the record copy — nothing here is ever written back.
 */
export function applyTranslation(
  document: ReportDocument,
  strings: Record<string, string>,
): ReportDocument {
  if (Object.keys(strings).length === 0) return document;
  const pick = (key: string, english: string | null | undefined) =>
    strings[key] ?? english ?? null;

  return {
    ...document,
    report: {
      ...document.report,
      title: pick("report.title", document.report.title) ?? document.report.title,
      subtitle: pick("report.subtitle", document.report.subtitle),
      scopeText: pick("report.scope_text", document.report.scopeText),
      methodologyText: pick("report.methodology_text", document.report.methodologyText),
      executiveSummary: pick("report.executive_summary", document.report.executiveSummary),
    },
    findings: document.findings.map((finding) => ({
      ...finding,
      findingText: strings[`${finding.id}.finding_text`] ?? finding.findingText,
      remedialText: strings[`${finding.id}.remedial_text`] ?? finding.remedialText,
      likelyCause: pick(`${finding.id}.likely_cause`, finding.likelyCause),
      regulatoryReference: pick(
        `${finding.id}.regulatory_reference`,
        finding.regulatoryReference,
      ),
      // The chosen clause is CARRIED THROUGH UNCHANGED, deliberately.
      //
      // It is not prose: it is the publisher's own unit number, and the words printed beside
      // it are the instrument's own heading out of the report's frozen survey type snapshot.
      // There is nothing to translate, and putting it through the translation set would be
      // actively wrong in this path, because the strings this overlay reads are built from
      // LIVE finding rows (see report-translation.server.ts). A clause added to that set could
      // therefore be re-read after issue, which is exactly the drift the frozen version exists
      // to prevent. Stated here rather than left implicit so the next person does not "finish
      // the job" by adding it.
      regulatoryClause: finding.regulatoryClause,
    })),

  };
}
