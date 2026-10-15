import { coerceBrief, type ReportBrief } from "@/lib/report/brief";

/**
 * Regulation references are the layer that lets a finding name the instrument it engages:
 * the per-template citation set, the derived `regulatory_reference` field, the picker on the
 * review screen, and the Reference line in the PDF.
 *
 * It is optional per report, because a client may not want citations in a particular
 * deliverable. One switch controls it:
 *
 *   reports.brief.regulationReferences   the AI brief, written by the person setting the report up
 *
 * Default true on purpose: a report whose brief predates this setting - and every report
 * created before it existed - behaves exactly as it did before.
 *
 * This is a DISPLAY AND GENERATION decision only. Nothing is deleted: a finding that already
 * carries a reference keeps it in the database, and turning the switch back on shows it again.
 * That matters because a report's brief can be changed after photographs have been analysed.
 */

/** What a brief that has never carried the setting means. */
export const REGULATION_REFERENCES_DEFAULT = true;

/**
 * Resolve the brief's answer to on or off.
 *
 * Only a real boolean counts. null, undefined and anything else fall through to the default,
 * which is what lets an older brief keep working without a sentinel value, and keeps this
 * decision in one place rather than at each call site.
 */
export function resolveRegulationReferences(value: unknown): boolean {
  return typeof value === "boolean" ? value : REGULATION_REFERENCES_DEFAULT;
}

/** Convenience for callers holding the raw brief (a report row, say). */
export function regulationReferencesFromBrief(brief: unknown): boolean {
  return resolveRegulationReferences(coerceBrief(brief)?.regulationReferences);
}

/** The rule in one sentence, for a description or a test to quote. */
export function regulationReferencesRule(brief: ReportBrief | null): boolean {
  return resolveRegulationReferences(brief?.regulationReferences);
}
