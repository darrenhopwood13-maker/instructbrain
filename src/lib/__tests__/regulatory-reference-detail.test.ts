import { describe, expect, it } from "vitest";

import { systemDefinitions } from "@/lib/survey-definitions";
import { regulatoryReferencesOf, resolveRegulatoryReference } from "@/lib/survey-types";

/**
 * The reference detail is printed, not generated: the model never sees an instrument's
 * formal reference, its jurisdiction or its source. That makes this data part of what a
 * client reads, so it is held to the same rule as the citation itself - never a clause,
 * a section or a paragraph number.
 */

/**
 * A guard against the obvious shapes of a clause citation, not a parser. Deliberately
 * narrow: "Building Regulations 2010" and "Schedule 1, Part P" are legitimate instrument
 * names, while "reg 6" and "section 3.2" are not legitimate here at all.
 */
const CLAUSE_LIKE =
  /\b(?:reg|regs|regulation|regulations|clause|clauses|section|sections|subsection|para|paragraph|table|annex)\s+\d{1,2}(?!\d)/i;

function allReferences() {
  return systemDefinitions.flatMap((definition) =>
    regulatoryReferencesOf(definition).map((reference) => ({
      definition: definition.id,
      ...reference,
    })),
  );
}

describe("the detail printed against a regulation reference", () => {
  it("covers the catalogue, and only two entries are not published instruments", () => {
    const references = allReferences();
    expect(references.length).toBeGreaterThan(80);
    const bare = [...new Set(references.filter((r) => !r.instrument).map((r) => r.id))].sort();
    // A manufacturer's installation instructions and a project specification are
    // documents about this job, not published instruments. They print under their
    // own name, with no formal reference invented for them.
    expect(bare).toEqual(["manufacturer", "spec"]);
  });

  it("names an instrument with a jurisdiction and a source that can be checked", () => {
    for (const reference of allReferences()) {
      if (!reference.instrument) continue;
      expect(reference.jurisdiction, `${reference.id} has no jurisdiction`).toBeTruthy();
      expect(reference.source, `${reference.id} has no source`).toMatch(/^https:\/\//);
      // the source must be an authority, not somewhere the instrument was mentioned
      expect(reference.source, `${reference.id} points at ${reference.source}`).toMatch(
        /^https:\/\/(www\.)?(legislation\.gov\.uk|gov\.uk|hse\.gov\.uk|bsigroup\.com|landingpage\.bsigroup\.com|knowledge\.bsigroup\.com|nhbc\.co\.uk|electrical\.theiet\.org|publications\.thebesa\.com|thebesa\.com)/,
      );
    }
  });

  it("never carries a clause, section, table or paragraph number", () => {
    for (const reference of allReferences()) {
      const printed = [reference.label, reference.instrument, reference.jurisdiction]
        .filter(Boolean)
        .join(" | ");
      expect(
        CLAUSE_LIKE.test(printed),
        `${reference.id} looks like it names a clause: ${printed}`,
      ).toBe(false);
    }
  });

  it("resolves an id to the detail the report prints", () => {
    const snapshot = systemDefinitions.find((definition) => definition.id === "site_walk");
    expect(snapshot, "site_walk definition is missing").toBeTruthy();
    const resolved = resolveRegulatoryReference(snapshot!, "wah_2005");
    expect(resolved?.label).toBe("Work at Height Regulations 2005");
    expect(resolved?.instrument).toBe("SI 2005/735");
    expect(resolved?.jurisdiction).toBe("Great Britain");
    expect(resolved?.source).toContain("legislation.gov.uk");
  });

  it("hands an unknown id back as null rather than inventing a detail", () => {
    const snapshot = systemDefinitions.find((definition) => definition.id === "site_walk");
    expect(resolveRegulatoryReference(snapshot!, "not_a_real_instrument")).toBeNull();
  });
});
