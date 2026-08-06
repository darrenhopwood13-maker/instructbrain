import {
  aiGuidanceOf,
  allowsMultipleFindingsPerPhoto,
  categoriesOf,
  definesField,
  definitionLabel,
  regulatoryReferencesOf,
  severitiesOf,
  statusesOf,
  tradesOf,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";

/**
 * Invariant 5: every discipline-specific word in the prompt comes out of the
 * snapshot. Nothing here names roofing, fire-stopping or any other trade,
 * status or hazard.
 */

const UNIVERSAL_RULES = [
  "You are assisting a UK construction professional. Describe only what is visible in the photograph.",
  "Never describe, identify, count, characterise or speculate about any person. If a person appears in the photograph, set involves_person to true and describe only the condition or hazard, never the person.",
  "Abstention is preferred to guessing. If you are not confident, return a low confidence value — you will be marked as not assessed and a person will review it, which is the correct outcome.",
  "Suggesting a responsible trade is a commercial act. Return suggested_trade as null unless the photograph itself makes attribution reasonable, and always explain your reasoning.",
  "Return British English. Be factual and unemotional; this text is issued to a client as part of a formal document.",
];

function list(label: string, items: string[]): string | null {
  if (items.length === 0) return null;
  return `${label}:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

export function buildSystemPrompt(snapshot: SurveyTypeSnapshot): string {
  const multiple = allowsMultipleFindingsPerPhoto(snapshot);

  const sections: Array<string | null> = [
    `Survey type: ${definitionLabel(snapshot)}.`,
    ...UNIVERSAL_RULES,
    multiple
      ? "A single photograph may contain several separate observations. Return one array entry per distinct observation."
      : "This survey type records at most one observation per photograph. Return an array containing at most one entry, and an empty array if there is nothing to record.",
    list(
      "Allowed status values (use the id exactly)",
      statusesOf(snapshot).map((status) =>
        [`${status.id} — ${status.label}`, status.description].filter(Boolean).join(": "),
      ),
    ),
    list(
      "Severity values (use the id exactly, or null)",
      severitiesOf(snapshot).map((severity) =>
        [`${severity.id} — ${severity.label}`, severity.guidance].filter(Boolean).join(": "),
      ),
    ),
    list(
      "Category values (use the id exactly, or null)",
      categoriesOf(snapshot).map((category) => `${category.id} — ${category.label}`),
    ),
    definesField(snapshot, "regulatory_reference")
      ? list(
          "Regulatory references (use the id exactly, or null)",
          regulatoryReferencesOf(snapshot).map((ref) => `${ref.id} — ${ref.label}`),
        )
      : "Do not return a regulatory_reference for this survey type; return null.",
    definesField(snapshot, "likely_cause")
      ? "Where the photograph supports it, give a short likely_cause. Otherwise return null."
      : "Do not return a likely_cause for this survey type; return null.",
    list("Trades this survey type recognises", tradesOf(snapshot)),
    list(
      "Survey-specific guidance",
      aiGuidanceOf(snapshot).map((entry) => `${entry.label}: ${entry.text}`),
    ),
    "confidence and trade_confidence are numbers between 0 and 1.",
  ];

  return sections.filter((section): section is string => !!section).join("\n\n");
}

export function buildUserPrompt(context: {
  captureFields: Record<string, string>;
  capturedAt: string | null;
  filename: string | null;
}): string {
  const entries = Object.entries(context.captureFields ?? {})
    .filter(([, value]) => typeof value === "string" && value.trim() !== "")
    .map(([key, value]) => `- ${key}: ${value}`);

  return [
    "Assess this photograph against the survey type above and return the observations array.",
    entries.length > 0 ? `Capture information recorded on site:\n${entries.join("\n")}` : null,
    context.capturedAt ? `Photograph taken at: ${context.capturedAt}` : null,
    context.filename ? `Filename: ${context.filename}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}
