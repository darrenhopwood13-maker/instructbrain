/**
 * The Custom Reports brief: report type, tone, switches and a free-text
 * special request.
 *
 * Invariant 5 still holds here. Nothing in this module names a discipline, a
 * status, a trade or a defect — the brief only shapes HOW the assessment is
 * written, never WHAT vocabulary is available. Every discipline word still
 * comes out of the survey type snapshot.
 */

import type { ToneRule } from "@/lib/report/tone-post-process";

export const REPORT_TONES = [
  {
    id: "formal",
    label: "Formal",
    description: "Measured professional register, suitable for issue to a client.",
    instruction:
      "Write in a measured, formal professional register. Complete sentences, no contractions, no colloquialism. State the observed condition precisely and without emotion.",
    rules: [] as ToneRule[],
    maxOutputTokens: 4500,
    escalate: true,
  },
  {
    id: "easy",
    label: "Easy-going",
    description: "Plain, direct wording a non-specialist can follow.",
    instruction:
      "Write plainly and directly, as if talking a non-specialist through it on site. Start each observation with the thing itself rather than with 'The' or 'There is'. Never prefix an observation with a label such as 'Finding:'. No commentary on how something looks or how it affects the overall finish.",
    rules: ["strip-finding-label", "strip-leading-article"] as ToneRule[],
    maxOutputTokens: 3000,
    escalate: false,
  },
  {
    id: "sharp",
    label: "Sharp",
    description: "Terse. The shortest wording that carries the fact.",
    instruction:
      "Be terse. One short sentence per observation wherever possible. Cut every word that is not carrying information. No preamble, no impact commentary.",
    rules: [] as ToneRule[],
    maxOutputTokens: 2500,
    escalate: false,
  },
  {
    id: "meticulous",
    label: "Meticulous",
    description: "Fuller technical description for a specialist reader.",
    instruction:
      "Write for a chartered surveyor or specialist contractor. Describe the observed condition precisely, including location within the photograph, materials and extent where they are visible. Do not speculate beyond the photograph.",
    rules: [] as ToneRule[],
    maxOutputTokens: 6000,
    escalate: true,
  },
  {
    id: "sarcastic",
    label: "Sarcastic",
    description: "Dry and wry. For internal use, not for a client.",
    instruction:
      "Allow a dry, wry turn of phrase, while remaining accurate and never insulting a named person or company. The facts stay exactly as observed. Never prefix an observation with a label such as 'Finding:'. No commentary on how something affects the overall finish.",
    rules: ["strip-finding-label"] as ToneRule[],
    maxOutputTokens: 3500,
    escalate: false,
  },
] as const;

export type ReportTone = (typeof REPORT_TONES)[number];
export type ReportToneId = ReportTone["id"];

export const DEFAULT_TONE_ID: ReportToneId = "formal";

/** Briefs and templates written before the five tones existed. */
const LEGACY_TONE_IDS: Record<string, ReportToneId> = {
  factual: "sharp",
  client: "formal",
  technical: "meticulous",
};

export function toneById(id: string | null | undefined): ReportTone {
  const wanted = typeof id === "string" ? (LEGACY_TONE_IDS[id] ?? id) : null;
  return REPORT_TONES.find((tone) => tone.id === wanted) ?? REPORT_TONES[0];
}

export const REPORT_TYPES = [
  {
    id: "assessment",
    label: "Assessment",
    description: "Judge the condition against the survey type and record findings.",
  },
  {
    id: "identifier",
    label: "Identifier",
    description: "Describe what is in each photograph. No judgement, no repairs.",
  },
] as const;

export type ReportTypeId = (typeof REPORT_TYPES)[number]["id"];

export function reportTypeById(id: string | null | undefined): ReportTypeId {
  return REPORT_TYPES.some((type) => type.id === id) ? (id as ReportTypeId) : "assessment";
}

/**
 * Presets are starting points, not survey types. They carry a tone, the
 * switches and a suggested special request; the survey type still supplies the
 * vocabulary.
 */
