/**
 * Grouping a report's items into ordered sections.
 *
 * A Custom Report may cover more than one survey type. Each item records the
 * survey type it was assessed under in its capture fields; this module turns
 * that into ordered sections for the document, the print view and the PDF
 * contents page.
 *
 * Item numbering is NOT derived from section order — refs are allocated once
 * and persisted (invariant 4). Sections only change presentation order.
 */
import type { DocFinding } from "@/lib/report/document";

/** The capture-field key that records which survey type assessed an item. */
export const SURVEY_TYPE_FIELD = "__survey_type";

export type ReportSection = {
  id: string;
  label: string;
  findings: DocFinding[];
};

export function surveyTypeOf(finding: DocFinding): string | null {
  const value = finding.captureFields?.[SURVEY_TYPE_FIELD];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * `types` is the report's ordered survey type list. Sections follow that
 * order; anything unrecognised falls into the first section so no item is
 * ever dropped from the document.
 */
export function sectionsFor(
  findings: DocFinding[],
  types: Array<{ id: string; label: string }>,
  fallbackLabel: string,
): ReportSection[] {
  const ordered = types.length > 0 ? types : [{ id: "__all", label: fallbackLabel }];
  if (ordered.length === 1) {
    return [{ id: ordered[0]!.id, label: ordered[0]!.label, findings: [...findings] }];
  }

  const buckets = new Map<string, DocFinding[]>(ordered.map((type) => [type.id, []]));
  for (const finding of findings) {
    const key = surveyTypeOf(finding);
    const bucket = (key && buckets.get(key)) || buckets.get(ordered[0]!.id)!;
    bucket.push(finding);
  }

  return ordered
    .map((type) => ({
      id: type.id,
      label: type.label,
      findings: (buckets.get(type.id) ?? []).sort((a, b) => a.sequence - b.sequence),
    }))
    .filter((section) => section.findings.length > 0);
}
