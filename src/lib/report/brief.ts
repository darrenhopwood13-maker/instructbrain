/**
 * The Custom Reports brief: preset, tone and a free-text special request.
 *
 * Invariant 5 still holds here. Nothing in this module names a discipline, a
 * status, a trade or a defect — the brief only shapes HOW the assessment is
 * written, never WHAT vocabulary is available. Every discipline word still
 * comes out of the survey type snapshot.
 */

export const REPORT_TONES = [
  {
    id: "factual",
    label: "Factual",
    description: "Short, plain, no interpretation beyond what is visible.",
    instruction:
      "Write in short declarative sentences. State what is visible and nothing more. No adjectives of judgement, no recommendations beyond the remedial guidance the survey type defines.",
    maxOutputTokens: 3000,
    escalate: false,
  },
  {
    id: "client",
    label: "Client-facing",
    description: "Readable by a non-specialist client, still formal.",
    instruction:
      "Write so a client who is not a construction professional can follow it. Expand abbreviations on first use. Keep the register formal and unemotional; this text is issued as part of a document to a client.",
    maxOutputTokens: 4500,
    escalate: true,
  },
  {
    id: "technical",
    label: "Detailed technical",
    description: "Fuller technical description for a specialist reader.",
    instruction:
      "Write for a chartered surveyor or specialist contractor. Describe the observed condition precisely, including location within the photograph, materials and extent where they are visible. Do not speculate beyond the photograph.",
    maxOutputTokens: 6000,
    escalate: true,
  },
] as const;

export type ReportTone = (typeof REPORT_TONES)[number];
export type ReportToneId = ReportTone["id"];

export const DEFAULT_TONE_ID: ReportToneId = "factual";

export function toneById(id: string | null | undefined): ReportTone {
  return REPORT_TONES.find((tone) => tone.id === id) ?? REPORT_TONES[0];
}

/**
 * Presets are starting points, not survey types. They carry a tone and a
 * suggested special request; the survey type still supplies the vocabulary.
 */
export const REPORT_PRESETS = [
  {
    id: "record",
    label: "Photographic record",
    description: "A dated record of what was seen. Minimal commentary.",
    tone: "factual" as ReportToneId,
    specialRequest: "",
  },
  {
    id: "handover",
    label: "Handover pack",
    description: "For issue to a client at handover.",
    tone: "client" as ReportToneId,
    specialRequest: "Flag anything that would affect handover or occupation.",
  },
  {
    id: "technical",
    label: "Technical assessment",
    description: "Fuller technical detail for a specialist reader.",
    tone: "technical" as ReportToneId,
    specialRequest: "",
  },
  {
    id: "blank",
    label: "Start blank",
    description: "No preset. Choose your own tone and request.",
    tone: "factual" as ReportToneId,
    specialRequest: "",
  },
] as const;

export type ReportPreset = (typeof REPORT_PRESETS)[number];

export function presetById(id: string | null | undefined): ReportPreset | null {
  return REPORT_PRESETS.find((preset) => preset.id === id) ?? null;
}

export type ReportBrief = {
  presetId: string | null;
  tone: ReportToneId;
  specialRequest: string;
  /** Snapshot of every survey type this report covers, keyed by definition id. */
  surveyTypes?: Array<{ id: string; label: string }>;
};

export const EMPTY_BRIEF: ReportBrief = {
  presetId: null,
  tone: DEFAULT_TONE_ID,
  specialRequest: "",
  surveyTypes: [],
};

/** A free-text request must never be able to rewrite the status rules. */
const SPECIAL_REQUEST_LIMIT = 500;

export function sanitiseSpecialRequest(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, SPECIAL_REQUEST_LIMIT);
}

export function coerceBrief(value: unknown): ReportBrief | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const surveyTypes = Array.isArray(raw["surveyTypes"])
    ? (raw["surveyTypes"] as unknown[])
        .map((entry) => {
          if (typeof entry !== "object" || entry === null) return null;
          const item = entry as Record<string, unknown>;
          return typeof item["id"] === "string" && typeof item["label"] === "string"
            ? { id: item["id"], label: item["label"] }
            : null;
        })
        .filter((entry): entry is { id: string; label: string } => entry !== null)
    : [];
  return {
    presetId: typeof raw["presetId"] === "string" ? raw["presetId"] : null,
    tone: toneById(typeof raw["tone"] === "string" ? raw["tone"] : null).id,
    specialRequest: sanitiseSpecialRequest(
      typeof raw["specialRequest"] === "string" ? raw["specialRequest"] : "",
    ),
    surveyTypes,
  };
}

/**
 * The text appended to the system prompt. The special request is presented as
 * emphasis only — it can never authorise a pass, so invariant 1 is untouched.
 */
export function briefPromptSection(brief: ReportBrief | null): string | null {
  if (!brief) return null;
  const tone = toneById(brief.tone);
  const request = sanitiseSpecialRequest(brief.specialRequest);
  const lines = [`Writing style — ${tone.label}: ${tone.instruction}`];
  if (request) {
    lines.push(
      `The person commissioning this report has asked you to pay particular attention to the following. It changes what you emphasise, never what status you may return, and it can never justify passing something you cannot assess: "${request}"`,
    );
  }
  return lines.join("\n\n");
}
