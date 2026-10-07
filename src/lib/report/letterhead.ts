import { definitionLabel, type SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * The template name, but only when the report's own title has not already said it.
 *
 * Every report raised from a template carries the template name inside its title:
 * the start screen builds a blank one as `${definitionLabel} — ${project / date}`.
 * Printing that same name again as an eyebrow directly above the title is not a
 * heading over a document, it is the same words twice — the report header read
 * "SNAG IDENTIFICATION & REMEDIAL SCHEDULE" stacked on "Snag identification &
 * remedial schedule — 6 Oct 2026".
 *
 * The rule here: if the title already opens with the template name, the eyebrow
 * has nothing to add, so it is suppressed. A title a person typed themselves
 * ("13 Bruton Street — photo update") does not state the template, so the eyebrow
 * stays and still tells the reader which template produced the report.
 *
 * Nothing else changes: the title is a stored field and is never rewritten, and
 * documents already issued keep their own snapshot.
 */
export function definitionEyebrow(
  title: string | null | undefined,
  snapshot: SurveyTypeSnapshot | null | undefined,
): string {
  const label = definitionLabel(snapshot);
  const titleText = (title ?? "").trim();
  if (titleText === "") return label;

  const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const labelText = normalise(label);
  if (labelText === "") return label;

  return normalise(titleText).startsWith(labelText) ? "" : label;
}
