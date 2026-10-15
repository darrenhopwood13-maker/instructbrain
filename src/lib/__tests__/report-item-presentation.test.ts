import { describe, expect, it } from "vitest";

import { buildReportPdf } from "@/lib/report/pdf.server";
import { electricalInstallationDefinition, snapshotOf } from "@/lib/survey-definitions";
import { severitiesOf, statusesOf } from "@/lib/survey-types";
import { decodePageTexts, finding, reportDocument } from "@/lib/__tests__/support/pdf-fixtures";

/**
 * How an item presents itself on paper.
 *
 * Dal, comparing the printed report with the screen: the on-screen viewer "with
 * severity, coloured chart showing ... generally look better than current pdf".
 * The screen gives an item a filled state pill, captions the observation, and
 * breaks the document down by severity; the PDF gave it one coloured sentence
 * in which the status, the severity and the target date all shouted at the same
 * volume, uncaptioned prose, and no breakdown at all.
 *
 * Rendered, not asserted: each case builds a real PDF and reads its text layer
 * back, so this fails if the presentation stops being drawn. The pill's own fill
 * is a vector rectangle, which no text layer can show - that is proven by
 * rendering the document and looking at it, which is what was done.
 */
const PILL_STATUS = "defective_install";

describe("how the printed item presents itself", () => {
  const snapshot = snapshotOf(electricalInstallationDefinition);
  const scale = severitiesOf(snapshot);
  const statuses = statusesOf(snapshot);

  it("has the definitions these assertions depend on", () => {
    expect(scale.length).toBeGreaterThanOrEqual(2);
    expect(statuses.some((status) => status.id === PILL_STATUS)).toBe(true);
    expect(statuses.find((status) => status.id === PILL_STATUS)?.tone).toBe("fail");
  });

  it("prints the state as its own label, not as one coloured sentence", async () => {
    const document = reportDocument(
      [finding({ id: "a", ref: "F-001", statusId: PILL_STATUS })],
      snapshot,
    );
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = (await decodePageTexts(built.bytes)).join("\n");

    const label = statuses.find((status) => status.id === PILL_STATUS)!.label;
    // The engine draws from a standard font, so every em dash in a status label
    // prints as a hyphen right across the document - "Draft - not yet published"
    // on the cover included. That is the report's own typography, not something
    // the pill introduces.
    expect(text).toContain(label.replace(/—/g, "-"));
    // The old run-on line is gone: nothing says "Status:" any more.
    expect(text).not.toContain("Status:");
  });

  it("captions the observation and the action the way the screen does", async () => {
    const document = reportDocument(
      [
        finding({
          id: "a",
          ref: "F-001",
          statusId: PILL_STATUS,
          severityId: scale[0]!.id,
          findingText: "A described defect on the north elevation.",
          remedialText: "Remedial work required.",
        }),
      ],
      snapshot,
    );
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = (await decodePageTexts(built.bytes)).join("\n");

    expect(text).toContain("FINDING");
    expect(text).toContain("REQUIRED ACTION");
    // The detail the pill used to shout is still printed, quietly, in full.
    expect(text).toContain(`Severity: ${scale[0]!.label}`);
  });

  it("breaks the document down by severity, counting only what it prints", async () => {
    const document = reportDocument(
      [
        finding({ id: "a", ref: "F-001", statusId: PILL_STATUS, severityId: scale[0]!.id }),
        finding({ id: "b", ref: "F-002", statusId: PILL_STATUS, severityId: scale[0]!.id }),
        finding({ id: "c", ref: "F-003", statusId: PILL_STATUS, severityId: scale[1]!.id }),
      ],
      snapshot,
    );
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = (await decodePageTexts(built.bytes)).join("\n");

    expect(text).toContain("ITEMS BY SEVERITY");
    expect(text).toContain(`${scale[0]!.label}: 2`);
    expect(text).toContain(`${scale[1]!.label}: 1`);
    // The scale's own order, not the order the items happen to be in.
    expect(text.indexOf(`${scale[0]!.label}: 2`)).toBeLessThan(
      text.indexOf(`${scale[1]!.label}: 1`),
    );
    // A severity nobody recorded is never listed.
    for (const severity of scale.slice(2)) {
      expect(text).not.toContain(`${severity.label}:`);
    }
  });

  it("says so, rather than staying silent, when an item carries no severity", async () => {
    const document = reportDocument(
      [finding({ id: "a", ref: "F-001", statusId: PILL_STATUS, severityId: null })],
      snapshot,
    );
    const built = await buildReportPdf(document, { variant: "full", includePhotos: false });
    const text = (await decodePageTexts(built.bytes)).join("\n");

    expect(text).toContain("ITEMS BY SEVERITY");
    expect(text).toContain("1 item with no severity recorded.");
  });
});
