/**
 * Survey type definition engine.
 *
 * A survey type definition owns EVERY piece of discipline-specific vocabulary:
 * statuses, severity scale, capture fields, category lists, regulatory
 * references, output sections and workflow flags. Shared code reads all of it
 * through this module and never hardcodes a definition id, status id, category
 * id or trade name.
 *
 * Invariant 1: any unknown, null, errored or malformed status resolves to
 * `not_assessed`. It NEVER resolves to a status with tone "pass".
 */

export type StatusTone = "pass" | "fail" | "warn" | "flag" | "neutral";

export type StatusDefinition = {
  id: string;
  label: string;
  tone: StatusTone;
  description?: string;
};

export type SeverityDefinition = {
  id: string;
  label: string;
  guidance?: string;
  targetHours?: number;
};

export type CaptureField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  options?: string[];
  required?: boolean;
  hint?: string;
};

export type CategoryDefinition = {
  id: string;
  label: string;
  defaultTrades?: string[];
  confidential?: boolean;
};

export type ReferenceDefinition = {
  id: string;
  label: string;
};

export type AiGuidance = Record<string, string>;

export type SurveyDefinition = {
  id: string;
  version: number;
  label: string;
  category?: string;
  findingsPerPhoto?: "single" | "multiple";
  statuses: StatusDefinition[];
  severityScale?: SeverityDefinition[];
  captureFields?: CaptureField[];
  /** Generic category list — keyed by whatever the definition provides. */
  hazardCategories?: CategoryDefinition[];
  snagCategories?: CategoryDefinition[];
  regulatoryReferences?: ReferenceDefinition[];
  /** Shared house voice, placed before the type-specific persona. Data, not code. */
  houseVoice?: string;
  aiGuidance?: AiGuidance;
  defaultRemedial?: string;
  outputSections?: string[];
  requiresTradeAssignment?: boolean;
  requiresLifecycle?: boolean;
  supportsDistribution?: boolean;
  defaultDistributionGrouping?: string;
};

/** A definition frozen into a report at creation. Same shape, by design. */
export type SurveyTypeSnapshot = SurveyDefinition;

/** The one status id the engine itself knows about. */
export const NOT_ASSESSED_ID = "not_assessed";

export const NOT_ASSESSED_STATUS: StatusDefinition = {
  id: NOT_ASSESSED_ID,
  label: "Not assessed",
  tone: "flag",
  description:
    "This item could not be assessed automatically and must be resolved by a person before the report can be issued.",
};

const TONES: StatusTone[] = ["pass", "fail", "warn", "flag", "neutral"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStatusDefinition(value: unknown): value is StatusDefinition {
  return isRecord(value) && typeof value["id"] === "string" && typeof value["label"] === "string";
}

/**
 * An unrecognised tone is a definition authoring error, not a neutral value:
 * it must never quietly render as flat grey. It surfaces as `flag`, which is
 * the same treatment `not_assessed` gets — visible, and paired with text.
 */
function normaliseTone(value: unknown): StatusTone {
  return TONES.includes(value as StatusTone) ? (value as StatusTone) : "flag";
}

/**
 * Every status list is guaranteed to contain `not_assessed`, whatever the
 * definition says, and `not_assessed` is always tone "flag".
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

/* ------------------------------------------------------------------ */
/* Definition readers — the only route to discipline-specific values.  */
/* ------------------------------------------------------------------ */

export function definitionLabel(snapshot: SurveyTypeSnapshot | null | undefined): string {
  return typeof snapshot?.label === "string" && snapshot.label.trim() !== ""
    ? snapshot.label
    : "Survey";
}

export function severitiesOf(
  snapshot: SurveyTypeSnapshot | null | undefined,
): SeverityDefinition[] {
  const raw = Array.isArray(snapshot?.severityScale) ? snapshot.severityScale : [];
  return raw.filter(
    (item): item is SeverityDefinition =>
      isRecord(item) && typeof item["id"] === "string" && typeof item["label"] === "string",
  );
}

export function resolveSeverity(
  snapshot: SurveyTypeSnapshot | null | undefined,
  value: unknown,
): SeverityDefinition | null {
  if (typeof value !== "string") return null;
  return severitiesOf(snapshot).find((severity) => severity.id === value.trim()) ?? null;
}

const FIELD_TYPES: CaptureField["type"][] = ["text", "textarea", "select", "number"];

export function captureFieldsOf(
  snapshot: SurveyTypeSnapshot | null | undefined,
): CaptureField[] {
  const raw = Array.isArray(snapshot?.captureFields) ? snapshot.captureFields : [];
  return raw
    .filter(
      (field): field is CaptureField =>
        isRecord(field) && typeof field["id"] === "string" && typeof field["label"] === "string",
    )
    .map((field) => ({
      ...field,
      type: FIELD_TYPES.includes(field.type) ? field.type : "text",
    }));
}

/**
 * Category lists are generic. A definition may call them `hazardCategories`,
 * `snagCategories` or anything else ending in `Categories`; the engine returns
 * each group with its key and its items without knowing the discipline.
 */
export type CategoryGroup = {
  key: string;
  label: string;
  items: CategoryDefinition[];
};

function humaniseKey(key: string): string {
  const withSpaces = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1).toLowerCase();
}

