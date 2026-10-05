import { requiresConditionGrade, type SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * The Schedule of Condition, as one shared shape.
 *
 * A condition survey is read as a Schedule of Condition: a heading, a scope and
 * limitations block, then the elements one by one with their grade, photograph,
 * description and required action, and finally a count of how many elements
 * fall in each grade.
 *
 * The limitations are MANDATORY and they are printed ON the artifact, not held
 * in conversation. A Schedule of Condition that does not say what it is not is
 * the single most dangerous document this product can produce, so the wording
 * lives here — one list, rendered identically by the screen view and the PDF —
 * rather than being retyped at each renderer where it could drift or be dropped.
 */

export const SCHEDULE_OF_CONDITION_HEADING = "Schedule of Condition";

/**
 * The scope and limitations block. Every clause is required: between them they
 * state what the schedule records, what it is not, how far it looked, what it
 * could not see, and that it instructs no works.
 */
export const SCHEDULE_OF_CONDITION_LIMITATIONS: readonly string[] = [
  "This is a record of the visible condition of the elements listed, as seen on the date of inspection.",
  "It is not a structural survey and not a building survey, and it does not report on any matter outside the visible condition of those elements.",
  "No opening up, no dismantling and no testing of any kind was carried out.",
  "Concealed or inaccessible areas are excluded, and no opinion is given on them.",
  "Nothing in this schedule is a specification, a scope of works or a construction instruction; any repair or replacement must be specified separately before work is carried out.",
] as const;

/** Whether a report's survey type is a condition survey, read as a schedule. */
export function isScheduleOfCondition(snapshot: SurveyTypeSnapshot | null | undefined): boolean {
  return requiresConditionGrade(snapshot);
}

/** The limitations as one block of prose, for the PDF and for a tooltip. */
export const SCHEDULE_OF_CONDITION_LIMITATIONS_TEXT = SCHEDULE_OF_CONDITION_LIMITATIONS.join(" ");

export function scheduleOfConditionLimitationsText(): string {
  return SCHEDULE_OF_CONDITION_LIMITATIONS_TEXT;
}
