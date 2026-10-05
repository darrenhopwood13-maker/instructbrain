import {
  aiCaptureFieldsOf,
  NOT_ASSESSED_ID,
  allowsMultipleFindingsPerPhoto,
  definesField,
  regulatoryReferencesOf,
  resolveCategory,
  resolveSeverity,
  resolveStatus,
  statusesOf,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";
import { CONDITION_GRADE_CODES, normaliseConditionGrade } from "@/lib/review/condition-grade";

/**
 * The only part of the brief this module needs: whether the report has been
 * asked to keep one finding per photograph.
 */
export type BriefFindingsRule = { findingsPerPhoto?: string } | null | undefined;

/**
 * The model's output contract.
 *
 * Envelope: { assessable, abstain_reason, observations: [...] }
 * ALWAYS an array, even for definitions that record one finding per
 * photograph — one code path, one schema. Single-finding definitions validate
 * the array to length <= 1.
 */

export type Region = { x: number; y: number; w: number; h: number };

export type Observation = {
  category: string | null;
  status: string | null;
  confidence: number | null;
  finding: string | null;
  snag_title: string | null;
  severity: string | null;
  severity_rationale: string | null;
  remedial: string | null;
  rectification_alt: string | null;
  tradesman_hack: string | null;
  hs_notes: string | null;
  suggested_trade: string | null;
  trade_reasoning: string | null;
  trade_confidence: number | null;
  suggested_grade: string | null;
  grade_confidence: number | null;
  region: Region | null;
  involves_person: boolean;
  likely_cause: string | null;
  regulatory_reference: string | null;
  capture_fields?: Record<string, string> | null;
};

export type Envelope = {
  assessable: boolean;
  abstain_reason: string | null;
  observations: Observation[];
};

/** A finding ready to be written. `ref` and `sequence` are assigned by the caller. */
export type DraftFinding = {
  /** AI-returned values for fields the definition declares; merged into capture_fields on save. */
  ai_capture_fields?: Record<string, string>;
  status: string;
  severity: string | null;
  severity_rationale: string | null;
  hazard_category: string | null;
  finding_text: string | null;
  snag_title: string | null;
  remedial_text: string | null;
  rectification_alt: string | null;
  tradesman_hack: string | null;
  hs_notes: string | null;
  likely_cause: string | null;
  regulatory_reference: string | null;
  ai_suggested_trade: string | null;
  ai_trade_confidence: number | null;
  ai_trade_reasoning: string | null;
  /** The assessment's proposed condition grade, and its confidence beside it. */
  ai_suggested_grade: string | null;
  ai_grade_confidence: number | null;
  ai_confidence: number | null;
  ai_abstain_reason: string | null;
  ai_region: Region | null;
  ai_tier: string | null;
  is_confidential: boolean;
  human_edited: boolean;
  lifecycle_state: string;
};

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaValidationError";
  }
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const REGION_SCHEMA = {
  type: ["object", "null"],
  additionalProperties: false,
  required: ["x", "y", "w", "h"],
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    w: { type: "number" },
    h: { type: "number" },
  },
} as const;

/** Strict JSON schema handed to the provider. Never free-text brace matching. */
export function envelopeJsonSchema(snapshot: SurveyTypeSnapshot) {
  const statusIds = statusesOf(snapshot).map((status) => status.id);
  const references = regulatoryReferencesOf(snapshot).map((reference) => reference.id);

  const properties: Record<string, unknown> = {
    category: { type: ["string", "null"] },
    status: { type: "string", enum: statusIds },
    confidence: { type: "number" },
    finding: { type: ["string", "null"] },
    snag_title: { type: ["string", "null"] },
    severity: { type: ["string", "null"] },
    severity_rationale: { type: ["string", "null"] },
    remedial: { type: ["string", "null"] },
    rectification_alt: { type: ["string", "null"] },
    tradesman_hack: { type: ["string", "null"] },
    hs_notes: { type: ["string", "null"] },
    suggested_trade: { type: ["string", "null"] },
    trade_reasoning: { type: ["string", "null"] },
    trade_confidence: { type: ["number", "null"] },
    // Constrained to the four-tier legend, so the provider cannot return a
    // grade the application would then have to reject.
    suggested_grade: { type: ["string", "null"], enum: [...CONDITION_GRADE_CODES, null] },
    grade_confidence: { type: ["number", "null"] },
    region: REGION_SCHEMA,
    involves_person: { type: "boolean" },
  };

  if (definesField(snapshot, "likely_cause")) {
    properties["likely_cause"] = { type: ["string", "null"] };
  }
  if (definesField(snapshot, "regulatory_reference") && references.length > 0) {
    properties["regulatory_reference"] = { type: ["string", "null"], enum: [...references, null] };
  }
  const aiFields = aiCaptureFieldsOf(snapshot);
  if (aiFields.length > 0) {
    const fieldProps = Object.fromEntries(
      aiFields.map((field) => [field.id, { type: ["string", "null"] }]),
    );
    properties["capture_fields"] = {
      type: "object",
      additionalProperties: false,
      required: Object.keys(fieldProps),
      properties: fieldProps,
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    required: ["assessable", "abstain_reason", "observations"],
    properties: {
      assessable: { type: "boolean" },
      abstain_reason: { type: ["string", "null"] },
      observations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: Object.keys(properties),
          properties,
        },
      },
    },
  } as const;
}