export function categoryGroupsOf(
  snapshot: SurveyTypeSnapshot | null | undefined,
): CategoryGroup[] {
  if (!isRecord(snapshot)) return [];
  const groups: CategoryGroup[] = [];

  for (const [key, value] of Object.entries(snapshot)) {
    if (!key.endsWith("Categories") || !Array.isArray(value)) continue;
    const items = value.filter(
      (item): item is CategoryDefinition =>
        isRecord(item) && typeof item["id"] === "string" && typeof item["label"] === "string",
    );
    if (items.length > 0) groups.push({ key, label: humaniseKey(key), items });
  }
  return groups;
}

export function categoriesOf(
  snapshot: SurveyTypeSnapshot | null | undefined,
): CategoryDefinition[] {
  return categoryGroupsOf(snapshot).flatMap((group) => group.items);
}

export function resolveCategory(
  snapshot: SurveyTypeSnapshot | null | undefined,
  value: unknown,
): CategoryDefinition | null {
  if (typeof value !== "string") return null;
  return categoriesOf(snapshot).find((category) => category.id === value.trim()) ?? null;
}

/** Trades the definition itself suggests, deduplicated, in definition order. */
export function tradesOf(snapshot: SurveyTypeSnapshot | null | undefined): string[] {
  const seen = new Set<string>();
  for (const category of categoriesOf(snapshot)) {
    for (const trade of category.defaultTrades ?? []) {
      if (typeof trade === "string" && trade.trim() !== "") seen.add(trade);
    }
  }
  return [...seen];
}

export function regulatoryReferencesOf(
  snapshot: SurveyTypeSnapshot | null | undefined,
): ReferenceDefinition[] {
  const raw = Array.isArray(snapshot?.regulatoryReferences) ? snapshot.regulatoryReferences : [];
  return raw.filter(
    (item): item is ReferenceDefinition =>
      isRecord(item) && typeof item["id"] === "string" && typeof item["label"] === "string",
  );
}

export function resolveRegulatoryReference(
  snapshot: SurveyTypeSnapshot | null | undefined,
  value: unknown,
): ReferenceDefinition | null {
  if (typeof value !== "string") return null;
  return regulatoryReferencesOf(snapshot).find((ref) => ref.id === value.trim()) ?? null;
}

export function outputSectionsOf(snapshot: SurveyTypeSnapshot | null | undefined): string[] {
  const raw = Array.isArray(snapshot?.outputSections) ? snapshot.outputSections : [];
  return raw.filter((section): section is string => typeof section === "string");
}

export function requiresTradeAssignment(
  snapshot: SurveyTypeSnapshot | null | undefined,
): boolean {
  return snapshot?.requiresTradeAssignment === true;
}

export function requiresLifecycle(snapshot: SurveyTypeSnapshot | null | undefined): boolean {
  return snapshot?.requiresLifecycle === true;
}

export function supportsDistribution(snapshot: SurveyTypeSnapshot | null | undefined): boolean {
  return snapshot?.supportsDistribution === true;
}

export function distributionGrouping(
  snapshot: SurveyTypeSnapshot | null | undefined,
): string | null {
  if (!supportsDistribution(snapshot)) return null;
  return typeof snapshot?.defaultDistributionGrouping === "string"
    ? snapshot.defaultDistributionGrouping
    : null;
}

export function allowsMultipleFindingsPerPhoto(
  snapshot: SurveyTypeSnapshot | null | undefined,
): boolean {
  return snapshot?.findingsPerPhoto === "multiple";
}

export function aiGuidanceOf(
  snapshot: SurveyTypeSnapshot | null | undefined,
): Array<{ key: string; label: string; text: string }> {
  const guidance = isRecord(snapshot?.aiGuidance) ? snapshot.aiGuidance : {};
  return Object.entries(guidance)
    .filter(([, text]) => typeof text === "string" && text.trim() !== "")
    .map(([key, text]) => ({ key, label: humaniseKey(key), text: text as string }));
}

/** The definition's own house voice text, or null. Never invented here. */
export function houseVoiceOf(snapshot: SurveyTypeSnapshot | null | undefined): string | null {
  return typeof snapshot?.houseVoice === "string" && snapshot.houseVoice.trim() !== ""
    ? snapshot.houseVoice
    : null;
}

export function defaultRemedialOf(
  snapshot: SurveyTypeSnapshot | null | undefined,
): string | null {
  return typeof snapshot?.defaultRemedial === "string" ? snapshot.defaultRemedial : null;
}

/**
 * Optional finding fields a definition switches on. Nothing downstream decides
 * for itself whether a discipline records a likely cause or a regulatory
 * reference — the definition does, and the engine reports it.
 */
export type DerivedFieldId = "likely_cause" | "regulatory_reference";

export type DerivedField = {
  id: DerivedFieldId;
  label: string;
  /** The definition's own wording for how the value should be produced. */
  guidance: string | null;
};

export function derivedFieldsOf(
  snapshot: SurveyTypeSnapshot | null | undefined,
): DerivedField[] {
  const guidance = isRecord(snapshot?.aiGuidance) ? snapshot.aiGuidance : {};
  const fields: DerivedField[] = [];

  if (typeof guidance["causeGuidance"] === "string") {
    fields.push({
      id: "likely_cause",
      label: "Likely cause",
      guidance: guidance["causeGuidance"],
    });
  }
  if (regulatoryReferencesOf(snapshot).length > 0) {
    fields.push({
      id: "regulatory_reference",
      label: "Regulatory reference",
      guidance:
        typeof guidance["regulatoryGuidance"] === "string" ? guidance["regulatoryGuidance"] : null,
    });
  }
  return fields;
}

export function definesField(
  snapshot: SurveyTypeSnapshot | null | undefined,
  field: DerivedFieldId,
): boolean {
  return derivedFieldsOf(snapshot).some((derived) => derived.id === field);
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
