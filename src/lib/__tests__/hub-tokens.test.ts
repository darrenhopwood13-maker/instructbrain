import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { REPORT_BRAND } from "@/lib/report/brand";
import { HUB_THEME_COLOUR } from "@/lib/hub/theme";

/**
 * The launcher's colours, and where they are allowed to live.
 *
 * Two rules, and both are the difference between a family and four products that
 * merely look related:
 *
 *  1. Every colour is a theme token in `src/styles.css`, keyed by `data-product`.
 *     A hub component that names a colour has broken the family architecture and
 *     will drift the moment a product changes its accent.
 *  2. The one unavoidable literal - the `theme-color` meta tag, which cannot read
 *     a CSS variable - must equal the family navy. Asserted against
 *     `REPORT_BRAND.navyHex`, so the report, the app chrome and the installed
 *     app's status bar cannot disagree.
 *
 * The four accents are also pinned to the colours the products themselves serve,
 * checked against their live stylesheets on 9 Oct 2026. Changing one here is a
 * deliberate act, not a tidy-up: the tile would otherwise stop matching the
 * product it is selling.
 */

const CSS = readFileSync("src/styles.css", "utf8");

/** Strip comments so a commented-out colour cannot satisfy a scan. */
function executable(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const HUB_SURFACE_FILES = [
  "src/routes/hub.tsx",
  "src/components/hub/family-tile.tsx",
  "src/components/hub/share-sheet-modal.tsx",
  "src/components/hub/product-showcase-sheet.tsx",
];

describe("the family navy", () => {
  it("is the colour the install metadata declares", () => {
    expect(HUB_THEME_COLOUR).toBe(REPORT_BRAND.navyHex);
    expect(HUB_THEME_COLOUR).toBe("#24417B");
  });

  it("is declared in the stylesheet as the family blue", () => {
    // The token, not the value: the launcher reads --brand-blue, so a change to
    // the navy reaches the launcher without touching it.
    expect(CSS).toMatch(/--brand-blue:\s*oklch\(0\.386 0\.105 262\.6\)/);
    expect(CSS).toContain("--hub-navy: var(--brand-blue)");
  });
});

describe("one accent pair per product", () => {
  const pairs: Array<[string, string, string]> = [
    // product, accent (the product's own live colour), pale companion (all text)
    ["brain", "#57ff00", "#d8ffbf"],
    ["site", "#ff770f", "#ffa852"],
    ["enterprise", "#a855f7", "#e9d5ff"],
    ["dabs", "#ffe600", "#fff8b8"],
  ];

  for (const [product, accent, pale] of pairs) {
    it(`declares ${product} with its accent and a pale companion`, () => {
      const block = CSS.match(
        new RegExp(`\\.hub \\[data-product="${product}"\\]\\s*\\{([^}]*)\\}`),
      )?.[1];
      expect(block, `no accent block for ${product}`).toBeTruthy();
      expect(block).toContain(`--hub-accent: ${accent}`);
      expect(block).toContain(`--hub-accent-pale: ${pale}`);
    });
  }

  it("keeps the pale companion strictly paler than the accent it accompanies", () => {
    // The accent fails WCAG on the navy (purple 2.51:1, orange 3.73:1); the pale
    // companion is what carries text. If a pale value ever became darker than
    // its accent, the contrast reasoning has been reversed by accident.
    const luminance = (hex: string) => {
      const channel = (value: number) => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    for (const [, accent, pale] of pairs) {
      expect(luminance(pale)).toBeGreaterThan(luminance(accent));
    }
  });
});

describe("no colour literal in a hub component", () => {
  for (const file of HUB_SURFACE_FILES) {
    it(`${file} names no colour of its own`, () => {
      const source = executable(readFileSync(file, "utf8"));
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/\brgba?\(/);
      expect(source).not.toMatch(/\bhsla?\(/);
    });
  }
});

describe("nothing in the launcher sends anything", () => {
  for (const file of [...HUB_SURFACE_FILES, "src/lib/hub/share.ts"]) {
    it(`${file} has no outbound call`, () => {
      const source = executable(readFileSync(file, "utf8"));
      expect(source).not.toContain("fetch(");
      expect(source).not.toMatch(/resend/i);
      expect(source).not.toMatch(/sendEmail|send_email/);
    });
  }

  it("writes an address to exactly one place, and only for the product that has no site", () => {
    const showcase = executable(
      readFileSync("src/components/hub/product-showcase-sheet.tsx", "utf8"),
    );
    expect(showcase).toContain('const EARLY_ACCESS_TABLE = "hub_early_access"');
    // The only table the showcase touches.
    expect(showcase.match(/\.from\(/g) ?? []).toHaveLength(1);
  });
});

describe("the hub components exist as the brief names them", () => {
  it("has a component per file, registered in the hub directory", () => {
    const files = readdirSync("src/components/hub").sort();
    expect(files).toEqual([
      "family-tile.tsx",
      "product-showcase-sheet.tsx",
      "share-sheet-modal.tsx",
    ]);
  });

  it("keeps the field route's path untouched", () => {
    // The QR codes on site office walls encode /field. A rename breaks them, so
    // the launcher must not have taken that path.
    expect(() => readFileSync("src/routes/_authenticated/field.tsx", "utf8")).not.toThrow();
    expect(readFileSync("src/routes/hub.tsx", "utf8")).not.toContain('"/field"');
  });
});
