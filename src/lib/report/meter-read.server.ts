/**
 * Asking the model to read a meter photograph. Server-only; runs as the
 * signed-in user (RLS applies). Nothing is written except the usage log —
 * the person decides whether to accept the suggestion.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AiProviderError } from "@/lib/ai/adapters.server";
import { aiConfig, estimateCostUsd, type AiConfig } from "@/lib/ai/config";
import { assertWithinBudget, logUsage } from "@/lib/ai/cost.server";
import { dataUrlParts, loadAnalysableImage } from "@/lib/photos/analysis-image.server";
import { analysisSourcePath } from "@/lib/photos/storage-paths";
import {
  METER_READING_SCHEMA,
  coerceMeterSuggestion,
  meterReadingPrompt,
  type MeterSuggestion,
} from "@/lib/report/meter-read";

type AnyClient = SupabaseClient<any, any, any>;
type Usage = { inputTokens: number; outputTokens: number };
type Result = { payload: unknown; usage: Usage };

const NAME = "meter_reading";

async function post(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AiProviderError(`the AI provider returned ${response.status}. ${body.slice(0, 200)}`, response.status);
    }
    return response;
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    throw new AiProviderError("the AI provider could not be reached.", undefined, true);
  } finally {
    clearTimeout(timer);
  }
}

function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function openai(prompts: { system: string; user: string }, dataUrl: string, config: AiConfig): Promise<Result> {
  const response = await post(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.models.triage,
        max_completion_tokens: 300,
        messages: [
          { role: "system", content: prompts.system },
          {
            role: "user",
            content: [
              { type: "text", text: prompts.user },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
        response_format: { type: "json_schema", json_schema: { name: NAME, strict: false, schema: METER_READING_SCHEMA } },
      }),
    },
    config.requestTimeoutMs,
  );
  const raw = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    payload: json(raw.choices?.[0]?.message?.content ?? ""),
    usage: { inputTokens: raw.usage?.prompt_tokens ?? 0, outputTokens: raw.usage?.completion_tokens ?? 0 },
  };
}

async function anthropic(prompts: { system: string; user: string }, dataUrl: string, config: AiConfig): Promise<Result> {
  const inline = dataUrlParts(dataUrl);
  const response = await post(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: config.models.triage,
        max_tokens: 300,
        system: prompts.system,
        tool_choice: { type: "tool", name: NAME },
        tools: [{ name: NAME, description: "Return the meter reading.", input_schema: METER_READING_SCHEMA }],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompts.user },
              inline
                ? { type: "image", source: { type: "base64", media_type: inline.mimeType, data: inline.data } }
                : { type: "image", source: { type: "url", url: dataUrl } },
            ],
          },
        ],
      }),
    },
    config.requestTimeoutMs,
  );
  const raw = (await response.json()) as {
    content?: Array<{ type?: string; input?: unknown }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  return {
    payload: raw.content?.find((block) => block.type === "tool_use")?.input ?? null,
    usage: { inputTokens: raw.usage?.input_tokens ?? 0, outputTokens: raw.usage?.output_tokens ?? 0 },
  };
}

async function google(prompts: { system: string; user: string }, dataUrl: string, config: AiConfig): Promise<Result> {
  const inline = dataUrlParts(dataUrl);
  const response = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.models.triage)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompts.system }] },
        contents: [
          {
            role: "user",
            parts: [{ text: prompts.user }, ...(inline ? [{ inlineData: { mimeType: inline.mimeType, data: inline.data } }] : [])],
          },
        ],
        generationConfig: {
          maxOutputTokens: 300,
          responseMimeType: "application/json",
          responseSchema: { type: "object", properties: { reading: { type: "string", nullable: true }, confidence: { type: "number" } }, required: ["reading", "confidence"] },
        },
      }),
    },
    config.requestTimeoutMs,
  );
  const raw = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  return {
    payload: json(raw.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? ""),
    usage: {
      inputTokens: raw.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: raw.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

const callers = { openai, anthropic, google } as const;

export async function suggestMeterReading(
  client: AnyClient,
  input: { reportId: string; photoId: string; meterLabel: string },
): Promise<MeterSuggestion> {
  const config = aiConfig();
  const { data: photo, error } = await (client.from("photos" as never) as any)
    .select("id, report_id, storage_path, thumbnail_path, analysis_path, reports!inner(organisation_id)")
    .eq("id", input.photoId)
    .eq("report_id", input.reportId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!photo) throw new Error("That photograph could not be found, or you cannot access it.");
  const organisationId = (photo as any).reports?.organisation_id as string;

  await assertWithinBudget(client, organisationId);
  // Invariant 3: the stored full-resolution source, never a thumbnail.
  const image = await loadAnalysableImage(client, analysisSourcePath(photo as any));
  const { payload, usage } = await callers[config.provider](meterReadingPrompt(input.meterLabel), image.dataUrl, config);
  const suggestion = coerceMeterSuggestion(payload, config.confidenceThreshold);

  await logUsage(client, {
    organisationId,
    reportId: input.reportId,
    photoId: input.photoId,
    tier: "triage",
    provider: config.provider,
    model: config.models.triage,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsd: estimateCostUsd(config.models.triage, usage),
    cached: false,
    outcome: suggestion.reading === null ? "meter_unread" : "meter_suggested",
  }).catch(() => undefined);

  return suggestion;
}
