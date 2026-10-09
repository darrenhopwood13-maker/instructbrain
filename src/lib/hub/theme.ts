/**
 * The installed app's chrome colour.
 *
 * This is the only colour literal in the launcher, and it exists because a
 * `theme-color` meta tag cannot read a CSS custom property — the browser wants
 * a value before any stylesheet has been parsed.
 *
 * It MUST stay equal to the family navy, `--brand-blue` in `src/styles.css`
 * (`oklch(0.386 0.105 262.6)`, which resolves to exactly this hex). A test
 * asserts the two agree, so this cannot drift quietly. Every OTHER colour in
 * the launcher is a theme token.
 */
export const HUB_THEME_COLOUR = "#24417B";

/**
 * The QR code's two colours.
 *
 * Here rather than in the component because a QR code is not styled: it needs
 * near-black modules on white with real quiet zone or a phone camera will not
 * read it in poor light. That makes it a scannability constraint, not a brand
 * one - and it is the only other colour literal in the launcher, so it lives in
 * this one file where it can be seen and changed deliberately.
 */
export const HUB_QR_DARK = "#101828";
export const HUB_QR_LIGHT = "#FFFFFF";