function schemaTypeName(definition: Record<string, unknown>): string {
  const enumValues = definition.enum;
  if (Array.isArray(enumValues)) {
    const named = enumValues.filter((value) => value !== null);
    return named.length > 0 ? named.join(" | ") : "null";
  }
  const declared = definition.type;
  const types = (Array.isArray(declared) ? declared : [declared]).filter(
    (value): value is string => typeof value === "string",
  );
  const nullable = types.includes("null");
  const present = types.filter((value) => value !== "null");
  if (present.length === 1 && present[0] === "object") {
    const properties = definition.properties;
    const keys =
      properties && typeof properties === "object" ? Object.keys(properties as object) : [];
    const body = keys.length > 0 ? `object with keys ${keys.join(", ")}` : "object";
    return nullable ? `${body}, or null` : body;
  }
  const base = present.join(" or ");
  if (!base) return "null";
  return nullable ? `${base}, or null` : base;
}

/**
 * The field names, spelled out in prose, for a provider that cannot be handed a
 * schema.
 *
 * OpenAI, Anthropic and Google each receive the JSON Schema itself, so the key
 * names are enforced by the API and cannot drift. DeepSeek rejects
 * `json_schema`, so its adapter sends `json_object` alone — which leaves the
 * model to infer the key names from the surrounding prose. It does not infer
 * them. Measured on the real snagging prompt with real photographs, every reply
 * named the description `description` and the cause `cause`, so
 * `observation.finding` and `observation.likely_cause` both read as null and the
 * report filled with "The model could not describe this photograph with enough
 * confidence" — a valid envelope, silently missing its content, on 7 of 7
 * photographs.
 *
 * Generated from envelopeJsonSchema rather than written out by hand, so the
 * names the model is given and the names the coercion reads cannot drift apart.
 * A hand-written list would be the same bug waiting to happen again.
 */
