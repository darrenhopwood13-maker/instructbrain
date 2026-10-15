import { describe, expect, it } from "vitest";

import { systemDefinitions } from "@/lib/survey-definitions";
import { citedReferencesOf } from "@/lib/survey-types";

const siteWalk = systemDefinitions.find((definition) => definition.id === "site_walk")!;
/** BS 7671 is carried by the electrical template, not by snagging or the site walk. */
const electrical = systemDefinitions.find(
  (definition) => definition.id === "electrical_installation",
)!;

const finding = (regulatoryReference: string | null) => ({ regulatoryReference });

describe("the references a report actually cites", () => {
  it("lists each cited instrument once, in the order it is first cited", () => {
    const cited = citedReferencesOf(siteWalk, [
      finding("wah_2005"),
      finding("hswa_1974"),
      finding("wah_2005"),
      finding(null),
      finding("hswa_1974"),
    ]);
    expect(cited.map((reference) => reference.id)).toEqual(["wah_2005", "hswa_1974"]);
  });

  it("carries the detail a reader needs to check it", () => {
    const cited = citedReferencesOf(electrical, [finding("bs_7671")]);
    expect(cited).toHaveLength(1);
    const first = cited[0]!;
    expect(first.label).toContain("BS 7671");
    expect(first.instrument).toBe("BS 7671:2018+A4:2026");
    expect(first.jurisdiction).toBe("UK");
    expect(first.source).toMatch(/^https:\/\//);
  });

  it("prints nothing when nothing is cited", () => {
    expect(citedReferencesOf(siteWalk, [])).toEqual([]);
    expect(citedReferencesOf(siteWalk, [finding(null), finding("")])).toEqual([]);
  });

  it("leaves out an instrument the template does not carry, rather than guessing", () => {
    // HSR25 is on the electrical template, not on the site walk's list
    expect(citedReferencesOf(siteWalk, [finding("hsr25")])).toEqual([]);
    expect(citedReferencesOf(null, [finding("wah_2005")])).toEqual([]);
  });

  it("tolerates whitespace around a stored id", () => {
    const cited = citedReferencesOf(siteWalk, [finding("  wah_2005  ")]);
    expect(cited.map((reference) => reference.id)).toEqual(["wah_2005"]);
  });
});
