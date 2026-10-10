/**
 * Statutory certificate expiry.
 *
 * A certificate register has exactly one hard question: is this in date? The
 * one thing it must never do is answer that question when the date is missing.
 *
 * Invariant 1 of the survey engine says an unknown value resolves to
 * `not_assessed` and never to a status with tone "pass". This module is that
 * invariant applied to a date, and it is the only place the rule lives: the
 * screen, the register grid and the issued document all read the answer from
 * here, so they cannot disagree about whether something is in date.
 *
 * Deliberate decisions, and why:
 *
 *  - **No date, no answer.** A missing, blank, malformed or impossible date
 *    (`2026-02-30`) returns `not_assessed`. It does not return "valid". A gap in
 *    the paperwork is exactly the condition that lets a lapse reach an audit, so
 *    the register reports the gap as a gap.
 *  - **Expiring today is still in date.** On the day it runs out the certificate
 *    is valid until midnight, and the item is flagged as expiring. `expired`
 *    begins the following day.
 *  - **Dates are UTC date-only.** Two values only, both `yyyy-mm-dd`, compared at
 *    UTC midnight so a server in one timezone and a phone in another cannot put
 *    the same certificate on different sides of the line.
 *  - **The answer is derived, never stored as an opinion.** The same two dates
 *    produce the same status on every device, every day.
 */

export const CERTIFICATE_STATUS_IDS = ["valid", "expiring", "expired", "not_assessed"] as const;

export type CertificateStatusId = (typeof CERTIFICATE_STATUS_IDS)[number];

/** How long before a date it runs out a certificate starts asking for attention. */
export const DEFAULT_CERTIFICATE_LEAD_DAYS = 30;

const DAY_MS = 86_400_000;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function isoDate(stamp: number): string {
  return new Date(stamp).toISOString().slice(0, 10);
}

/**
 * A `yyyy-mm-dd` string or a Date to UTC midnight, or null when there is no
 * usable date there. A Date carrying a time collapses to its UTC calendar day.
 */
function toUtcMidnight(value: string | Date | null | undefined): number | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  if (typeof value !== "string") return null;
  const match = DATE_ONLY.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const stamp = Date.UTC(year, month - 1, day);
  const back = new Date(stamp);
  // A date that rolled over (2026-02-30 becomes 2 March) is not a date.
  if (
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day
  ) {
    return null;
  }
  return stamp;
}

function normaliseLeadDays(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : DEFAULT_CERTIFICATE_LEAD_DAYS;
}

export type CertificateExpiry = {
  /** `valid` | `expiring` | `expired` | `not_assessed`. */
  statusId: CertificateStatusId;
  /** The date this answer was derived from, `yyyy-mm-dd`, or null when there was none. */
  expiryDate: string | null;
  /** Whole days from today to the date it runs out. Null when there is no date. */
  daysRemaining: number | null;
  leadDays: number;
};

/**
 * Derive the register status of one certificate from the date it runs out.
 *
 * `today` is injected so a day can be tested, and so the caller decides what
 * "now" means rather than this module reaching for the clock.
 */
export function deriveCertificateExpiry(input: {
  /** `null` and `undefined` both mean "no date on record". */
  expiryDate?: string | Date | null | undefined;
  today?: string | Date | undefined;
  leadDays?: number | undefined;
}): CertificateExpiry {
  const leadDays = normaliseLeadDays(input.leadDays);
  const expiry = toUtcMidnight(input.expiryDate ?? null);

  if (expiry === null) {
    return { statusId: "not_assessed", expiryDate: null, daysRemaining: null, leadDays };
  }

  const today = toUtcMidnight(input.today ?? new Date());
  if (today === null) {
    // An unusable "today" is not a licence to call a certificate in date.
    return { statusId: "not_assessed", expiryDate: isoDate(expiry), daysRemaining: null, leadDays };
  }

  const daysRemaining = Math.round((expiry - today) / DAY_MS);
  const statusId: CertificateStatusId =
    daysRemaining < 0 ? "expired" : daysRemaining <= leadDays ? "expiring" : "valid";

  return { statusId, expiryDate: isoDate(expiry), daysRemaining, leadDays };
}

/**
 * Tone for the register grid. An unrecognised status is a `flag`, never a pass:
 * the engine's rule is that a value it cannot read is reported, not smoothed
 * over.
 */
export function certificateStatusTone(statusId: unknown): "pass" | "warn" | "fail" | "flag" {
  switch (statusId) {
    case "valid":
      return "pass";
    case "expiring":
      return "warn";
    case "expired":
      return "fail";
    default:
      return "flag";
  }
}

export function certificateStatusLabel(statusId: unknown): string {
  switch (statusId) {
    case "valid":
      return "In date";
    case "expiring":
      return "Expiring";
    case "expired":
      return "Expired";
    default:
      return "Not assessed";
  }
}

/** True only for `valid`. Everything else in the register needs someone's eye. */
export function isCertificateInDate(statusId: unknown): boolean {
  return statusId === "valid";
}

/** How the register describes the countdown, or why it cannot. */
export function describeCertificateExpiry(expiry: CertificateExpiry): string {
  if (expiry.daysRemaining === null) return "No date on record - not assessed";
  if (expiry.daysRemaining < 0) {
    const days = Math.abs(expiry.daysRemaining);
    return `Expired ${days} day${days === 1 ? "" : "s"} ago`;
  }
  if (expiry.daysRemaining === 0) return "Runs out today";
  return `${expiry.daysRemaining} day${expiry.daysRemaining === 1 ? "" : "s"} remaining`;
}