export const REPORT_PRESETS = [
  {
    id: "record",
    label: "Photographic record",
    description: "A dated record of what was seen. Minimal commentary.",
    tone: "sharp" as ReportToneId,
    reportType: "assessment" as ReportTypeId,
    includeFix: false,
    includeSeverity: true,
    advisoryFooter: false,
    specialRequest: "",
  },
  {
    id: "handover",
    label: "Handover pack",
    description: "For issue to a client at handover.",
    tone: "formal" as ReportToneId,
    reportType: "assessment" as ReportTypeId,
    includeFix: true,
    includeSeverity: true,
    advisoryFooter: true,
    specialRequest: "Flag anything that would affect handover or occupation.",
  },
  {
    id: "technical",
    label: "Technical assessment",
    description: "Fuller technical detail for a specialist reader.",
    tone: "meticulous" as ReportToneId,
    reportType: "assessment" as ReportTypeId,
    includeFix: true,
    includeSeverity: true,
    advisoryFooter: false,
    specialRequest: "",
  },
  {
    id: "identifier",
    label: "Identifier",
    description: "Plain description of each photograph. No damage judgement.",
    tone: "easy" as ReportToneId,
    reportType: "identifier" as ReportTypeId,
    includeFix: false,
    includeSeverity: false,
    advisoryFooter: false,
    specialRequest: "",
  },
  {
    id: "condition_record",
    label: "Condition record",
    description: "A photograph and one line of condition. Nothing else.",
    tone: "sharp" as ReportToneId,
    reportType: "assessment" as ReportTypeId,
    includeFix: false,
    includeSeverity: false,
    advisoryFooter: false,
    specialRequest: "",
  },
  {
    id: "blank",
    label: "Start blank",
    description: "No preset. Choose your own tone and request.",
    tone: "formal" as ReportToneId,
    reportType: "assessment" as ReportTypeId,
    includeFix: true,
    includeSeverity: true,
    advisoryFooter: false,
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
  reportType: ReportTypeId;
  includeFix: boolean;
  includeSeverity: boolean;
  advisoryFooter: boolean;
  specialRequest: string;
  /** Snapshot of every survey type this report covers, keyed by definition id. */
  surveyTypes?: Array<{ id: string; label: string }>;
};

export const EMPTY_BRIEF: ReportBrief = {
  presetId: null,
  tone: DEFAULT_TONE_ID,
  reportType: "assessment",
  includeFix: true,
  includeSeverity: true,
  advisoryFooter: false,
  specialRequest: "",
  surveyTypes: [],
};

/** A free-text request must never be able to rewrite the status rules. */
export const SPECIAL_REQUEST_LIMIT = 500;

export function sanitiseSpecialRequest(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, SPECIAL_REQUEST_LIMIT);
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
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
  const reportType = reportTypeById(
    typeof raw["reportType"] === "string" ? raw["reportType"] : null,
  );
  return {
    presetId: typeof raw["presetId"] === "string" ? raw["presetId"] : null,
    tone: toneById(typeof raw["tone"] === "string" ? raw["tone"] : null).id,
    reportType,
    // An identifier report never carries a fix or a severity, whatever the
    // stored switches say.
    includeFix: reportType === "identifier" ? false : boolOr(raw["includeFix"], true),
    includeSeverity: reportType === "identifier" ? false : boolOr(raw["includeSeverity"], true),
    advisoryFooter: boolOr(raw["advisoryFooter"], false),
    specialRequest: sanitiseSpecialRequest(
      typeof raw["specialRequest"] === "string" ? raw["specialRequest"] : "",
    ),
    surveyTypes,
  };
}

export const ADVISORY_FOOTER_TEXT =
  "This report records conditions visible in the photographs supplied on the date stated. It is advisory and is not a warranty, a structural assessment or a statement of compliance. Items marked as not assessed require inspection by a competent person.";

/**
 * The text appended to the system prompt. The special request is presented as
 * emphasis only — it can never authorise a pass, so invariant 1 is untouched.
 */
export function briefPromptSection(brief: ReportBrief | null): string | null {
  if (!brief) return null;
  const tone = toneById(brief.tone);
  const request = sanitiseSpecialRequest(brief.specialRequest);
  const lines = [`Writing style — ${tone.label}: ${tone.instruction}`];

  if (brief.reportType === "identifier") {
    lines.push(
      "This is an identifier report. Describe plainly what is present in the photograph. Do not judge whether anything is damaged, defective or acceptable, and do not recommend any repair or remedial work. If you cannot describe what is present, say so and leave it to be resolved by a person.",
    );
  } else {
    if (!brief.includeFix) {
      lines.push("Do not include remedial or corrective advice. Return remedial text as empty.");
    }
    if (!brief.includeSeverity) {
      lines.push("Do not rate severity for this report. Return severity as null.");
    }
  }

  if (request) {
    lines.push(
      `The person commissioning this report has asked you to pay particular attention to the following. It changes what you emphasise, never what status you may return, and it can never justify passing something you cannot assess: "${request}"`,
    );
  }
  return lines.join("\n\n");
}
