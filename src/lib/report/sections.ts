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
import { LOCATION_FIELD_SET } from "@/lib/report/location";

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
 * `survey_type` -> "Survey type". Capture-field keys are machine names; a
 * document is read by people. Any leading marker underscores go, and every
 * word after the first is left as written rather than lower-cased.
 */
export function fieldLabel(key: string): string {
  const words = key
    .replace(/^_+/, "")
    .split(/[_\s]+/)
    .filter(Boolean);
  const first = words[0];
  if (!first) return "Detail";
  const head = first.charAt(0).toUpperCase() + first.slice(1);
  return [head, ...words.slice(1)].join(" ");
}

/**
 * The capture fields as they should READ on a document.
 *
 * Three kinds of field never belong in a details list. The survey-type marker
 * is an internal key: it exists so items can be grouped into sections, and
 * where a report covers more than one type the section heading already names
 * it. The location fields have their own single line on every renderer, taken
 * from `resolveLocation`, so printing them here as well is how the location
 * came to appear twice. And where a value IS one of those ids it was printed
 * raw, which is how a client came to read
 * "survey type: weekly_compliance_fire" on their own report — ids that name a
 * survey type are resolved to the label the report already carries, and
 * anything unrecognised is left exactly as stored rather than guessed at.
 *
 * Excluding the location here rather than at each render site is the point:
 * the PDF used to filter its own hardcoded list of names while the shared page
 * filtered nothing, so the two disagreed.
 */
export function readableCaptureFields(
  fields: Record<string, string> | null | undefined,
  types: Array<{ id: string; label: string }> = [],
): Array<{ id: string; label: string; value: string }> {
  const known = new Map(types.map((type) => [type.id, type.label]));
  return Object.entries(fields ?? {})
    .filter(
      ([key, value]) =>
        key !== SURVEY_TYPE_FIELD && !LOCATION_FIELD_SET.has(key) && value.trim() !== "",
    )
    .map(([key, value]) => {
      const trimmed = value.trim();
      return { id: key, label: fieldLabel(key), value: known.get(trimmed) ?? trimmed };
    });
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
