/**
 * Synthesis pass: a second, text-only AI call over the CONFIRMED findings of a
 * report. It produces an executive summary, a prioritised action list and any
 * pattern across the set. It never changes a finding, never assigns a trade and
 * never sends anything anywhere.
 *
 * Model identifiers and keys come from config.ts, as everywhere else.
 */
import { aiConfig, estimateCostUsd, type AiConfig } from "@/lib/ai/config";
import { callTextJson, type TextJsonResult } from "@/lib/ai/text-json.server";

export type SynthesisResult = {
  executiveSummary: string;
  actions: Array<{ ref: string | null; action: string; priority: string }>;
  patterns: Array<{ title: string; detail: string; refs: string[] }>;
  generatedAt: string;
};

export type SynthesisInput = {
  reportTitle: string;
  projectName: string | null;
  clientName: string | null;
  address: string | null;
  disciplineLabel: string;
  statusLabels: Record<string, string>;
  severityLabels: Record<string, string>;
  findings: Array<{
    ref: string;
    status: string;
    severity: string | null;
    trade: string | null;
    location: string;
    finding: string;
    remedial: string;
  }>;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["executive_summary", "actions", "patterns"],
  properties: {
    executive_summary: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "action", "priority"],
        properties: {
          ref: { type: ["string", "null"] },
          action: { type: "string" },
          priority: { type: "string" },
        },
      },
    },
    patterns: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "refs"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          refs: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

function buildPrompt(input: SynthesisInput): { system: string; user: string } {
  const system = [
    "You are writing the summary section of a UK construction report in professional UK English.",
    "Work only from the findings supplied. Never invent a finding, a location, a cause or a regulation.",
    "Never describe, identify or characterise any person.",
    "Trade attribution in the supplied data is a human decision already made; do not re-attribute responsibility.",
    "Where the evidence does not support a conclusion, say so plainly rather than asserting one.",
  ].join(" ");

  const user = JSON.stringify(
    {
      report: {
        title: input.reportTitle,
        survey_type: input.disciplineLabel,
        project: input.projectName,
        client: input.clientName,
        address: input.address,
      },
      status_labels: input.statusLabels,
      severity_labels: input.severityLabels,
      findings: input.findings,
      instructions: {
        executive_summary:
          "Three to six sentences describing the outcome of the survey and the overall condition observed.",
        actions:
          "A prioritised action list drawn only from the findings supplied. Each entry cites the finding ref where one applies.",
        patterns:
          "Identify where several findings plausibly share a common cause rather than being isolated. If no pattern is supported by the data, return an empty array.",
      },
    },
    null,
    2,
  );

  return { system, user };
}

/**
 * Provider branching lives in `callTextJson` so it exists once, not once per feature. This wrapper
 * only says which schema and model the synthesis pass wants.
 */
async function callModel(
  config: AiConfig,
  prompt: { system: string; user: string },
): Promise<TextJsonResult> {
  return callTextJson(config, prompt, { schema: SCHEMA, schemaName: "report_synthesis" });
}

function coerce(payload: unknown): SynthesisResult {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const actions = Array.isArray(raw["actions"]) ? raw["actions"] : [];
  const patterns = Array.isArray(raw["patterns"]) ? raw["patterns"] : [];
  return {
    executiveSummary:
      typeof raw["executive_summary"] === "string" ? raw["executive_summary"].trim() : "",
    actions: actions
      .map((item) => item as Record<string, unknown>)
      .filter((item) => typeof item["action"] === "string")
      .map((item) => ({
        ref: typeof item["ref"] === "string" && item["ref"] !== "" ? item["ref"] : null,
        action: item["action"] as string,
        priority: typeof item["priority"] === "string" ? item["priority"] : "",
      })),
    patterns: patterns
      .map((item) => item as Record<string, unknown>)
      .filter((item) => typeof item["title"] === "string" && typeof item["detail"] === "string")
      .map((item) => ({
        title: item["title"] as string,
        detail: item["detail"] as string,
        refs: Array.isArray(item["refs"])
          ? (item["refs"] as unknown[]).filter((ref): ref is string => typeof ref === "string")
          : [],
      })),
    generatedAt: new Date().toISOString(),
  };
}

export async function synthesise(
  input: SynthesisInput,
): Promise<{ result: SynthesisResult; costUsd: number; model: string; raw: unknown }> {
  const config = aiConfig();
  const { payload, raw, usage } = await callModel(config, buildPrompt(input));
  return {
    result: coerce(payload),
    costUsd: estimateCostUsd(config.models.escalation, usage),
    model: config.models.escalation,
    raw,
  };
}
