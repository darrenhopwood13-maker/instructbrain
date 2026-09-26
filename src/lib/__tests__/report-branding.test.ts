import { describe, expect, it } from "vitest";
import { brandingPath, organisationLogoPath, resolveLogoPath } from "@/lib/report/branding";

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

describe("organisationLogoPath", () => {
  it("keeps the logo inside the organisation's own folder", () => {
    const path = organisationLogoPath("org-1", "Client Logo.PNG");
    expect(path).toBe("org-1/organisation/logo.png");
  });

  it("is stable across re-uploads with the same extension so upsert replaces it", () => {
    const first = organisationLogoPath("org-1", "brand-mark-v1.svg");
    const second = organisationLogoPath("org-1", "brand-mark-final.svg");
    expect(first).toBe(second);
  });

  it("keys off the organisation id first, matching the storage RLS policies", () => {
    const path = organisationLogoPath("org-42", "logo.webp");
    expect(path.split("/")[0]).toBe("org-42");
  });

  it("drops an unsafe or missing extension rather than breaking the path", () => {
    expect(organisationLogoPath("org-1", "logo")).toBe("org-1/organisation/logo");
    expect(organisationLogoPath("org-1", "logo.")).toBe("org-1/organisation/logo");
  });
});
