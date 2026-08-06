import type { SurveyDefinition } from "@/lib/survey-types";

/**
 * A report whose snapshot is missing or malformed must not borrow another
 * discipline's vocabulary. It gets an empty definition, which `statusesOf`
 * fills with `not_assessed` only.
 *
 * Kept free of any client import so server modules can use it too.
 */
export function coerceSnapshot(value: unknown): SurveyDefinition {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SurveyDefinition).id === "string" &&
    Array.isArray((value as SurveyDefinition).statuses)
  ) {
    return value as SurveyDefinition;
  }
  return {
    id: "unavailable",
    version: 0,
    label: "Survey type unavailable",
    statuses: [],
  };
}
