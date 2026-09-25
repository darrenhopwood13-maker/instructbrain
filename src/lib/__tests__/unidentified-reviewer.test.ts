import { describe, expect, it } from "vitest";
import { reviewShortcuts, type SurveyTypeSnapshot } from "@/lib/survey-types";
import * as defs from "@/lib/survey-definitions";

describe("unidentified item reviewer", () => {
  it("never gives N or E to a status shortcut, on any template", () => {
    const all = Object.values(defs).filter(
      (value) => typeof value === "object" && value !== null && "statuses" in value,
    );
    expect(all.length).toBeGreaterThan(3);
    for (const definition of all) {
      const keys = reviewShortcuts(definition as unknown as SurveyTypeSnapshot).map((s) => s.key);
      expect(keys).not.toContain("n");
      expect(keys).not.toContain("e");
    }
  });
});
