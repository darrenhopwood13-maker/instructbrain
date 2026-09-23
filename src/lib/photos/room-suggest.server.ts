/**
 * Asking the model to group a report's photographs into sections.
 *
 * Server-only: a provider key never reaches the browser. The photographs are
 * sent at full resolution, inline, exactly as the analysis path sends them
 * (invariant 3) — there is no resize step here and none is to be added.
 *
 * This module proposes. It never writes: the caller shows the proposal and a
 * person applies it.
 */
import { AiProviderError } from "@/lib/ai/adapters.server";
import { aiConfig, type AiConfig } from "@/lib/ai/config";
import { dataUrlParts } from "@/lib/photos/analysis-image.server";
import {
  ROOM_PROPOSAL_SCHEMA,
  coerceRoomProposal,
  mergeProposals,
  roomSuggestionPrompt,
  type RoomProposal,
} from "@/lib/photos/room-suggest";
import type { PhotoWorkflow } from "@/lib/survey-types";

const SCHEMA_NAME = "photograph_sections";

/** Photographs per request. Enough context to see a room start and end. */
export const SUGGEST_BATCH_SIZE = 16;

export type SuggestImage = { photoId: string; dataUrl: string };

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

type Call = {
  prompts: { system: string; user: string };
  images: SuggestImage[];
  config: AiConfig;
};

async function openai({ prompts, images, config }: Call): Promise<unknown> {
  const response = await post(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.models.triage,
        max_completion_tokens: config.maxOutputTokens,
        messages: [
          { role: "system", content: prompts.system },
          {
            role: "user",
            content: [
              { type: "text", text: prompts.user },
              ...images.flatMap((image, index) => [
                { type: "text", text: `Photograph ${index + 1}` },
                { type: "image_url", image_url: { url: image.dataUrl, detail: "low" } },
              ]),
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: SCHEMA_NAME, strict: false, schema: ROOM_PROPOSAL_SCHEMA },
        },
      }),
    },
    config.requestTimeoutMs,
  );
  await failIfNotOk(response);
  const raw = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = raw.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new AiProviderError("the model returned an empty response.");
  }
  return parseJson(content);
}

async function anthropic({ prompts, images, config }: Call): Promise<unknown> {
  const response = await post(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.models.triage,
        max_tokens: config.maxOutputTokens,
        system: prompts.system,
        tool_choice: { type: "tool", name: SCHEMA_NAME },
        tools: [
          {
            name: SCHEMA_NAME,
            description: "Return the photograph sections.",
            input_schema: ROOM_PROPOSAL_SCHEMA,
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompts.user },
              ...images.flatMap((image, index) => {
                const inline = dataUrlParts(image.dataUrl);
                return [
                  { type: "text", text: `Photograph ${index + 1}` },
                  inline
                    ? {
                        type: "image",
                        source: { type: "base64", media_type: inline.mimeType, data: inline.data },
                      }
                    : { type: "image", source: { type: "url", url: image.dataUrl } },
                ];
              }),
            ],
          },
        ],
      }),
    },
    config.requestTimeoutMs,
  );
  await failIfNotOk(response);
  const raw = (await response.json()) as {
    content?: Array<{ type?: string; input?: unknown; text?: string }>;
  };
  const toolUse = raw.content?.find((block) => block.type === "tool_use");
  if (toolUse && typeof toolUse.input === "object" && toolUse.input !== null) return toolUse.input;
  return parseJson(raw.content?.find((block) => block.type === "text")?.text ?? "");
}

async function google({ prompts, images, config }: Call): Promise<unknown> {
  const parts: unknown[] = [{ text: prompts.user }];
  for (const [index, image] of images.entries()) {
    const inline = dataUrlParts(image.dataUrl);
    parts.push({ text: `Photograph ${index + 1}` });
    if (inline) parts.push({ inlineData: { mimeType: inline.mimeType, data: inline.data } });
  }

  const response = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.models.triage)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompts.system }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          maxOutputTokens: config.maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: ROOM_PROPOSAL_SCHEMA,
        },
      }),
    },
    config.requestTimeoutMs,
  );
  await failIfNotOk(response);
  const raw = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = raw.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (text.trim() === "") throw new AiProviderError("the model returned an empty response.");
  return parseJson(text);
}

const callers = { openai, anthropic, google } as const;

/**
 * One batched pass over the photographs. Batches are sequential so each one
 * can be told which sections came before it, keeping room boundaries intact.
 */
export async function proposeRooms(
  images: SuggestImage[],
  workflow: PhotoWorkflow,
  config: AiConfig = aiConfig(),
  batchSize = SUGGEST_BATCH_SIZE,
): Promise<RoomProposal> {
  const parts: RoomProposal[] = [];
  const roomsSoFar: string[] = [];

  for (let start = 0; start < images.length; start += batchSize) {
    const batch = images.slice(start, start + batchSize);
    const prompts = roomSuggestionPrompt(workflow, { count: batch.length, roomsSoFar });
    const payload = await callers[config.provider]({ prompts, images: batch, config });
    const part = coerceRoomProposal(payload, {
      photoIds: batch.map((image) => image.photoId),
      workflow,
      confidenceThreshold: config.confidenceThreshold,
    });
    parts.push(part);
    for (const room of part.rooms) {
      if (!roomsSoFar.includes(room.label)) roomsSoFar.push(room.label);
    }
  }

  return mergeProposals(parts);
}
