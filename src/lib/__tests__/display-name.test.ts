import { describe, expect, it } from "vitest";
import {
  MAX_DISPLAY_NAME_LENGTH,
  normaliseDisplayName,
  validateDisplayName,
} from "@/lib/display-name";

describe("display name", () => {
  it("trims and collapses whitespace to a single space", () => {
    expect(normaliseDisplayName("  Darren   Hopwood  ")).toBe("Darren Hopwood");
    expect(validateDisplayName("  Darren   Hopwood  ")).toBeNull();
  });

  it("refuses an empty name, rather than saving a blank", () => {
    expect(validateDisplayName("")).toMatch(/enter your name/i);
    expect(validateDisplayName("   ")).toMatch(/enter your name/i);
  });

  it("refuses an email address: an address is not a name", () => {
    expect(validateDisplayName("darrenhopwood13@gmail.com")).toMatch(/not an email address/i);
    expect(validateDisplayName("Darren <darren@example.com>")).toMatch(/not an email address/i);
  });

  it("allows a name up to the limit and no further", () => {
    expect(validateDisplayName("a".repeat(MAX_DISPLAY_NAME_LENGTH))).toBeNull();
    expect(validateDisplayName("a".repeat(MAX_DISPLAY_NAME_LENGTH + 1))).toMatch(
      /characters or fewer/i,
    );
  });
});
