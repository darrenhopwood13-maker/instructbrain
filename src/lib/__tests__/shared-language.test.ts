import { describe, expect, it } from "vitest";
import { overlayFindingRows, overlayReportRow } from "@/lib/i18n/overlay-rows.server";

describe("shared link output language", () => {
  const report = {
    id: "r1",
    title: "Roof survey",
    subtitle: null,
    scope_text: "Scope in English",
    methodology_text: null,
    executive_summary: "Summary in English",
  };
  const findings = [
    {
      id: "f1",
      finding_text: "Cracked tile",
      remedial_text: "Replace tile",
      likely_cause: null,
      regulatory_reference: null,
    },
  ];

  it("leaves an English report untouched", () => {
    expect(overlayReportRow(report, {})).toEqual(report);
    expect(overlayFindingRows(findings, {})).toEqual(findings);
  });

  it("presents the translation without altering the stored rows", () => {
    const strings = {
      "report.title": "Przeglad dachu",
      "report.scope_text": "Zakres",
      "f1.finding_text": "Peknieta dachowka",
    };
    const out = overlayReportRow(report, strings);
    const outFindings = overlayFindingRows(findings, strings);

    expect(out.title).toBe("Przeglad dachu");
    expect(out.scope_text).toBe("Zakres");
    // Not translated, so the English record shows through.
    expect(out.executive_summary).toBe("Summary in English");
    expect(outFindings[0]!.finding_text).toBe("Peknieta dachowka");
    expect(outFindings[0]!.remedial_text).toBe("Replace tile");

    // The source rows are never mutated.
    expect(report.title).toBe("Roof survey");
    expect(findings[0]!.finding_text).toBe("Cracked tile");
  });
});
