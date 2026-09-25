import { describe, expect, it } from "vitest";
import { reviewShortcuts, type SurveyTypeSnapshot } from "@/lib/survey-types";
import { getSurveyDefinition } from "@/lib/survey-definitions";

describe("unidentified item reviewer", () => {
  it("never gives N or E to a status shortcut, on any template", () => {
    for (const id of ["property_inventory", "snagging", "site_walk", "weatherproofing"]) {
      const snapshot = getSurveyDefinition(id) as unknown as SurveyTypeSnapshot | undefined;
      if (!snapshot) continue;
      const keys = reviewShortcuts(snapshot).map((s) => s.key);
      expect(keys).not.toContain("n");
      expect(keys).not.toContain("e");
    }
  });
});
