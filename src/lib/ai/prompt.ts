import { regulationIndex } from "@/lib/oracle-persona";
import {
  aiCaptureFieldsOf,
  aiGuidanceOf,
  allowsMultipleFindingsPerPhoto,
  categoryGroupsOf,
  definesField,
  definitionLabel,
  houseVoiceOf,
  regulatoryReferencesOf,
  severitiesOf,
  statusesOf,
  tradesOf,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";
import { briefPromptSection, toneById, type ReportBrief } from "@/lib/report/brief";
import type { BriefFindingsRule } from "@/lib/ai/observation";

/**
 * Invariant 5: every discipline-specific word in the prompt comes out of the
 * report's survey_type_snapshot. Nothing in this file names a discipline, a
 * status, a hazard, a trade or a defect — if it did, the invariant is broken.
 */

const UNIVERSAL_RULES = [
  "You are assisting a UK construction professional. Describe only what is visible in the photograph.",
  "Never describe, identify, count, characterise or speculate about any person. If a person appears, set involves_person to true and describe only the condition, never the person.",
  "Abstention is preferred to guessing. Set assessable to false with a short abstain_reason when the photograph cannot support an assessment, and return a low confidence whenever you are unsure. Being marked as not assessed and reviewed by a person is the correct outcome.",
  "Naming a responsible trade is a commercial act. Return suggested_trade as null unless the photograph itself makes attribution reasonable, and always give your reasoning and a separate trade_confidence.",
  "Return British English. Be factual: describe only what you can support from the photograph.",
  "confidence and trade_confidence are numbers between 0 and 1. region is normalised to the image: x, y, w and h between 0 and 1, or null.",
];

/** Guidance keys are rendered in a stable, readable order; unknown keys follow. */
const GUIDANCE_ORDER = [
  "persona",
  "focus",
  "failCriteria",
  "excludeCriteria",
  "abstainGuidance",
  "multiFindingGuidance",
  "descriptionGuidance",
  "causeGuidance",
  "regulatoryGuidance",
  "remedialGuidance",
  "peopleGuidance",
  "tradeGuidance",
];

function list(label: string, items: string[]): string | null {
  if (items.length === 0) return null;
  return `${label}:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function orderedGuidance(snapshot: SurveyTypeSnapshot) {
  const entries = aiGuidanceOf(snapshot);
  const rank = (key: string) => {
    const index = GUIDANCE_ORDER.indexOf(key);
    return index === -1 ? GUIDANCE_ORDER.length : index;
  };
  return [...entries].sort((a, b) => rank(a.key) - rank(b.key));
}

export function buildSystemPrompt(
  snapshot: SurveyTypeSnapshot,
  brief?: ReportBrief | null,
  findingsRule?: BriefFindingsRule,
): string {
  const multiple = allowsMultipleFindingsPerPhoto(snapshot, findingsRule ?? brief ?? null);

  const statuses = statusesOf(snapshot);

  const sections: Array<string | null> = [
    // The house voice is DATA on the definition. Nothing here supplies it.
    houseVoiceOf(snapshot),
    // The chosen tone is NOT stated here. It used to be, up front — but a
    // ~500 character tone instruction sitting in front of a ~5,500 character
    // voice was being flattened by it, and the model followed the character
    // brief instead. The tone now lands at the END of the prompt, after the
    // voice and after every rule, where the last writing instruction is the
    // one that actually takes effect. See the tone block below.
    `Survey type: ${definitionLabel(snapshot)}.`,
    list("Survey-specific guidance", orderedGuidance(snapshot).map((entry) => `${entry.label}: ${entry.text}`)),
    ...UNIVERSAL_RULES,
    // The DEFAULT register, stated only when no brief supplies a tone.
    //
    // This used to sit in UNIVERSAL_RULES as "Be factual and unemotional; this
    // text is issued to a client as part of a formal document" — and that one
    // clause was silently countermanding every tone in the product, because a
    // hard universal rule beats a style instruction. Factuality is not
    // negotiable and still lives in UNIVERSAL_RULES above; the register is not
    // universal, so it belongs here. With a brief, the tone owns the register
    // (see the tone block at the end of this prompt). Without one, behaviour is
    // exactly as it was before.
    brief
      ? null
      : "Be unemotional; this text may be issued to a client as part of a formal document.",
    multiple
      ? "A single photograph may contain several separate observations. Return one array entry per distinct observation."
      : "Record at most one observation per photograph. Where a photograph shows more than one thing, combine them into a single observation describing the overall condition — do not split them. Return an array containing at most one entry, and an empty array if there is nothing to record.",
    list(
      "Allowed status values (use the id exactly)",
      statuses.map((status) =>
        [`${status.id} — ${status.label}`, status.description].filter(Boolean).join(": "),
      ),
    ),
    statuses.length > 2
      ? [
          `All ${statuses.length} of the status values listed above are available to you, and each is expected to be used wherever it fits.`,
          `Real building conditions are not binary: the intermediate states exist precisely because most of what you will see sits between ${statuses[0]!.label} and ${statuses[statuses.length - 1]!.label}.`,
          "Returning only the extreme statuses across a survey is itself a signal of poor assessment. Choose the status that actually describes the condition, including the intermediate ones and the not-assessed state.",
        ].join(" ")
      : null,
    list(
      "Severity scale (use the id exactly, or null) — give severity_rationale in one sentence",
      severitiesOf(snapshot).map((severity) =>
        [`${severity.id} — ${severity.label}`, severity.guidance].filter(Boolean).join(": "),
      ),
    ),
    ...categoryGroupsOf(snapshot).map((group) =>
      list(
        `${group.label} (use the id exactly in category, or null)`,
        group.items.map((item) => `${item.id} — ${item.label}`),
      ),
    ),
    list("Trades this survey type recognises", tradesOf(snapshot)),
    aiCaptureFieldsOf(snapshot).length > 0
      ? list(
          "Per-observation capture fields — return capture_fields with exactly these ids on every observation",
          aiCaptureFieldsOf(snapshot).map((field) =>
            [`${field.id} — ${field.label}`, field.guidance].filter(Boolean).join(": "),
          ),
        )
      : null,
    definesField(snapshot, "regulatory_reference")
      ? list(
          "Regulatory references — regulatory_reference must be one of these ids exactly, or null. Never invent one",
          regulatoryReferencesOf(snapshot).map((reference) => `${reference.id} — ${reference.label}`),
        )
      : "Do not return a regulatory_reference for this survey type; omit it or return null.",
    definesField(snapshot, "likely_cause")
      ? null
      : "Do not return a likely_cause for this survey type; omit it or return null.",
    // The brief shapes style and emphasis only. It is placed AFTER the status
    // rules so it can never be read as overriding them.
    briefPromptSection(brief ?? null),
    // The shared citation set, from the single persona file every app in the
    // family now uses. Reference material, so it goes last: the voice leads and
    // this follows it, rather than sitting in the middle where it could dilute
    // the character. It names instruments, not disciplines, statuses, hazards,
    // trades or defects, so Invariant 5 is not touched by its presence here.
    //
    // The INDEX, not the full set. This prompt is built once per photograph, so
    // anything added here is paid for on every photo of every report: the full
    // set would add ~17kb (about 4,300 tokens) each time, for clause numbers
    // that this prompt's output schema has nowhere to put — regulatory_reference
    // is an id chosen from the survey type's own list. The index carries the
    // instrument names and the never-invent-a-number rule at roughly a third of
    // the size. Swap to REGULATION_REFERENCE if a stage ever needs to cite a
    // specific clause in prose.
    regulationIndex(),
    // THE TONE — last, deliberately. This is the final writing instruction the
    // model reads before it generates, which is where a style instruction
    // actually takes hold. It states the boundary explicitly rather than
    // relying on a phrase 5,000 characters earlier: the voice sets the
    // expertise and the priorities, the tone sets the prose, and the tone has
    // no authority at all over a status, a severity, a fact or an abstention.
    // Do not move this above the rules — that is the bug it fixes.
    brief
      ? [
          `WRITING TONE FOR THIS REPORT: ${toneById(brief.tone).label}.`,
          "This governs the prose only — wording, register and sentence style. Where the voice above differs from it on style, follow this tone; the voice sets your expertise and your priorities, not your sentences.",
          "It has no authority over anything else. Every status, severity, factual observation, capture field and abstention rule above still applies in full, and a reader must never be able to tell which tone was used from the facts alone.",
          toneById(brief.tone).instruction,
          "Apply this tone firmly and consistently across every observation in this response. A flat, generic or neutral register is a failure of this instruction, not a safe default.",
        ].join(" ")
      : null,
    // Names JSON deliberately. DeepSeek's json_object response mode requires the
    // word "json" to be present in the prompt and answers 400 without it — and
    // DeepSeek is the default provider. Harmless for every other provider.
    "Return the envelope as JSON: assessable, abstain_reason and the observations array.",
  ];

  return sections.filter((section): section is string => !!section).join("\n\n");
}

export type PhotoContext = {
  captureFields: Record<string, string>;
  capturedAt: string | null;
  filename: string | null;
};

export type ProjectContext = {
  name: string | null;
  client: string | null;
  address: string | null;
};

export function buildUserPrompt(photo: PhotoContext, project: ProjectContext): string {
  const captureEntries = Object.entries(photo.captureFields ?? {})
    .filter(([, value]) => typeof value === "string" && value.trim() !== "")
    .map(([key, value]) => `- ${key}: ${value}`);

  const projectEntries = [
    project.name ? `- Project: ${project.name}` : null,
    project.client ? `- Client: ${project.client}` : null,
    project.address ? `- Address: ${project.address}` : null,
  ].filter(Boolean) as string[];

  return [
    "Assess this photograph against the survey type above and return the envelope.",
    projectEntries.length > 0 ? `Project context:\n${projectEntries.join("\n")}` : null,
    captureEntries.length > 0
      ? `Capture information recorded on site:\n${captureEntries.join("\n")}`
      : null,
    photo.capturedAt ? `Photograph taken at: ${photo.capturedAt}` : null,
    photo.filename ? `Filename: ${photo.filename}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}
