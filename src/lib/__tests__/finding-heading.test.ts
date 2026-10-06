import { describe, expect, it } from "vitest";
import { HEADING_MAX_CHARS, findingHeading } from "@/lib/data";

/**
 * A finding heading is a LABEL. It used to be the first line of `finding_text`
 * while the whole of `finding_text` rendered again underneath as the
 * description, so a one-paragraph observation — which is what the model usually
 * writes — printed the same sentence twice on the same card, on every report.
 *
 * The load-bearing assertion is the first one: the heading must never be the
 * whole observation, because that is precisely what made the two identical.
 */

const OBSERVATION =
  "The temporary stair up to the raised slab is propped at its base on loose timber offcuts and what appear to be bricks.";

describe("findingHeading", () => {
  it("never lets the whole observation become the heading", () => {
    const heading = findingHeading({ findingText: OBSERVATION });
    expect(heading).not.toBe(OBSERVATION);
    expect(heading.length).toBeLessThanOrEqual(HEADING_MAX_CHARS);
    expect(heading.endsWith("…")).toBe(true);
  });

  it("prefers the assessment's own title when it wrote one", () => {
    expect(findingHeading({ snagTitle: "Rusted handrail", findingText: OBSERVATION })).toBe(
      "Rusted handrail",
    );
  });

  it("ignores a title that is only whitespace and falls back to the body", () => {
    const heading = findingHeading({ snagTitle: "   ", findingText: "Loose coping stone" });
    expect(heading).toBe("Loose coping stone");
  });

  it("always returns a single line, whatever the body contained", () => {
    const heading = findingHeading({
      findingText: "First line\n\n  second   line\tthird line",
    });
    expect(heading).toBe("First line second line third line");
  });

  it("respects the budget exactly at the boundary, and only then shortens", () => {
    const atBudget = "a".repeat(HEADING_MAX_CHARS);
    expect(findingHeading({ findingText: atBudget })).toBe(atBudget);

    const overBudget = "a".repeat(HEADING_MAX_CHARS + 1);
    const shortened = findingHeading({ findingText: overBudget });
    expect(shortened.length).toBeLessThanOrEqual(HEADING_MAX_CHARS);
    expect(shortened.endsWith("…")).toBe(true);
  });

  it("does not leave a dangling space or comma before the ellipsis", () => {
    const heading = findingHeading({ findingText: `${"word ".repeat(30)}end` });
    expect(heading.endsWith(" …")).toBe(false);
    expect(/[\s,;:.]…$/.test(heading)).toBe(false);
  });

  it("bounds a title that is itself too long", () => {
    const heading = findingHeading({ snagTitle: "b".repeat(200) });
    expect(heading.length).toBeLessThanOrEqual(HEADING_MAX_CHARS);
  });

  it("says something when there is nothing at all", () => {
    expect(findingHeading({})).toBe("Finding awaiting description");
    expect(findingHeading({ findingText: null, snagTitle: null })).toBe(
      "Finding awaiting description",
    );
  });
});