export function envelopeFieldGuide(snapshot: SurveyTypeSnapshot): string {
  const schema = envelopeJsonSchema(snapshot) as unknown as {
    properties: Record<string, Record<string, unknown>>;
  };
  const observations = schema.properties.observations as {
    items?: { properties?: Record<string, Record<string, unknown>> };
  };
  const fields = Object.entries(observations.items?.properties ?? {});

  return [
    "The key names below are exact and are part of the contract. A value returned under any other name is discarded, not translated, and the observation is lost.",
    `Top level: ${Object.keys(schema.properties).join(", ")}.`,
    "Each entry of observations — every key is required, and a value you cannot support from the photograph is null:",
    ...fields.map(([key, definition]) => `  ${key} (${schemaTypeName(definition)})`),
    "Describe what you can actually see in `finding`. That is the only key a description is read from.",
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function score(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : null;
}

function region(value: unknown): Region | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const numbers = (["x", "y", "w", "h"] as const).map((key) =>
    typeof raw[key] === "number" && Number.isFinite(raw[key]) ? (raw[key] as number) : null,
  );
  if (numbers.some((entry) => entry === null)) return null;
  const [x, y, w, h] = numbers as number[];
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return { x: clamp(x!), y: clamp(y!), w: clamp(w!), h: clamp(h!) };
}

function captureFields(value: unknown): Record<string, string> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const cleaned = text(entry);
    if (cleaned) out[key] = cleaned;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Turns raw model output into an envelope, or throws. A throw is a schema
 * validation failure and the caller turns it into `not_assessed` — never a pass.
 */
export function parseEnvelope(raw: unknown): Envelope {
  if (typeof raw !== "object" || raw === null) {
    throw new SchemaValidationError("the model returned something that was not an object.");
  }
  const container = raw as Record<string, unknown>;
  if (!Array.isArray(container["observations"])) {
    throw new SchemaValidationError("the model returned no observations array.");
  }

  const observations: Observation[] = container["observations"]
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      category: text(item["category"]),
      status: text(item["status"]),
      confidence: score(item["confidence"]),
      finding: text(item["finding"]) ?? text(item["observation"]),
      snag_title: text(item["snag_title"]),
      severity: text(item["severity"]),
      severity_rationale: text(item["severity_rationale"]),
      remedial: text(item["remedial"]),
      rectification_alt: text(item["rectification_alt"]),
      tradesman_hack: text(item["tradesman_hack"]),
      hs_notes: text(item["hs_notes"]),
      suggested_trade: text(item["suggested_trade"]),
      trade_reasoning: text(item["trade_reasoning"]),
      trade_confidence: score(item["trade_confidence"]),
      suggested_grade: text(item["suggested_grade"]),
      grade_confidence: score(item["grade_confidence"]),
      region: region(item["region"]),
      involves_person: item["involves_person"] === true,
      likely_cause: text(item["likely_cause"]),
      regulatory_reference: text(item["regulatory_reference"]),
      capture_fields: captureFields(item["capture_fields"]),
    }));

  return {
    assessable: container["assessable"] !== false,
    abstain_reason: text(container["abstain_reason"]),
    observations,
  };
}

/* ------------------------------------------------------------------ */
/* Escalation and coercion                                             */
/* ------------------------------------------------------------------ */

/**
 * A false negative on a defect costs far more than the extra tokens, so the
 * escalation tier re-runs anything uncertain, anything abstained, and anything
 * resolving to a fail-tone status.
 */
export function needsEscalation(
  envelope: Envelope,
  snapshot: SurveyTypeSnapshot,
  confidenceThreshold: number,
  brief?: BriefFindingsRule,
): boolean {
  if (!envelope.assessable) return true;
  if (envelope.observations.length === 0 && !allowsMultipleFindingsPerPhoto(snapshot, brief))
    return true;
  return envelope.observations.some((observation) => {
    if (observation.confidence === null || observation.confidence < confidenceThreshold) return true;
    return resolveStatus(snapshot, observation.status).tone === "fail";
  });
}

export type CoerceOptions = {
  confidenceThreshold: number;
  tradeConfidenceThreshold: number;
  tier: string;
};

/**
 * Invariant 1: low confidence, an unrecognised status, an abstention or
 * anything the engine cannot resolve becomes `not_assessed`. Never a pass.
 * Invariant 6: a trade is a suggestion only — `assigned_trade` stays untouched.
 * Invariant 7: an observation involving a person is confidential.
 */
