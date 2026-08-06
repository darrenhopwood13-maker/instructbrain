/**
 * Provider-agnostic vision adapter. Call sites know nothing about the
 * provider, the endpoint, the key or the wire format — they call
 * `analyseImage` and get an observations array back.
 *
 * Server-only: the key never reaches the browser.
 */
import { aiConfig, type AiConfig } from "@/lib/ai/config";
import { observationJsonSchema, parseObservations, type Observation } from "@/lib/ai/observation";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

export class AiProviderError extends Error {
  readonly status: number | undefined;
  readonly retryable: boolean;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
    this.retryable = status === 429 || (typeof status === "number" && status >= 500);
  }
}

export type AnalyseRequest = {
  snapshot: SurveyTypeSnapshot;
  systemPrompt: string;
  userPrompt: string;
  /** Full-resolution source. Never a thumbnail — see analysisSourcePath. */
  imageUrl: string;
};

export type AnalyseResult = { observations: Observation[]; raw: unknown };

function apiKey(): string {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) {
    throw new AiProviderError(
      "No AI provider key is configured on the server, so nothing could be assessed.",
    );
  }
  return key;
}

async function callOpenAi(request: AnalyseRequest, config: AiConfig): Promise<AnalyseResult> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: config.visionModel,
      max_tokens: config.maxOutputTokens,
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
          name: "survey_observations",
          strict: true,
          schema: observationJsonSchema(request.snapshot),
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiProviderError(
      `The AI provider returned ${response.status}. ${body.slice(0, 300)}`.trim(),
      response.status,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new AiProviderError("The AI provider returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AiProviderError("The AI provider returned output that was not valid JSON.");
  }

  return { observations: parseObservations(parsed), raw: parsed };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Exponential backoff with jitter, applied only to 429 and 5xx. */
export async function analyseImage(
  request: AnalyseRequest,
  config: AiConfig = aiConfig(),
): Promise<AnalyseResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      switch (config.provider) {
        case "openai":
          return await callOpenAi(request, config);
        default:
          throw new AiProviderError(`Unsupported AI provider: ${String(config.provider)}`);
      }
    } catch (error) {
      lastError = error;
      const retryable = error instanceof AiProviderError && error.retryable;
      if (!retryable || attempt === config.maxRetries) break;
      const delay = config.baseRetryDelayMs * 2 ** attempt + Math.random() * 250;
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new AiProviderError("The AI call failed.");
}

/** Bounded concurrency. Order of results matches order of inputs. */
export async function mapWithConcurrency<TIn, TOut>(
  items: TIn[],
  limit: number,
  worker: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  const results = new Array<TOut>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index] as TIn, index);
    }
  });

  await Promise.all(runners);
  return results;
}
