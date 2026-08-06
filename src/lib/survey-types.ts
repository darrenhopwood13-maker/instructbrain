/**
 * Survey type definitions own every piece of discipline-specific vocabulary.
 * Shared code must never hardcode a status id: statuses are read from the
 * report's `survey_type_snapshot` and `tone` is a styling property only.
 *
 * Invariant 1: any unknown, null, errored or malformed status resolves to
 * `not_assessed`. It NEVER resolves to a status with tone "pass".
 */

export type StatusTone = "pass" | "fail" | "caution" | "neutral" | "unknown";

export type StatusDefinition = {
  id: string;
  label: string;
  tone: StatusTone;
  description?: string;
};

export type CaptureField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  options?: string[];
};

export type SurveyTypeSnapshot = {
  id: string;
  name: string;
  version: number;
  statuses: StatusDefinition[];
  captureFields?: CaptureField[];
  severities?: string[];
  trades?: string[];
  requiresLifecycle?: boolean;
  outputSections?: string[];
};

/** The one status id the engine itself knows about. */
export const NOT_ASSESSED_ID = "not_assessed";

export const NOT_ASSESSED_STATUS: StatusDefinition = {
  id: NOT_ASSESSED_ID,
  label: "Not assessed",
  tone: "unknown",
  description:
    "This item could not be assessed automatically and must be resolved by a person before the report can be issued.",
};

function isStatusDefinition(value: unknown): value is StatusDefinition {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate["id"] === "string" && typeof candidate["label"] === "string";
}

const TONES: StatusTone[] = ["pass", "fail", "caution", "neutral", "unknown"];

function normaliseTone(value: unknown): StatusTone {
  return TONES.includes(value as StatusTone) ? (value as StatusTone) : "neutral";
}

/**
 * Every status list is guaranteed to contain `not_assessed`, whatever the
 * definition says, and `not_assessed` is always tone "unknown".
 */
export function statusesOf(snapshot: SurveyTypeSnapshot | null | undefined): StatusDefinition[] {
  const raw = Array.isArray(snapshot?.statuses) ? snapshot.statuses : [];
  const cleaned: StatusDefinition[] = raw.filter(isStatusDefinition).map((status) =>
    status.id === NOT_ASSESSED_ID
      ? { ...NOT_ASSESSED_STATUS, label: status.label }
      : { ...status, tone: normaliseTone(status.tone) },
  );

  if (!cleaned.some((status) => status.id === NOT_ASSESSED_ID)) {
    cleaned.push(NOT_ASSESSED_STATUS);
  }
  return cleaned;
}

/**
 * Resolve any value — including an AI failure, a null, a number, or a status
 * id from a different discipline — to a status defined by this snapshot.
 * Anything unrecognised becomes `not_assessed`.
 */
export function resolveStatus(
  snapshot: SurveyTypeSnapshot | null | undefined,
  value: unknown,
): StatusDefinition {
  const statuses = statusesOf(snapshot);
  const notAssessed =
    statuses.find((status) => status.id === NOT_ASSESSED_ID) ?? NOT_ASSESSED_STATUS;

  if (typeof value !== "string") return notAssessed;
  const id = value.trim();
  if (id === "") return notAssessed;

  const match = statuses.find((status) => status.id === id);
  return match ?? notAssessed;
}

/** Convenience: the resolved status id, safe to persist. */
export function coerceStatusId(
  snapshot: SurveyTypeSnapshot | null | undefined,
  value: unknown,
): string {
  return resolveStatus(snapshot, value).id;
}

export function isNotAssessed(
  snapshot: SurveyTypeSnapshot | null | undefined,
  value: unknown,
): boolean {
  return resolveStatus(snapshot, value).id === NOT_ASSESSED_ID;
}

/** Statuses a reviewer can choose, with a single-key shortcut each. */
export function reviewShortcuts(
  snapshot: SurveyTypeSnapshot | null | undefined,
): Array<{ key: string; status: StatusDefinition }> {
  const used = new Set(["j", "k"]);
  const shortcuts: Array<{ key: string; status: StatusDefinition }> = [];

  for (const status of statusesOf(snapshot)) {
    let key = "";
    for (const character of status.label.toLowerCase()) {
      if (character >= "a" && character <= "z" && !used.has(character)) {
        key = character;
        break;
      }
    }
    if (key) used.add(key);
    shortcuts.push({ key, status });
  }
  return shortcuts;
}
