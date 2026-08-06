import {
  NOT_ASSESSED_ID,
  resolveStatus,
  statusesOf,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";

/**
 * The model's output contract. ALWAYS an array of observations, even for
 * definitions that only ever hold one finding per photograph — one code path,
 * one schema. Single-finding definitions validate the array to length <= 1.
 */
export type Observation = {
  status: string | null;
  confidence: number | null;
  category: string | null;
  severity: string | null;
  observation: string | null;
  remedial: string | null;
  likely_cause: string | null;
  regulatory_reference: string | null;
  suggested_trade: string | null;
  trade_confidence: number | null;
  trade_reasoning: string | null;
  involves_person: boolean | null;
};

/** A finding ready to be written. `ref` and `sequence` are assigned by the caller. */
export type DraftFinding = {
  status: string;
  severity: string | null;
  hazard_category: string | null;
  finding_text: string | null;
  remedial_text: string | null;
  likely_cause: string | null;
  regulatory_reference: string | null;
  ai_suggested_trade: string | null;
  ai_trade_confidence: number | null;
  ai_trade_reasoning: string | null;
  ai_confidence: number | null;
  is_confidential: boolean;
  human_edited: boolean;
  lifecycle_state: string;
};

/** Strict JSON schema handed to the provider. No free-text brace matching. */
export function observationJsonSchema(snapshot: SurveyTypeSnapshot) {
  const statusIds = statusesOf(snapshot).map((status) => status.id);
  return {
    type: "object",
    additionalProperties: false,
    required: ["observations"],
    properties: {
      observations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "status",
            "confidence",
            "category",
            "severity",
            "observation",
            "remedial",
            "likely_cause",
            "regulatory_reference",
            "suggested_trade",
            "trade_confidence",
            "trade_reasoning",
            "involves_person",
          ],
          properties: {
            status: { type: "string", enum: statusIds },
            confidence: { type: ["number", "null"] },
            category: { type: ["string", "null"] },
            severity: { type: ["string", "null"] },
            observation: { type: ["string", "null"] },
            remedial: { type: ["string", "null"] },
            likely_cause: { type: ["string", "null"] },
            regulatory_reference: { type: ["string", "null"] },
            suggested_trade: { type: ["string", "null"] },
            trade_confidence: { type: ["number", "null"] },
            trade_reasoning: { type: ["string", "null"] },
            involves_person: { type: ["boolean", "null"] },
          },
        },
      },
    },
  } as const;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function score(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : null;
}

/** Anything that is not a well-formed observation array yields an empty list. */
export function parseObservations(raw: unknown): Observation[] {
  const container =
    typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(container["observations"]) ? container["observations"] : [];
  return list
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      status: text(item["status"]),
      confidence: score(item["confidence"]),
      category: text(item["category"]),
      severity: text(item["severity"]),
      observation: text(item["observation"]),
      remedial: text(item["remedial"]),
      likely_cause: text(item["likely_cause"]),
      regulatory_reference: text(item["regulatory_reference"]),
      suggested_trade: text(item["suggested_trade"]),
      trade_confidence: score(item["trade_confidence"]),
      trade_reasoning: text(item["trade_reasoning"]),
      involves_person: typeof item["involves_person"] === "boolean" ? item["involves_person"] : null,
    }));
}

/**
 * Invariant 1: low confidence, an unrecognised status, or anything the engine
 * cannot resolve becomes `not_assessed`. Never a passing status.
 * Invariant 6: a trade is only ever a suggestion — `assigned_trade` is left
 * untouched for a human.
 * Invariant 7: an observation involving a person is confidential.
 */
export function toDraftFinding(
  observation: Observation,
  snapshot: SurveyTypeSnapshot,
  options: { confidenceThreshold: number; tradeConfidenceThreshold: number },
): DraftFinding {
  const resolved = resolveStatus(snapshot, observation.status);
  const confident =
    observation.confidence !== null && observation.confidence >= options.confidenceThreshold;
  const status = confident ? resolved.id : NOT_ASSESSED_ID;

  const tradeTrusted =
    observation.trade_confidence !== null &&
    observation.trade_confidence >= options.tradeConfidenceThreshold;

  const involvesPerson = observation.involves_person === true;

  return {
    status,
    severity: observation.severity,
    hazard_category: observation.category,
    finding_text:
      observation.observation ??
      (status === NOT_ASSESSED_ID
        ? "The model could not describe this photograph with enough confidence. A person must assess it."
        : null),
    remedial_text: observation.remedial,
    likely_cause: observation.likely_cause,
    regulatory_reference: observation.regulatory_reference,
    ai_suggested_trade: tradeTrusted ? observation.suggested_trade : null,
    ai_trade_confidence: observation.trade_confidence,
    ai_trade_reasoning: observation.trade_reasoning,
    ai_confidence: observation.confidence,
    is_confidential: involvesPerson,
    human_edited: false,
    lifecycle_state: "open",
  };
}

/** The finding written when a call errors, times out, or returns nothing usable. */
export function notAssessedDraft(reason: string): DraftFinding {
  return {
    status: NOT_ASSESSED_ID,
    severity: null,
    hazard_category: null,
    finding_text: `Not assessed automatically: ${reason} A person must assess this photograph before the report can be issued.`,
    remedial_text: null,
    likely_cause: null,
    regulatory_reference: null,
    ai_suggested_trade: null,
    ai_trade_confidence: null,
    ai_trade_reasoning: null,
    ai_confidence: null,
    is_confidential: false,
    human_edited: false,
    lifecycle_state: "open",
  };
}
