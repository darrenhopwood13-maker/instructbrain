import { describe, expect, it } from "vitest";

import { buildReportPdf } from "@/lib/report/pdf.server";
import { electricalInstallationDefinition, snapshotOf } from "@/lib/survey-definitions";
import { regulatoryReferencesOf } from "@/lib/survey-types";
import { decodePageTexts, finding, reportDocument } from "@/lib/__tests__/support/pdf-fixtures";

/**
 * The appendix is where a reader checks the report rather than trusting it: the
 * instruments the findings name, once each, with the instrument's own formal
 * reference, the jurisdiction it applies to and the page it was verified against.
 *
 * Rendered, not just built - the harness below writes a real PDF and reads its text
 * layer back, so this fails if the section stops being drawn.
 */
const APPENDIX_LINE = "The instruments named by the findings in this report.";

describe("the references appendix in the printed report", () => {
  const snapshot = snapshotOf(electricalInstallationDefinition);
  const references = regulatoryReferencesOf(snapshot);
  const bs7671 = references.find((item) => item.id === "bs_7671")!;
  const eawr = references.find((item) => item.id === "eawr_1989")!;

  it("has the detail these assertions depend on", () => {
    expect(bs7671.instrument).toBeTruthy();
    expect(bs7671.jurisdiction).toBeTruthy();
    expect(bs7671.source).toMatch(/^https:\/\//);
    expect(eawr.instrument).toBeTruthy();
  });

  it("prints each cited instrument once, in full, with where it applies and where it was checked", async () => {
    const document = reportDocument(
      [
        finding({ id: "a", ref: "F-001", regulatoryReference: "bs_7671" }),
        // cited twice on purpose: the appendix lists it once
        finding({ id: "b", ref: "F-002", regulatoryReference: "bs_7671" }),
        finding({ id: "c", ref: "F-003", regulatoryReference: "eawr_1989" }),
      ],
      snapshot,
    );

    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = (await decodePageTexts(built.bytes)).join("\n");

    expect(text).toContain(APPENDIX_LINE);

    // The instrument also prints against each finding that cites it, so the appendix
    // is read on its own from here: that is the section being asserted.
    const appendix = text.slice(text.indexOf(APPENDIX_LINE));
    expect(appendix).toContain(bs7671.instrument!);
    expect(appendix).toContain(eawr.instrument!);
    expect(appendix).toContain(bs7671.jurisdiction!);
    // listed once, even though two findings name it
    expect(appendix.split(bs7671.instrument!).length - 1).toBe(1);
    // and the source survives the wrapping a long URL would otherwise be broken by
    expect(appendix.replace(/\s+/g, "")).toContain("legislation.gov.uk");
  });

  it("prints no appendix at all when the report names nothing", async () => {
    const document = reportDocument(
      [finding({ id: "a", ref: "F-001", regulatoryReference: null })],
      snapshot,
    );
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = (await decodePageTexts(built.bytes)).join("\n");

    expect(text).not.toContain(APPENDIX_LINE);
  });

  it("prints no appendix when the report's brief switched references off", async () => {
    const document = reportDocument(
      [finding({ id: "a", ref: "F-001", regulatoryReference: "bs_7671" })],
      snapshot,
      { regulationCitations: false },
    );
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = (await decodePageTexts(built.bytes)).join("\n");

    expect(text).not.toContain(APPENDIX_LINE);
  });
});
