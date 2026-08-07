/**
 * Target dates are DERIVED from the severity scale in the report's own survey
 * type snapshot — never invented here, and never invented at all where the
 * definition does not set `targetHours`.
 *
 * A severity with `targetHours: 0` means immediate: the item is due now, and
 * the interface says "Immediate — stop work" rather than printing a date.
 */
import { resolveSeverity, type SurveyTypeSnapshot } from "@/lib/survey-types";

export type DerivedDueDate = {
  /** ISO date (yyyy-mm-dd) to persist, or null when the definition sets none. */
  dueDate: string | null;
  /** True when the severity's target is zero hours. */
  immediate: boolean;
  /** The severity's target window in hours, when the definition sets one. */
  targetHours: number | null;
};

const NONE: DerivedDueDate = { dueDate: null, immediate: false, targetHours: null };

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Derives a target date from `confirmedAt + targetHours`.
 *
 * Returns no date when the snapshot's severity carries no `targetHours`
 * (weatherproofing and snagging do not). Absence is a real answer.
 */
export function deriveDueDate(
  snapshot: SurveyTypeSnapshot | null | undefined,
  severityId: unknown,
  confirmedAt: string | Date,
): DerivedDueDate {
  const severity = resolveSeverity(snapshot, severityId);
  const hours = severity?.targetHours;
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours < 0) return NONE;

  const from = confirmedAt instanceof Date ? confirmedAt : new Date(confirmedAt);
  if (Number.isNaN(from.getTime())) return NONE;

  return {
    dueDate: isoDate(new Date(from.getTime() + hours * 3_600_000)),
    immediate: hours === 0,
    targetHours: hours,
  };
}

/** True when this severity's target window is immediate. */
export function isImmediate(
  snapshot: SurveyTypeSnapshot | null | undefined,
  severityId: unknown,
): boolean {
  return resolveSeverity(snapshot, severityId)?.targetHours === 0;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * The one place a target date becomes words. Immediate never renders as a
 * date, and a missing date never renders as an invented one.
 */
export function formatTarget(
  snapshot: SurveyTypeSnapshot | null | undefined,
  severityId: unknown,
  dueDate: string | null | undefined,
): string {
  if (isImmediate(snapshot, severityId)) return "Immediate — stop work";
  if (!dueDate) return "No target date";
  const parsed = new Date(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "No target date";
  return dateFormatter.format(parsed);
}

/** Days past the target date. Zero or negative means not yet overdue. */
export function daysOverdue(dueDate: string | null | undefined, now = new Date()): number {
  if (!dueDate) return 0;
  const due = new Date(`${dueDate}T00:00:00Z`).getTime();
  if (Number.isNaN(due)) return 0;
  return Math.floor((now.getTime() - due) / 86_400_000);
}
