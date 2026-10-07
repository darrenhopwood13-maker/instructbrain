/**
 * The display name on an account: the name a recipient sees on a report extract,
 * a close-out request or an invitation.
 *
 * Kept free of any client so it can be tested on its own, and so the rule that
 * matters lives in one place: an email address is never a person's name. Every
 * send falls back to a human phrase rather than to the address, and this is the
 * field that makes the fallback unnecessary.
 */

export const MAX_DISPLAY_NAME_LENGTH = 60;

/** Trimmed, with runs of inner whitespace collapsed to a single space. */
export function normaliseDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** A plain-English problem, or null when the name is fit to save. */
export function validateDisplayName(value: string): string | null {
  const name = normaliseDisplayName(value);
  if (!name) return "Enter your name, so recipients know who sent the report.";
  if (name.length > MAX_DISPLAY_NAME_LENGTH) {
    return `Keep it to ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`;
  }
  if (name.includes("@")) return "This is your name, not an email address.";
  return null;
}
