/**
 * Provider adapters. Server-only: an API key never reaches the browser.
 *
 * Each adapter takes the same request and returns the same shape. Call sites
 * know nothing about endpoints, wire formats or which provider is active —
 * that is decided by which key is present, in config.ts.
 */
import type { AiConfig, AnalysisTier } from "@/lib/ai/config";
import { envelopeJsonSchema } from "@/lib/ai/observation";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

export class AiProviderError extends Error {
  readonly status: number | undefined;
  readonly retryable: boolean;
  constructor(message: string, status?: number, retryable?: boolean) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
    this.retryable =
      retryable ?? (status === 429 || (typeof status === "number" && status >= 500));
  }
}

export type AdapterRequest = {
  snapshot: SurveyTypeSnapshot;
  systemPrompt: string;
  userPrompt: string;
  /** Full-resolution source, resolved by analysisSourcePath. Never a thumbnail. */
  imageUrl: string;
  model: string;
  tier: AnalysisTier;
  config: AiConfig;
};

export type AdapterResponse = {
  /** Parsed JSON payload from the model, before any coercion. */
  payload: unknown;
  /** Everything the provider returned, written to ai_raw_output in every case. */
  raw: unknown;
  usage: { inputTokens: number; outputTokens: number };
};

const SCHEMA_NAME = "survey_observation_envelope";

async function post(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new AiProviderError(
      aborted
        ? "the AI provider did not respond in time."
        : `the AI provider could not be reached: ${error instanceof Error ? error.message : "network error"}`,
      undefined,
      true,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function failIfNotOk(response: Response): Promise<void> {
  if (response.ok) return;
  const body = await response.text().catch(() => "");
  throw new AiProviderError(
    `the AI provider returned ${response.status}. ${body.slice(0, 300)}`.trim(),
    response.status,
  );
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    throw new AiProviderError("the model returned output that was not valid JSON.");
  }
}

/* ------------------------------------------------------------------ */

async function openai(request: AdapterRequest): Promise<AdapterResponse> {
  const response = await post(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${request.config.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        max_completion_tokens: request.config.maxOutputTokens,
        messages: [
          { role: "system", content: request.systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: request.userPrompt },
              { type: "image_url", image_url: { url: request.imageUrl, detail: "high" } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: SCHEMA_NAME,
            strict: false,
            schema: envelopeJsonSchema(request.snapshot),
          },
        },
      }),
    },
    request.config.requestTimeoutMs,
  );
  await failIfNotOk(response);

  const raw = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = raw.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new AiProviderError("the model returned an empty response.");
  }

  return {
    payload: parseJson(content),
    raw,
    usage: {
      inputTokens: raw.usage?.prompt_tokens ?? 0,
      outputTokens: raw.usage?.completion_tokens ?? 0,
    },
  };
}

async function anthropic(request: AdapterRequest): Promise<AdapterResponse> {
  const response = await post(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": request.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.config.maxOutputTokens,
        system: request.systemPrompt,
        // Forced tool use is Anthropic's schema enforcement.
        tool_choice: { type: "tool", name: SCHEMA_NAME },
        tools: [
          {
            name: SCHEMA_NAME,
            description: "Return the survey observation envelope.",
            input_schema: envelopeJsonSchema(request.snapshot),
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "url", url: request.imageUrl } },
              { type: "text", text: request.userPrompt },
            ],
          },
        ],
      }),
    },
    request.config.requestTimeoutMs,
  );
  await failIfNotOk(response);

  const raw = (await response.json()) as {
    content?: Array<{ type?: string; input?: unknown; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const toolUse = raw.content?.find((block) => block.type === "tool_use");
  const payload =
    toolUse && typeof toolUse.input === "object" && toolUse.input !== null
      ? toolUse.input
      : parseJson(raw.content?.find((block) => block.type === "text")?.text ?? "");

  return {
    payload,
    raw,
    usage: {
      inputTokens: raw.usage?.input_tokens ?? 0,
      outputTokens: raw.usage?.output_tokens ?? 0,
    },
  };
}

/** Google reads inline bytes; the object is fetched whole and never resized. */
async function fetchAsBase64(
  url: string,
  timeoutMs: number,
): Promise<{ data: string; mimeType: string }> {
  const response = await post(url, { method: "GET" }, timeoutMs);
  if (!response.ok) {
    throw new AiProviderError(`the photograph could not be read (${response.status}).`);
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] as number);
  }
  return { data: btoa(binary), mimeType };
}

async function google(request: AdapterRequest): Promise<AdapterResponse> {
  const image = await fetchAsBase64(request.imageUrl, request.config.requestTimeoutMs);

  const response = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": request.config.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: request.userPrompt },
              { inlineData: { mimeType: image.mimeType, data: image.data } },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: request.config.maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: envelopeJsonSchema(request.snapshot),
        },
      }),
    },
    request.config.requestTimeoutMs,
  );
  await failIfNotOk(response);

  const raw = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const text = raw.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (text.trim() === "") throw new AiProviderError("the model returned an empty response.");

  return {
    payload: parseJson(text),
    raw,
    usage: {
      inputTokens: raw.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: raw.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

export const adapters = { openai, anthropic, google } as const;
