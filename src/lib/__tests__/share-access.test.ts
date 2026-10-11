import { describe, expect, it } from "vitest";
import { shareAccessDecision } from "@/lib/report/share-access";

/**
 * The defect these cover: reopening a published report set it to `in_review`,
 * and the public endpoint only checked status on the manual branch -- so every
 * link already sent to a client began serving the working copy.
 */
describe("what a share link is allowed to serve", () => {
  it("serves a published report as a review page", () => {
    const decision = shareAccessDecision({ status: "issued", manualOnly: false });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.pdfOnly).toBe(false);
  });

  it("serves a published manual report as PDF only", () => {
    const decision = shareAccessDecision({ status: "issued", manualOnly: true });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.pdfOnly).toBe(true);
  });

  it("refuses a report reopened for editing, which is the reopen leak", () => {
    const decision = shareAccessDecision({ status: "in_review", manualOnly: false });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.httpStatus).toBe(404);
      expect(decision.reason).toBe("unpublished");
    }
  });

  it.each(["draft", "analysing", "withheld", null, ""])(
    "refuses a report whose status is %s, whatever its kind",
    (status) => {
      for (const manualOnly of [true, false]) {
        const decision = shareAccessDecision({ status, manualOnly });
        expect(decision.allowed).toBe(false);
      }
    },
  );

  it("does not reveal whether an unpublished token is real", () => {
    const decision = shareAccessDecision({ status: "draft", manualOnly: false });
    // Same words and same status as an unrecognised token: a guessed token
    // cannot be confirmed by the reply it gets.
    if (!decision.allowed) {
      expect(decision.error).toBe("This report is not currently published.");
      expect(decision.httpStatus).toBe(404);
    }
  });
});
