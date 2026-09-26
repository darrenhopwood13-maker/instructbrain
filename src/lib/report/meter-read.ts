/**
 * Reading a meter display from a photograph — shared, pure parts.
 *
 * The result is only ever a suggestion shown to a person. Anything unclear,
 * low-confidence or malformed becomes `null` ("couldn't read"), never a guess.
 */

export type MeterSuggestion = { reading: string | null; confidence: number };

export const METER_READING_SCHEMA = {
  type: "object",
  properties: {
    reading: { type: ["string", "null"], description: "Digits exactly as shown, or null if unclear." },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["reading", "confidence"],
  additionalProperties: false,
} as const;

export function meterReadingPrompt(meterLabel: string): { system: string; user: string } {
  return {
    system:
      "You read utility meter displays from photographs. Return only the digits and decimal point shown on the register, exactly as displayed. If the display is blurred, obstructed, reflective or ambiguous, return reading as null. Never estimate or complete a partly visible number. Do not describe any person.",
    user: `This photograph should show the ${meterLabel}. What reading does the register show?`,
  };
}

/** Coerce model output: anything not clearly a reading above the threshold → null. */
export function coerceMeterSuggestion(raw: unknown, threshold: number): MeterSuggestion {
  if (typeof raw !== "object" || raw === null) return { reading: null, confidence: 0 };
  const record = raw as Record<string, unknown>;
  const confidence = Number(record["confidence"]);
  const safeConfidence = Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0;
  const reading = typeof record["reading"] === "string" ? record["reading"].trim() : "";
  if (!/^[0-9][0-9 .,]*$/.test(reading) || safeConfidence < threshold) {
    return { reading: null, confidence: safeConfidence };
  }
  return { reading: reading.replace(/\s+/g, " "), confidence: safeConfidence };
}
