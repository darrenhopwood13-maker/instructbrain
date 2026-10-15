import { describe, expect, it } from "vitest";

import { buildReportPdf } from "@/lib/report/pdf.server";
import { electricalInstallationDefinition, siteWalkDefinition, snapshotOf } from "@/lib/survey-definitions";
import { CLAUSE_SETS } from "@/lib/regulatory-clauses";
import { clauseLabel, regulatoryReferencesOf } from "@/lib/survey-types";
import { decodePageTexts, finding, reportDocument } from "@/lib/__tests__/support/pdf-fixtures";

/**
 * What the printed report says about a chosen clause.
 *
 * Rendered, not just built: each case writes a real PDF and reads its text layer back, so the
 * assertions fail if the line stops being drawn. Two things are being pinned here, and the
 * second is the one that matters on a document somebody else relies on:
 *
 *   1. A clause a person chose prints beside the instrument it belongs to.
 *   2. Nothing else does. A number the instrument does not publish prints NOTHING - it is never
 *      shown with an invented heading, and never with a heading borrowed from another entry.
 *      The words printed are the publisher's own, out of the frozen list, and nowhere else.
 */

/** The page text with runs of whitespace flattened - layout wrapping must not hide a string. */
const flatten = (pages: string[]) => pages.join("\n").replace(/\s+/g, " ");

