/**
 * Carrying a weekly check forward from the last one.
 *
 * A fire check on a block of flats is the same 300 questions every week and the
 * answers are nearly always the same. Answering all 300 to say "nothing changed"
 * is busywork that also invites the mistake that matters - a control marked the
 * same as last week because it was quick, not because it was looked at.
 *
 * So nothing here guesses. It offers the previous inspection's recorded answers
 * as a starting point, keeps every answer the inspector has already given this
 * week untouched, and tells them exactly which points differ. Those are the only
 * ones that need eyes. The confirm step only ever covers points that genuinely
 * match last week, so a bulk confirm can never wave through a change.
 *
 * Derived dates are excluded on purpose: a due date is computed from the dates
 * around it, and copying last week's would put a real deadline in the past.
 */

import type { ComplianceEntry } from "./compliance-data";

export type CarryPlan = {
  /** Blank this week, answered last week - these take last week's answers. */
  takeFromPrevious: { entry: ComplianceEntry; answers: Record<string, unknown> }[];
  /** Already answered this week, matching last week - safe to confirm in bulk. */
  unchanged: ComplianceEntry[];
  /** Already answered this week, differing from last week - the real work. */
  changed: ComplianceEntry[];
  /** Blank this week and blank last week - the inspector has to answer these. */
  noHistory: ComplianceEntry[];
};

const normalise = (value: unknown): string => {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  return String(value).trim();
};

/** The subset of an entry's answers that may be compared - derived dates never count. */
function comparable(answers: Record<string, unknown>, fieldIds: string[]) {
  const picked: Record<string, unknown> = {};
  for (const fieldId of fieldIds) picked[fieldId] = answers[fieldId] ?? null;
  return picked;
}

function sameAnswers(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  fieldIds: string[],
): boolean {
  const left = comparable(a, fieldIds);
  const right = comparable(b, fieldIds);
  // A question nobody answered on either side is not a match - it is unanswered.
  if (fieldIds.every((fieldId) => normalise(left[fieldId]) === "")) return false;
  return fieldIds.every((fieldId) => normalise(left[fieldId]) === normalise(right[fieldId]));
}

const answered = (answers: Record<string, unknown>, fieldIds: string[]): boolean =>
  fieldIds.some((fieldId) => normalise(answers[fieldId]) !== "");

/**
 * Work out what a carry-forward would do, without writing anything.
 *
 * `previous` is the entry list from one earlier check of the same type on the
 * same site; points are matched by `pointId`, which is what makes a weekly check
 * comparable at all.
 */
export function planCarryForward(input: {
  current: ComplianceEntry[];
  previous: ComplianceEntry[];
  /** The question ids that may be compared for this point. Must exclude derived dates. */
  comparableFieldIds: (entry: ComplianceEntry) => string[];
}): CarryPlan {
  const previousByPoint = new Map<string, ComplianceEntry>();
  for (const entry of input.previous) {
    const seen = previousByPoint.get(entry.pointId);
    // Keep the most recent of any duplicates rather than the first one stored.
    if (!seen || entry.id > seen.id) previousByPoint.set(entry.pointId, entry);
  }

  const plan: CarryPlan = { takeFromPrevious: [], unchanged: [], changed: [], noHistory: [] };

  for (const entry of input.current) {
    const fieldIds = input.comparableFieldIds(entry);
    if (fieldIds.length === 0) continue;
    const before = previousByPoint.get(entry.pointId);

    if (answered(entry.answers, fieldIds)) {
      // The inspector has already spoken this week. Never overwrite, never confirm blind.
      if (before && sameAnswers(entry.answers, before.answers, fieldIds)) plan.unchanged.push(entry);
      else plan.changed.push(entry);
      continue;
    }

    if (before && answered(before.answers, fieldIds)) {
      const answers: Record<string, unknown> = {};
      for (const fieldId of fieldIds) {
        if (normalise(before.answers[fieldId]) !== "") answers[fieldId] = before.answers[fieldId];
      }
      plan.takeFromPrevious.push({ entry, answers });
    } else {
      plan.noHistory.push(entry);
    }
  }

  return plan;
}

/** Points a bulk confirm may cover: matching last week, or just filled from it. */
export function confirmableIds(plan: CarryPlan): string[] {
  return [
    ...plan.unchanged.map((entry) => entry.id),
    ...plan.takeFromPrevious.map(({ entry }) => entry.id),
  ];
}
