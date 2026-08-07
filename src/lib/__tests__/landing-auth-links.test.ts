import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const landing = readFileSync(resolve(process.cwd(), "src/routes/index.tsx"), "utf8");
const auth = readFileSync(resolve(process.cwd(), "src/lib/auth.ts"), "utf8");

/** Extracts the className strings of every <Link to="/auth/sign-in"> block. */
function signInLinkBlocks(source: string): string[] {
  const blocks: string[] = [];
  const re = /<Link\b[\s\S]{0,400}?to="\/auth\/sign-in"[\s\S]{0,400}?>/g;
  for (const m of source.matchAll(re)) blocks.push(m[0]);
  return blocks;
}

describe("landing page auth links", () => {
  it("renders at least one link to /auth/sign-in", () => {
    expect(signInLinkBlocks(landing).length).toBeGreaterThan(0);
  });

  it("never hides a sign-in link behind a responsive breakpoint", () => {
    for (const block of signInLinkBlocks(landing)) {
      expect(block).not.toMatch(/className="[^"]*\bhidden\b/);
      expect(block).not.toMatch(/\b(sm|md|lg):inline-flex\b/);
    }
  });
});

describe("auth redirects", () => {
  it("builds every redirect from the SITE_URL helper, never window.location.origin", () => {
    expect(auth).not.toContain("window.location.origin");
    expect(auth).toContain('absoluteUrl("/auth/callback")');
    expect(auth).toContain('absoluteUrl("/auth/reset-password")');
  });
});
