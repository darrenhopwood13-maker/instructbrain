import {
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
  "Return British English. Be factual and unemotional; this text is issued to a client as part of a formal document.",
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

export function buildSystemPrompt(snapshot: SurveyTypeSnapshot): string {
  const multiple = allowsMultipleFindingsPerPhoto(snapshot);

  const statuses = statusesOf(snapshot);

  const sections: Array<string | null> = [
    // The house voice is DATA on the definition. Nothing here supplies it.
    houseVoiceOf(snapshot),
    `Survey type: ${definitionLabel(snapshot)}.`,
    list("Survey-specific guidance", orderedGuidance(snapshot).map((entry) => `${entry.label}: ${entry.text}`)),
    ...UNIVERSAL_RULES,
    multiple
      ? "A single photograph may contain several separate observations. Return one array entry per distinct observation."
      : "This survey type records at most one observation per photograph. Return an array containing at most one entry, and an empty array if there is nothing to record.",
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
    definesField(snapshot, "regulatory_reference")
      ? list(
          "Regulatory references — regulatory_reference must be one of these ids exactly, or null. Never invent one",
          regulatoryReferencesOf(snapshot).map((reference) => `${reference.id} — ${reference.label}`),
        )
      : "Do not return a regulatory_reference for this survey type; omit it or return null.",
    definesField(snapshot, "likely_cause")
      ? null
      : "Do not return a likely_cause for this survey type; omit it or return null.",
    "Return the envelope: assessable, abstain_reason and the observations array.",
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
