import { describe, expect, it } from "vitest";
import { reportReadableOutside, shareAccessDecision } from "@/lib/report/share-access";

const PUBLISHED = "2026-10-14T00:00:00.000Z";

/**
 * The two defects these cover:
 *
 *  1. Reopening a published report set it to `in_review`, and the public endpoint
 *     checked status on the manual branch only - so every link already sent to a
 *     client began serving the working copy.
 *  2. The decision sent every report except the manual photographic kind to the
 *     inline viewer, which re-reads live rows - so a published report's link showed
 *     the client a draft, and the PDF behind the same link 404'd.
 *
 * The method Dal asked for on 14 Oct 2026 - the finished PDF, through every door,
 * for every report - is both of those fixed at once.
 */
describe("what a report outside the organisation is allowed to be", () => {
  it("serves every published report as the finished PDF, whatever its type", () => {
    for (const manualOnly of [true, false]) {
      const decision = shareAccessDecision({ status: "issued", manualOnly, issuedAt: PUBLISHED });
      expect(decision.allowed).toBe(true);
      if (decision.allowed) expect(decision.pdfOnly).toBe(true);
    }
  });

  it("keeps serving a client's copy when the report is reopened for correction", () => {
    // A correction pass is normal. The copy already in the client's hands is a
    // published version, so their link goes on working - as the frozen copy, not
    // as the working copy being edited.
    const decision = shareAccessDecision({
      status: "in_review",
      manualOnly: false,
      issuedAt: PUBLISHED,
    });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.pdfOnly).toBe(true);
  });

  it("refuses a report that has never been published, whatever its state", () => {
    for (const status of ["draft", "analysing", "in_review", "withheld", null, ""]) {
      for (const manualOnly of [true, false]) {
        const decision = shareAccessDecision({ status, manualOnly, issuedAt: null });
        expect(decision.allowed).toBe(false);
        if (!decision.allowed) {
          expect(decision.httpStatus).toBe(404);
          expect(decision.reason).toBe("unpublished");
        }
      }
    }
  });

  it("refuses a report that was published and then withheld", () => {
    // `withheld` is a deliberate withdrawal, not an oversight: the door closes
    // even though a published version sits behind it.
    const decision = shareAccessDecision({
      status: "withheld",
      manualOnly: false,
      issuedAt: PUBLISHED,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toBe("unpublished");
  });

  it("does not reveal whether an unpublished token is real", () => {
    const decision = shareAccessDecision({ status: "draft", manualOnly: false, issuedAt: null });
    // The same words and the same status an unrecognised token gets: a guessed
    // token cannot be confirmed by the reply it receives.
    if (!decision.allowed) {
      expect(decision.error).toBe("This report is not currently published.");
      expect(decision.httpStatus).toBe(404);
    }
  });

  it("is one rule, not a rule per door - the trade link asks the same question", () => {
    expect(reportReadableOutside({ status: "issued", issuedAt: null })).toBe(true);
    expect(reportReadableOutside({ status: "in_review", issuedAt: PUBLISHED })).toBe(true);
    expect(reportReadableOutside({ status: "in_review", issuedAt: null })).toBe(false);
    expect(reportReadableOutside({ status: "draft", issuedAt: null })).toBe(false);
    expect(reportReadableOutside({ status: "withheld", issuedAt: PUBLISHED })).toBe(false);
  });
});
