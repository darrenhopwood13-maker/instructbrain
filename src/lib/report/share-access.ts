/**
 * May this report be read from outside the organisation - and what do they get?
 *
 * This exists because the rule was in the wrong place. The public endpoint
 * checked the report's status on the manual-photographic branch only, so an
 * ordinary report's link served live content whatever its status -- including
 * after `reopenReport` set the report back to `in_review`, which is what
 * happens the moment you reopen a published report to correct one line. Every
 * link already in a client's inbox then served the working copy.
 *
 * The rule, stated once and used by EVERY door a report leaves by -- the share
 * link, the PDF behind it, the subcontractor trade link, the emailed extract:
 * a report may be read from outside only while it is published, or while it is
 * reopened for correction having been published before. In that second case the
 * reader still gets a frozen published copy, never the working one.
 *
 * Dal, 14 Oct 2026: "I want this method to run all through the app though to
 * every report."
 *
 * `withheld` is a deliberate withdrawal, so it stops.
 */
export type ShareAccessInput = {
  /** The report's own `status` column, exactly as stored. */
  status: string | null;
  /**
   * True for a manual photographic report. Kept in the input because callers
   * already know it, but it no longer changes what a link serves: every
   * published report is shared as the finished PDF.
   */
  manualOnly: boolean;
  /**
   * `reports.issued_at` -- set when the report was first published, and kept
   * when it is reopened for correction. It is what lets a client's link survive
   * a reopen without the link ever reading the live rows.
   */
  issuedAt?: string | null;
};

export type ShareAccessDecision =
  | { allowed: true; pdfOnly: boolean }
  | { allowed: false; httpStatus: number; reason: string; error: string };

/** The one status that means "this report is published". */
export const ISSUED_STATUS = "issued";

/** The status a published report takes while it is open for correction. */
export const REOPENED_STATUS = "in_review";

/** The words a refused door uses. One phrase, so the doors cannot disagree. */
export const UNPUBLISHED_MESSAGE = "This report is not currently published.";

/**
 * The publication rule. Read it before adding any door that shows a report to
 * somebody outside the organisation, and call it rather than re-deriving it.
 */
export function reportReadableOutside(input: {
  status: string | null;
  issuedAt?: string | null;
}): boolean {
  if (input.status === ISSUED_STATUS) return true;
  // Reopened to correct something: the copy already in a client's hands is a
  // published version, so their link keeps serving that. The working copy never
  // leaves - `buildIssuedPdfBytes` reads `report_versions`, never the live rows.
  return input.status === REOPENED_STATUS && Boolean(input.issuedAt);
}

/**
 * Deliberately not 403: to a link holder there is no difference between a
 * report that does not exist and one that is not published, and saying which
 * would confirm that a guessed token is real.
 */
export function shareAccessDecision(input: ShareAccessInput): ShareAccessDecision {
  if (!reportReadableOutside(input)) {
    return {
      allowed: false,
      httpStatus: 404,
      reason: "unpublished",
      error: UNPUBLISHED_MESSAGE,
    };
  }
  // Every published report is shared as the frozen PDF, whatever its type.
  //
  // It used to be `pdfOnly: input.manualOnly`, which meant an ordinary report's
  // link fell through to the inline viewer. That viewer re-reads the live rows,
  // so a client with a link was looking at the working copy - a draft - and the
  // PDF endpoint refused the same report outright, because it also required the
  // manual-only shape. Dal, 14 Oct 2026: "when we create a share link it needs
  // to be the finished PDF". A published report has exactly one canonical
  // output and the link now serves it.
  return { allowed: true, pdfOnly: true };
}
