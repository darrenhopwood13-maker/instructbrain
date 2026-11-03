import { isFactsOnly, requiresConditionGrade, type SurveyTypeSnapshot } from "@/lib/survey-types";
import { PARTY_WALL_LIMITATIONS } from "@/lib/report/party-wall";

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

/**
 * A party wall schedule is the other condition document, and it is a stricter
 * one: it gives no opinion at all, so its limitations say so in as many words.
 *
 * It carries no grade — `requiresConditionGrade` is false — so the grade flag
 * cannot be what tells a renderer to print a limitations block. If it were, the
 * party wall schedule would print as an ordinary results list with no
 * limitations on it, which is the one thing this document must never do. The
 * `factsOnly` capability is the flag that means "this document says what it is
 * not", and both renderers read it through `scheduleLimitationsFor`.
 */
export function isPartyWallSchedule(snapshot: SurveyTypeSnapshot | null | undefined): boolean {
  return isFactsOnly(snapshot);
}

/** The limitations that apply to this document, in the order they print. */
export function scheduleLimitationsFor(
  snapshot: SurveyTypeSnapshot | null | undefined,
): readonly string[] {
  return isPartyWallSchedule(snapshot) ? PARTY_WALL_LIMITATIONS : SCHEDULE_OF_CONDITION_LIMITATIONS;
}

/** The applicable limitations as one block of prose, for the PDF. */
export function scheduleLimitationsTextFor(
  snapshot: SurveyTypeSnapshot | null | undefined,
): string {
  return scheduleLimitationsFor(snapshot).join(" ");
}
