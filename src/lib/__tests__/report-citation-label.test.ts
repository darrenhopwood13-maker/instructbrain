import { describe, expect, it } from "vitest";
import { buildReportPdf } from "@/lib/report/pdf.server";
import { electricalInstallationDefinition, snapshotOf } from "@/lib/survey-definitions";
import { regulatoryReferencesOf } from "@/lib/survey-types";
import {
  decodePageTexts,
  finding,
  reportDocument,
} from "@/lib/__tests__/support/pdf-fixtures";

/**
 * A printed document names the instrument, never the internal id.
 *
 * The screen has always resolved `regulatory_reference` through the frozen
 * set's labels. The PDF drew the raw value, so a real issued PDF sent to a
 * client read "Reference: bs_7671" where the regulation's own title belongs.
 * The id is a database key: it tells a reader nothing, and on a document that
 * is checked by other people it reads as a machine talking to itself.
 *
 * The assertion that matters is the negative one. That the label appears is
 * weak on its own - a document could carry both. The id must be ABSENT.
 */
describe("a citation is printed as the instrument, not the internal id", () => {
  const snapshot = snapshotOf(electricalInstallationDefinition);
  const references = regulatoryReferencesOf(snapshot);
  const bs7671 = references.find((item) => item.id === "bs_7671");
  const eawr = references.find((item) => item.id === "eawr_1989");

  it("has the reference set these assertions depend on", () => {
    // Without this, a missing label would make the string checks below pass for
    // the wrong reason - the failure mode that made an earlier test lie.
    expect(references.length).toBeGreaterThan(0);
    expect(bs7671?.label).toBeTruthy();
    expect(eawr?.label).toBeTruthy();
    expect(bs7671?.label).not.toBe(bs7671?.id);
    expect(eawr?.label).not.toBe(eawr?.id);
  });

  it("prints the instrument's own name and never the raw id", async () => {
    const document = reportDocument(
      [
        finding({ id: "a", ref: "F-001", regulatoryReference: "bs_7671" }),
        finding({ id: "b", ref: "F-002", regulatoryReference: "eawr_1989" }),
        finding({ id: "c", ref: "F-003", regulatoryReference: null }),
      ],
      snapshot,
    );

    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = (await decodePageTexts(built.bytes)).join("\n");

    expect(text).toContain(bs7671!.label);
    expect(text).toContain(eawr!.label);
    expect(text).not.toContain("bs_7671");
    expect(text).not.toContain("eawr_1989");
  });

  it("still prints the line when the id is not in the set, rather than dropping it", async () => {
    // A report issued before a citation set existed keeps whatever it was
    // issued with. The line is never silently removed for being unrecognised.
    const document = reportDocument(
      [finding({ id: "a", ref: "F-001", regulatoryReference: "legacy_ref" })],
      snapshot,
    );
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = (await decodePageTexts(built.bytes)).join("\n");

    expect(text).toContain("legacy_ref");
  });
});