const ELECTRICAL = snapshotOf(electricalInstallationDefinition);
const references = regulatoryReferencesOf(ELECTRICAL);
const eawr = references.find((reference) => reference.id === "eawr_1989")!;
const bs7671 = references.find((reference) => reference.id === "bs_7671")!;

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("the clause in the printed report", () => {
  it("has the list these assertions depend on", () => {
    // Without this, a missing list would make every negative assertion below pass for the
    // wrong reason - the failure mode that made an earlier suite lie.
    expect(eawr.clauses).toBeTruthy();
    expect(CLAUSE_SETS.eawr_1989.entries.length).toBe(35);
    expect(bs7671.clauses).toBeUndefined();
  });

  it("prints the instrument, the publisher's own unit and its own heading, beside the reference", async () => {
    const heading = CLAUSE_SETS.eawr_1989.entries.find((entry) => entry.number === "4")!.heading;
    const expected = `Electricity at Work Regulations 1989, regulation 4 - ${heading}`;
    expect(clauseLabel(eawr, "4")).toBe(expected);

    const document = reportDocument(
      [finding({ id: "a", ref: "F-001", regulatoryReference: "eawr_1989", regulatoryClause: "4" })],
      ELECTRICAL,
    );
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = flatten(await decodePageTexts(built.bytes));

    expect(text).toContain(expected);
    expect(text).toContain("Reference: Electricity at Work Regulations 1989");
    // The heading is in the list and nowhere else in the document, so it appears exactly once.
    expect(occurrences(text, heading)).toBe(1);
  });

  it("prints the instrument alone when a person chose no clause - exactly as it did before", async () => {
    const heading = CLAUSE_SETS.eawr_1989.entries.find((entry) => entry.number === "4")!.heading;
    const document = reportDocument(
      [finding({ id: "a", ref: "F-001", regulatoryReference: "eawr_1989", regulatoryClause: null })],
      ELECTRICAL,
    );
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = flatten(await decodePageTexts(built.bytes));

    expect(text).toContain("Reference: Electricity at Work Regulations 1989");
    expect(text).not.toContain(heading);
    expect(text).not.toContain("regulation 4");
  });

  it("prints nothing at all for a number the instrument does not publish", async () => {
    // Three shapes of not-a-clause: a number nobody published, one from a different instrument,
    // and free text. None may print, and none may borrow a heading to make itself look real.
    for (const stored of ["9999", "SCHEDULE 6", "regulation 4 (probably)", "  "]) {
      const document = reportDocument(
        [finding({ id: "a", ref: "F-001", regulatoryReference: "eawr_1989", regulatoryClause: stored })],
        ELECTRICAL,
      );
      const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
      const text = flatten(await decodePageTexts(built.bytes));

      expect(text, `"${stored}" printed`).not.toContain("regulation 4");
      expect(text).not.toContain("SCHEDULE 6");
      expect(text).not.toContain("probably");
      // The instrument itself is still named: refusing the clause does not drop the reference.
      expect(text).toContain("Reference: Electricity at Work Regulations 1989");
    }
  });

  it("prints no clause for an instrument whose publisher titles nothing, whatever is stored", async () => {
    const document = reportDocument(
      [finding({ id: "a", ref: "F-001", regulatoryReference: "bs_7671", regulatoryClause: "4" })],
      ELECTRICAL,
    );
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = flatten(await decodePageTexts(built.bytes));

    expect(text).toContain("Reference: BS 7671");
    expect(text).not.toContain("regulation 4");
    expect(text).not.toContain("BS 7671 - IET Wiring Regulations (18th Edition), regulation");
  });

  it("prints nothing when the report's brief switched references off - and prints it again when they are back on", async () => {
    // The switch hides; it never deletes. The same finding object is rendered both ways, and
    // the chosen clause is still on it afterwards.
    const chosen = finding({
      id: "a",
      ref: "F-001",
      regulatoryReference: "eawr_1989",
      regulatoryClause: "4",
    });
    const heading = CLAUSE_SETS.eawr_1989.entries.find((entry) => entry.number === "4")!.heading;

    const off = await buildReportPdf(
      reportDocument([chosen], ELECTRICAL, { regulationCitations: false }),
      { variant: "full", includePhotos: false },
    );
    const offText = flatten(await decodePageTexts(off.bytes));
    expect(offText).not.toContain(heading);
    expect(offText).not.toContain("Reference: Electricity at Work Regulations 1989");

    const on = await buildReportPdf(reportDocument([chosen], ELECTRICAL, { regulationCitations: true }), {
      variant: "full",
      includePhotos: false,
    });
    const onText = flatten(await decodePageTexts(on.bytes));
    expect(onText).toContain(heading);
    expect(onText).toContain("regulation 4");

    // Nothing was removed from the finding by either render.
    expect(chosen.regulatoryClause).toBe("4");
    expect(chosen.regulatoryReference).toBe("eawr_1989");
  });

  it("prints each finding's own clause, and only that one", async () => {
    const document = reportDocument(
      [
        finding({ id: "a", ref: "F-001", regulatoryReference: "eawr_1989", regulatoryClause: "4" }),
        finding({ id: "b", ref: "F-002", regulatoryReference: "esqcr_2002", regulatoryClause: "3" }),
        finding({ id: "c", ref: "F-003", regulatoryReference: "eawr_1989", regulatoryClause: null }),
      ],
      ELECTRICAL,
    );
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = flatten(await decodePageTexts(built.bytes));

    const eawr4 = clauseLabel(eawr, "4")!;
    const esqcr3 = clauseLabel(
      references.find((reference) => reference.id === "esqcr_2002")!,
      "3",
    )!;
    expect(text).toContain(eawr4);
    expect(text).toContain(esqcr3);
    expect(occurrences(text, eawr4)).toBe(1);
    expect(occurrences(text, esqcr3)).toBe(1);
  });

  it("names no clause on a template that carries no clause list at all", async () => {
    // The site walk carries instruments, and none of them publishes a titled list.
    const snapshot = snapshotOf(siteWalkDefinition);
    const document = reportDocument(
      [finding({ id: "a", ref: "F-001", regulatoryReference: "hswa_1974", regulatoryClause: "4" })],
      snapshot,
    );
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = flatten(await decodePageTexts(built.bytes));

    expect(text).toContain("Reference: Health and Safety at Work");
    expect(text).not.toContain("regulation 4");
  });
});
