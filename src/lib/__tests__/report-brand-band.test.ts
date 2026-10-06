import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The report letterhead is a fixed-identity element: the same band in the
 * preview, on the share link and in print. Reading a *scope* token there is a
 * real defect rather than a style preference.
 *
 * `.paper` deliberately re-points `--brand-accent` to the report navy, so an
 * accent or the sheet foreground inherited into this navy band is navy-on-navy.
 * In the 6 October 2026 screen recording the wordmark's second half measured a
 * contrast ratio of **1.00** against the band — no pixel differed from the
 * background at all — and every report's letterhead read "instruct" and
 * nothing more.
 *
 * These are source assertions on purpose. jsdom does not resolve CSS custom
 * properties, so a rendered-DOM test would pass just as happily against the
 * broken version. A test that cannot go red is not a test.
 */

const view = readFileSync("src/components/report/report-document-view.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");

/** The band's own markup, isolated so a rule elsewhere in the file cannot satisfy it. */
function bandMarkup(): string {
  const start = view.indexOf("manual-report-brand");
  expect(start, "the report cover must still carry the brand band").toBeGreaterThan(-1);
  return view.slice(start, start + 420);
}

describe("the report brand band", () => {
  it("is found at all, so these assertions are not passing on an empty string", () => {
    expect(bandMarkup()).toContain("instruct");
    expect(bandMarkup()).toContain("Brain");
  });

  it("does not take its accent from a token the paper sheet re-points", () => {
    expect(bandMarkup()).not.toContain("text-brand-accent");
    expect(bandMarkup()).not.toContain("border-brand-accent");
  });

  it("does not inherit the sheet's foreground", () => {
    expect(bandMarkup()).not.toContain("text-primary-foreground");
  });

  it("names the accent half explicitly, from the paper-safe slot", () => {
    expect(bandMarkup()).toContain("report-brand-wordmark-accent");
    expect(css).toMatch(
      /\.manual-report-brand\s+\.report-brand-wordmark-accent\s*\{[^}]*var\(--paper-accent/,
    );
  });

  it("states white for the band, so the unaccented half cannot vanish either", () => {
    expect(css).toMatch(/\.manual-report-brand\s*\{[^}]*color:\s*#fff/);
  });

  it("keeps the accent rule on the band, from the same paper-safe slot", () => {
    expect(css).toMatch(/\.manual-report-brand\s*\{[^}]*border-left-color:\s*var\(--paper-accent/);
  });
});
