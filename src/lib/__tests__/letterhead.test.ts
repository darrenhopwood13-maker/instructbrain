import { describe, expect, it } from "vitest";

import { definitionEyebrow } from "@/lib/report/letterhead";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

const snapshot = (label: string): SurveyTypeSnapshot =>
  ({ label }) as unknown as SurveyTypeSnapshot;

const FINDING = snapshot("Finding identification & remedial schedule");

describe("definitionEyebrow", () => {
  it("stays silent when the automatic title already states the template", () => {
    // The automatic title is `${label} — ${project / date}`: the eyebrow would be a repeat.
    expect(
      definitionEyebrow("Finding identification & remedial schedule — 13 Bruton Street", FINDING),
    ).toBe("");
    expect(
      definitionEyebrow("Finding identification & remedial schedule — 6 Oct 2026", FINDING),
    ).toBe("");
  });

  it("ignores case and repeated spaces when comparing", () => {
    expect(
      definitionEyebrow("  finding   IDENTIFICATION & REMEDIAL SCHEDULE — 13 Bruton Street ", FINDING),
    ).toBe("");
  });

  it("keeps the eyebrow when the title does not name the template", () => {
    expect(definitionEyebrow("13 Bruton Street — photo update", FINDING)).toBe(
      "Finding identification & remedial schedule",
    );
    expect(definitionEyebrow("Week 3 walk", FINDING)).toBe(
      "Finding identification & remedial schedule",
    );
  });

  it("keeps the eyebrow for an older title that still says Snag", () => {
    // Reports raised before the relabel keep their own title; the eyebrow is the
    // only place the current template name appears, so it must stay.
    expect(definitionEyebrow("Snag identification & remedial schedule — 2 Oct 2026", FINDING)).toBe(
      "Finding identification & remedial schedule",
    );
  });

  it("falls back to the label when there is no title at all", () => {
    expect(definitionEyebrow("", FINDING)).toBe("Finding identification & remedial schedule");
    expect(definitionEyebrow(null, FINDING)).toBe("Finding identification & remedial schedule");
  });

  it("says Survey when the snapshot carries no label, exactly as definitionLabel does", () => {
    expect(definitionEyebrow("", null)).toBe("Survey");
    expect(definitionEyebrow("Anything", null)).toBe("Survey");
  });
});
