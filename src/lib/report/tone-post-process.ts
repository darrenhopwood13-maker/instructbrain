/**
 * Tidy-up applied to the AI's wording AFTER validation and BEFORE persistence.
 *
 * These are wording rules only. Nothing here reads or writes a status, a
 * severity id, a ref, a confidence or any discipline vocabulary, so invariants
 * 1, 4 and 5 are untouched.
 */

/** Impact commentary the house style never wants, whatever the tone. */
const IMPACT_PHRASES = [
  /\bwhich\s+detracts\s+from\s+the\s+[a-z\s]+/gi,
  /\bdetract(?:s|ing)?\s+from\s+the\s+[a-z\s]+/gi,
  /\bspoil(?:s|ing)?\s+the\s+[a-z\s]+/gi,
  /\blet(?:s|ting)?\s+down\s+the\s+[a-z\s]+/gi,
  /\bmar(?:s|ring)?\s+the\s+(?:overall\s+)?[a-z\s]+/gi,
  /\baffect(?:s|ing)?\s+the\s+overall\s+(?:appearance|impression|finish|aesthetic[a-z]*)/gi,
];

function tidy(value: string): string {
  return value
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*\./g, ".")
    .replace(/\.{2,}/g, ".")
    .trim();
}

function capitaliseFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function stripImpactCommentary(value: string): string {
  let out = value;
  for (const pattern of IMPACT_PHRASES) out = out.replace(pattern, "");
  return tidy(out);
}

export function stripFindingLabel(value: string): string {
  return tidy(value.replace(/^\s*(?:finding|observation)\s*(?:\d+)?\s*[:\-—]\s*/i, ""));
}

export function stripLeadingArticle(value: string): string {
  const trimmed = value.trimStart();
  const stripped = trimmed.replace(/^(?:there\s+(?:is|are)\s+(?:an?\s+|some\s+)?|the\s+|an\s+|a\s+)/i, "");
  return capitaliseFirst(tidy(stripped || trimmed));
}

export type ToneRule = "strip-finding-label" | "strip-leading-article";

/** Applied to every tone: the house style has no impact commentary. */
export function applyToneRules(value: string | null | undefined, rules: readonly ToneRule[]): string {
  if (typeof value !== "string" || value.trim() === "") return "";
  let out = stripImpactCommentary(value);
  if (rules.includes("strip-finding-label")) out = stripFindingLabel(out);
  if (rules.includes("strip-leading-article")) out = stripLeadingArticle(out);
  return capitaliseFirst(tidy(out));
}