export function toDraftFinding(
  observation: Observation,
  snapshot: SurveyTypeSnapshot,
  options: CoerceOptions,
): DraftFinding {
  const knownStatus = statusesOf(snapshot).some((status) => status.id === observation.status);
  const resolved = resolveStatus(snapshot, observation.status);
  const confident =
    observation.confidence !== null && observation.confidence >= options.confidenceThreshold;

  const status = knownStatus && confident ? resolved.id : NOT_ASSESSED_ID;

  const tradeTrusted =
    observation.trade_confidence !== null &&
    observation.trade_confidence >= options.tradeConfidenceThreshold;

  // An invented reference is discarded, never stored.
  const reference = definesField(snapshot, "regulatory_reference")
    ? (regulatoryReferencesOf(snapshot).find(
        (entry) => entry.id === observation.regulatory_reference,
      )?.id ?? null)
    : null;

  const severity = resolveSeverity(snapshot, observation.severity)?.id ?? null;
  const category = resolveCategory(snapshot, observation.category)?.id ?? null;

  const unresolved = !knownStatus
    ? "the model returned a status this survey type does not define."
    : !confident
      ? "the model's confidence was below the threshold for this survey type."
      : null;

  // Only fields the definition declares are kept; anything else is dropped.
  const declared = aiCaptureFieldsOf(snapshot);
  const aiCaptureFields: Record<string, string> = {};
  if (status !== NOT_ASSESSED_ID) {
    for (const field of declared) {
      const value = observation.capture_fields?.[field.id]?.trim();
      if (value) aiCaptureFields[field.id] = value;
    }
  }

  return {
    ...(Object.keys(aiCaptureFields).length > 0 ? { ai_capture_fields: aiCaptureFields } : {}),
    status,
    severity,
    severity_rationale: observation.severity_rationale,
    hazard_category: category,
    finding_text:
      observation.finding ??
      (status === NOT_ASSESSED_ID
        ? "The model could not describe this photograph with enough confidence. A person must assess it."
        : null),
    snag_title: observation.snag_title,
    remedial_text: observation.remedial,
    rectification_alt: observation.rectification_alt,
    tradesman_hack: observation.tradesman_hack,
    hs_notes: observation.hs_notes,
    likely_cause: definesField(snapshot, "likely_cause") ? observation.likely_cause : null,
    regulatory_reference: reference,
    // The name is kept whatever its confidence. The suggestion and its number
    // travel together and a person decides between them: dropping the name under
    // the threshold left findings reading "no trade" beside a trade confidence of
    // 0.55, which is not a suggestion and is not an answer either.
    ai_suggested_trade: observation.suggested_trade,
    ai_trade_confidence: observation.trade_confidence,
    ai_trade_reasoning: observation.trade_reasoning,
    // The condition grade is the same bargain as the trade, and the same rule
    // applies: the model's answer is kept even when it is unsure, and is never
    // deleted to tidy up a low confidence. The grade and its number travel
    // together, and until a person confirms one this is a suggestion only —
    // `condition_grade` itself is left for the review step to fill.
    ai_suggested_grade: normaliseConditionGrade(observation.suggested_grade),
    ai_grade_confidence: observation.grade_confidence,
    ai_confidence: observation.confidence,
    ai_abstain_reason: unresolved,
    ai_region: observation.region,
    ai_tier: options.tier,
    is_confidential: observation.involves_person === true,
    human_edited: false,
    lifecycle_state: "open",
  };
}

/**
 * Envelope to findings. Single-finding definitions validate the array to
 * length <= 1: an array of two is a schema failure, not a silent truncation.
 */
export function draftsFromEnvelope(
  envelope: Envelope,
  snapshot: SurveyTypeSnapshot,
  options: CoerceOptions,
  brief?: BriefFindingsRule,
): DraftFinding[] {
  const multiple = allowsMultipleFindingsPerPhoto(snapshot, brief);

  if (!envelope.assessable) {
    return [
      notAssessedDraft(
        envelope.abstain_reason ?? "the model could not assess this photograph.",
        options.tier,
        envelope.abstain_reason,
      ),
    ];
  }

  if (!multiple && envelope.observations.length > 1) {
    return [
      notAssessedDraft(
        "the model returned more than one observation for a survey type that records one per photograph.",
        options.tier,
        null,
      ),
    ];
  }

  if (envelope.observations.length === 0) {
    if (multiple) return [];
    return [
      notAssessedDraft("the model returned no observation for this photograph.", options.tier, null),
    ];
  }

  return envelope.observations.map((observation) =>
    toDraftFinding(observation, snapshot, options),
  );
}

/** The finding written when a call errors, times out, abstains or returns nothing usable. */
export function notAssessedDraft(
  reason: string,
  tier: string | null = null,
  abstainReason: string | null = null,
): DraftFinding {
  return {
    status: NOT_ASSESSED_ID,
    severity: null,
    severity_rationale: null,
    hazard_category: null,
    finding_text: `Not assessed automatically: ${reason} A person must assess this photograph before the report can be issued.`,
    snag_title: null,
    remedial_text: null,
    rectification_alt: null,
    tradesman_hack: null,
    hs_notes: null,
    likely_cause: null,
    regulatory_reference: null,
    ai_suggested_trade: null,
    ai_trade_confidence: null,
    ai_trade_reasoning: null,
    ai_suggested_grade: null,
    ai_grade_confidence: null,
    ai_confidence: null,
    ai_abstain_reason: abstainReason ?? reason,
    ai_region: null,
    ai_tier: tier,
    is_confidential: false,
    human_edited: false,
    lifecycle_state: "open",
  };
}
