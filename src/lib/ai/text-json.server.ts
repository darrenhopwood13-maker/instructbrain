/**
 * One text-only JSON call, for any provider the app already supports.
 *
 * Synthesis and the map's plain-English reader both need "ask a model for a strictly shaped JSON
 * answer". Keeping the provider branches in one place is the point: the last time they were copied
 * per feature, an unregistered provider threw `undefined is not a function` inside a screen nobody
 * was testing. Every provider difference that bites is handled here once:
 *
 *   OpenAI      json_schema, max_completion_tokens
 *   Anthropic   schema described in the system prompt, max_tokens
 *   Google      responseMimeType json, maxOutputTokens
 *   DeepSeek    json_object only (json_schema is rejected) and the prompt must contain the word
 *               "json", or the request 400s. Model choice is the caller's; the field names are
 *               spelled out in the prompt because no schema can be enforced.
 */
import type { AiConfig } from "@/lib/ai/config";
import { AiProviderError } from "@/lib/ai/adapters.server";

export type TextJsonResult = {
  payload: unknown;
  raw: unknown;
  usage: { inputTokens: number; outputTokens: number };
};

export type TextJsonOptions = {
  /** JSON Schema for the answer. Enforced where the provider can, described where it cannot. */
  schema: Record<string, unknown>;
  /** Name used by OpenAI's strict schema mode. */
  schemaName: string;
  /** Model to call. Defaults to the config's escalation model, which is the text-strong tier. */
  model?: string;
  maxOutputTokens?: number;
  /** Ask for a little variation; 0 is right for extraction, higher for anything creative. */
  temperature?: number;
  /**
   * Whether the model may reason before answering. Off by default: DeepSeek bills thinking as
   * output, and a small token budget spent thinking returns an EMPTY answer - which reads as a
   * JSON parse error rather than as an exhausted budget. Only measured on DeepSeek, which is the
   * only provider here that exposes the switch.
   */
  thinking?: boolean;
};

export async function callTextJson(
  config: AiConfig,
  prompt: { system: string; user: string },
  options: TextJsonOptions,
): Promise<TextJsonResult> {
  const model = options.model ?? config.models.escalation;
  const maxTokens = options.maxOutputTokens ?? config.maxOutputTokens;
  const temperature = options.temperature;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    if (config.provider === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          ...(temperature === undefined ? {} : { temperature }),
          system: `${prompt.system}\nReply with JSON matching this schema and nothing else: ${JSON.stringify(options.schema)}`,
          messages: [{ role: "user", content: prompt.user }],
        }),
      });
      const raw = await response.json();
      if (!response.ok) throw new AiProviderError(JSON.stringify(raw), response.status);
      const text = (raw?.content ?? []).map((part: any) => part?.text ?? "").join("");
      return {
        payload: JSON.parse(text),
        raw,
        usage: {
          inputTokens: raw?.usage?.input_tokens ?? 0,
          outputTokens: raw?.usage?.output_tokens ?? 0,
        },
      };
    }

    if (config.provider === "google") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: prompt.system }] },
            contents: [{ role: "user", parts: [{ text: prompt.user }] }],
            generationConfig: {
              responseMimeType: "application/json",
              maxOutputTokens: maxTokens,
              ...(temperature === undefined ? {} : { temperature }),
            },
          }),
        },
      );
      const raw = await response.json();
      if (!response.ok) throw new AiProviderError(JSON.stringify(raw), response.status);
      const text = (raw?.candidates?.[0]?.content?.parts ?? [])
        .map((part: any) => part?.text ?? "")
        .join("");
      return {
        payload: JSON.parse(text),
        raw,
        usage: {
          inputTokens: raw?.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: raw?.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    }

    if (config.provider === "deepseek") {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          ...(temperature === undefined ? {} : { temperature }),
          response_format: { type: "json_object" },
          // Without this DeepSeek spends the whole budget reasoning and answers with nothing.
          thinking: { type: options.thinking ? "enabled" : "disabled" },
          messages: [
            { role: "system", content: `${prompt.system}\n\nReturn valid json only.` },
            { role: "user", content: prompt.user },
          ],
        }),
      });
      const raw = await response.json();
      if (!response.ok) throw new AiProviderError(JSON.stringify(raw), response.status);
      const text: string = raw?.choices?.[0]?.message?.content ?? "";
      if (text.trim() === "") {
        throw new AiProviderError(
          `${model} returned an empty message (finish_reason: ${raw?.choices?.[0]?.finish_reason ?? "unknown"})`,
          response.status,
        );
      }
      return {
        payload: JSON.parse(text),
        raw,
        usage: {
          inputTokens: raw?.usage?.prompt_tokens ?? 0,
          outputTokens: raw?.usage?.completion_tokens ?? 0,
        },
      };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_completion_tokens: maxTokens,
        ...(temperature === undefined ? {} : { temperature }),
        response_format: {
          type: "json_schema",
          json_schema: { name: options.schemaName, strict: true, schema: options.schema },
        },
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      }),
    });
    const raw = await response.json();
    if (!response.ok) throw new AiProviderError(JSON.stringify(raw), response.status);
    const text = raw?.choices?.[0]?.message?.content ?? "";
    return {
      payload: JSON.parse(text),
      raw,
      usage: {
        inputTokens: raw?.usage?.prompt_tokens ?? 0,
        outputTokens: raw?.usage?.completion_tokens ?? 0,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
