import { describe, expect, it } from "vitest";

import { buildReportPdf } from "@/lib/report/pdf.server";
import { siteWalkDefinition, snapshotOf, systemDefinitions } from "@/lib/survey-definitions";
import { decodePageTexts, finding, reportDocument } from "@/lib/__tests__/support/pdf-fixtures";

/**
 * The index: a branded sheet straight after the cover saying what is in the document
 * and which page each item begins on.
 *
 * The page numbers are the part worth testing. They are only right if the sheet was
 * reserved before the body was laid out, so these assertions fail if that ordering
 * ever changes.
 */
type Findings = Parameters<typeof reportDocument>[0];

async function pagesOf(findings: Findings, snapshot = snapshotOf(siteWalkDefinition)) {
  const built = await buildReportPdf(reportDocument(findings, snapshot), {
    variant: "full",
    includePhotos: false,
  });
  return decodePageTexts(built.bytes);
}

async function pagesOfVariant(findings: Findings, variant: "item" | "trade") {
  const built = await buildReportPdf(reportDocument(findings), { variant, includePhotos: false });
  return decodePageTexts(built.bytes);
}

describe("the index page", () => {
  const two = () => [
    finding({ id: "a", ref: "F-001", findingText: "Loose handrail to the stair core" }),
    finding({
      id: "b",
      ref: "F-002",
      findingText: "Missing edge protection at level 2",
      assignedTrade: "Groundworks",
    }),
  ];

  it("comes straight after the cover and says what is in the document", async () => {
    const pages = await pagesOf(two());
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(pages[0]).not.toContain("Index");
    expect(pages[1]).toContain("Index");
    expect(pages[1]).toContain("F-001");
    expect(pages[1]).toContain("F-002");
    expect(pages[1]).toContain("Loose handrail to the stair core");
    expect(pages[1]).toContain("Groundworks");
  });

  it("gives each item the page it really begins on", async () => {
    const pages = await pagesOf(two());
    const index = pages[1] ?? "";
    // the results section is the sheet the items are written up on
    const resultsSheet = pages.findIndex((page) => page.includes("RESULTS"));
    expect(resultsSheet).toBeGreaterThan(1);
    // the number drawn against the entry must be that sheet, one-based as printed
    const after = index.slice(index.indexOf("F-001") + "F-001".length);
    expect(Number(after.match(/(\d+)/)?.[1])).toBe(resultsSheet + 1);
  });

  it("spills onto further sheets when the document is long, losing nothing", async () => {
    const many = Array.from({ length: 35 }, (_, index) =>
      finding({
        id: `f${index}`,
        ref: `F-${String(index + 1).padStart(3, "0")}`,
        findingText: `Item ${index + 1}`,
      }),
    );
    const pages = await pagesOf(many);
    expect(pages[1]).toContain("Index");
    expect(pages[2]).toContain("Index");
    expect(pages[1]).toContain("F-001");
    expect(pages[2]).toContain("F-035");
  });

  it("gives the references section a row of its own when something is cited", async () => {
    const pages = await pagesOf([
      finding({ id: "a", ref: "F-001", regulatoryReference: "wah_2005" }),
    ]);
    expect(pages[1]).toContain("Index");
    expect(pages[1]).toContain("References");
  });

  it("is left off the manual photographic report", async () => {
    const manual = systemDefinitions.find((definition) => definition.id === "manual_photo_report");
    expect(manual).toBeTruthy();
    const pages = await pagesOf([finding({ id: "a", ref: "F-001" })], snapshotOf(manual!));
    expect(pages.some((page) => page.includes("Index"))).toBe(false);
  });

  it("is left off an extract, which is not read from an index", async () => {
    const pages = await pagesOfVariant([finding({ id: "a", ref: "F-001" })], "item");
    expect(pages.some((page) => page.includes("Index"))).toBe(false);
  });
});
