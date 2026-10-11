/**
 * Who may read a share link, and what they get.
 *
 * This exists because the rule was in the wrong place. The public endpoint
 * checked the report's status on the manual-photographic branch only, so an
 * ordinary report's link served live content whatever its status -- including
 * after `reopenReport` set the report back to `in_review`, which is what
 * happens the moment you reopen a published report to correct one line. Every
 * link already in a client's inbox then served the working copy.
 *
 * The rule, stated once and testable:
 *   nothing outside the organisation reads a report that is not published.
 *
 * A manual photographic report additionally has no review page to serve -- it
 * is shared as the finished PDF only -- but that is a shape decision, not an
 * access one, so it is kept separate on purpose.
 */
export type ShareAccessInput = {
  /** The report's own `status` column, exactly as stored. */
  status: string | null;
  /** True for a manual photographic report: PDF only, never a review page. */
  manualOnly: boolean;
};

export type ShareAccessDecision =
  | { allowed: true; pdfOnly: boolean }
  | { allowed: false; httpStatus: number; reason: string; error: string };

/** The one status that means "this report is published". */
export const ISSUED_STATUS = "issued";

/**
 * Deliberately not 403: to a link holder there is no difference between a
 * report that does not exist and one that is not published, and saying which
 * would confirm that a guessed token is real.
 */
export function shareAccessDecision(input: ShareAccessInput): ShareAccessDecision {
  if (input.status !== ISSUED_STATUS) {
    return {
      allowed: false,
      httpStatus: 404,
      reason: "unpublished",
      error: "This report is not currently published.",
    };
  }
  return { allowed: true, pdfOnly: input.manualOnly };
}
