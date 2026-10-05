/**
 * The one instructBrain report palette.
 *
 * Issued and `manualOnly` PDF/print output keeps this fixed navy/white/accent
 * identity rather than picking up a customer organisation's `brandColour`
 * override (see AGENTS.md). That override is gated to editable reports in
 * `report-document-view.tsx`; it never reaches this palette.
 *
 * A sibling Instruct product that shares this report style swaps the accent in
 * exactly one place: `REPORT_BRAND.accentHex` / `accentRgb` here, paired with
 * the single accent slot `--product-accent` in `src/styles.css` (which the app's
 * `--brand-accent` and the report's `--paper-accent` both derive from). Nothing
 * in the renderer restates the colour.
 */
import { BRAND_CREDIT } from "@/lib/brand";

/**
 * The accent is stated once per required representation: the hex for text and
 * HTML surfaces, and the same colour as a pdf-lib RGB triple (0-1 channels) so
 * a draw call receives it without any further conversion.
 */
export const REPORT_BRAND = {
  /** instructBrain Laser Green — the product accent slot. */
  accentHex: "#57FF00",
  accentRgb: [87 / 255, 1, 0],
  /** Fixed report navy. */
  navyHex: "#24417B",
  navyRgb: [36 / 255, 65 / 255, 123 / 255],
  /** Document neutrals. */
  inkRgb: [0.06, 0.11, 0.2],
  mutedRgb: [0.35, 0.39, 0.47],
  ruleRgb: [0.85, 0.87, 0.91],
  paperWhiteRgb: [250 / 255, 250 / 255, 250 / 255],
  credit: BRAND_CREDIT,
} as const;

/**
 * The fixed instructBrain identity carried on issued and `manualOnly` output.
 * Derived from `REPORT_BRAND`, so the accent hex lives in one place; the shape
 * is kept exact because report tests assert precisely these keys.
 */
export const MANUAL_REPORT_BRAND = {
  accentHex: REPORT_BRAND.accentHex,
  navyHex: REPORT_BRAND.navyHex,
  credit: REPORT_BRAND.credit,
} as const;
