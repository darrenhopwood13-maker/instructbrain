/**
 * Device-local memory of the last brief used, so capture needs no set-up.
 *
 * Kept in one module because two screens read it now: the capture screen writes the
 * brief, and the chooser pins the template that brief used. Two copies of the key
 * would drift the first time either screen is renamed.
 */
export const LAST_BRIEF_KEY = "instructbrain.custom-report.last-brief";

export type StoredBrief = { templateId?: string } & Record<string, unknown>;

function readStored(): StoredBrief | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_BRIEF_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as StoredBrief) : null;
  } catch {
    // A corrupt or unreadable store is not worth a broken screen: no template is
    // pinned, and everything else on the chooser still works.
    return null;
  }
}

/**
 * The template the last brief used, or null.
 *
 * `known` is passed in rather than imported so this module never has to know what
 * the registry is, and a stored id that no longer exists is ignored instead of
 * pinning a template that cannot be started.
 */
export function lastUsedTemplateId(known: readonly string[]): string | null {
  const stored = readStored();
  const id = stored?.["templateId"];
  return typeof id === "string" && known.includes(id) ? id : null;
}
