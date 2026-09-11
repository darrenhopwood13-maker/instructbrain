import { describe, expect, it } from "vitest";
import { brandingPath, resolveLogoPath } from "@/lib/report/branding";

describe("resolveLogoPath", () => {
  it("uses the per-report logo when one is set", () => {
    expect(resolveLogoPath("org/r1/branding/logo.png", "org/logo.png")).toBe(
      "org/r1/branding/logo.png",
    );
  });

  it("falls back to the organisation logo when the report has none", () => {
    expect(resolveLogoPath(null, "org/logo.png")).toBe("org/logo.png");
  });

  it("is null when neither exists", () => {
    expect(resolveLogoPath(null, null)).toBeNull();
    expect(resolveLogoPath(undefined, undefined)).toBeNull();
  });
});

describe("brandingPath", () => {
  it("keeps branding files inside the report's own folder", () => {
    const path = brandingPath("org-1", "report-9", "Client Logo.PNG");
    expect(path.startsWith("org-1/report-9/branding/")).toBe(true);
    expect(path.toLowerCase().endsWith(".png")).toBe(true);
  });
});
