import type { AiConfig } from "@/lib/ai/config";
import { toneById, type ReportToneId } from "@/lib/report/brief";

/**
 * The voice pass: a second, cheap, TEXT-ONLY call whose entire job is the
 * register.
 *
 * WHY THIS EXISTS. The tone instruction lives in the vision prompt, where it is
 * ~600 characters competing with ~20,000 characters of technical rules. Measured
 * on the real prompt and real photographs (deepseek-flash, three photographs
 * from a real snagging report, sarcastic tone):
 *
 *   instruction alone                   1 of 6 runs carried a wry turn
 *   instruction + examples in the voice 2 of 18 findings — not a fix either
 *   thinking on                         2 of 6, at ~4x the output tokens
 *
 * The instruction is correct and it is not enough. The structural problem is
 * that a style rule is outnumbered by rules about facts. A dedicated call has
 * nothing to compete with, which is why the register lands there and does not
 * land here.
 *
 * THE FACTS STAY AUTHORITATIVE. The pass rewrites prose only, and every rewrite
 * is checked against the original before it is used: the numbers must match
 * exactly, and the length must stay in the same neighbourhood. Anything that
 * fails is discarded and the original text is kept, so the worst case is the
 * straight description the report would have had anyway.
 */

export type VoicePassUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** How many of the texts came back usable. */
  rewritten: number;
  /** How many were kept as the original because the rewrite failed its check. */
  keptOriginal: number;
};

export type VoicePassResult = {
  texts: string[];
  usage: VoicePassUsage;
};

/** Numeric evidence, so a rewrite cannot quietly invent or drop a dimension. */
function numbersIn(text: string): Set<string> {
  return new Set((text.match(/\d[\d.,]*/g) ?? []).map((value) => value.replace(/[.,]$/, "")));
}

function sameNumbers(a: string, b: string): boolean {
  const left = numbersIn(a);
  const right = numbersIn(b);
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

/**
 * Whether a rewrite may replace the original. Deliberately strict: this is the
 * only thing standing between a joke and a fabricated measurement.
 */
export function voiceRewriteIsSafe(original: string, rewrite: string): boolean {
  const next = rewrite.trim();
  if (next === "") return false;
  const ratio = next.length / Math.max(original.trim().length, 1);
  if (ratio < 0.4 || ratio > 2.2) return false;
  return sameNumbers(original, next);
}

const SYSTEM = [
  "You are a copy editor for construction snagging reports. You rewrite text into a given voice.",
  "You change wording ONLY. You never add, remove or alter a fact, a measurement, a material, a location, a defect, a status or a trade. Every number in the original appears in your rewrite, unchanged.",
  "You return json.",
].join(" ");

function userPrompt(texts: string[], toneId: ReportToneId): string {
  const tone = toneById(toneId);
  const examples = (tone.voiceExamples ?? []).map((example) => `"${example}"`).join(" ");
  return [
    `VOICE: ${tone.label}. ${tone.instruction}`,
    examples ? `Examples of the voice, for register only — copy how they are written, never their subject matter: ${examples}` : null,
    // The transformation, shown rather than described. Telling a model the voice
    // is called "wry understatement" asks it to interpret a label; showing one
    // straight line and the same line in the voice asks it to copy a move. The
    // subject here is deliberately unlike any survey type and carries no numbers,
    // so nothing in it can be taken as a fact about the photograph.
    [
      "THE TRANSFORMATION, shown once. Straight:",
      '"Sealant has been applied inconsistently, leaving gaps at the frame head."',
      "In this voice:",
      '"Sealant applied in places, and the frame head remains open to the weather — a bold approach to keeping the rain out."',
      "Nothing factual moved: same defect, same location, same extent. Only the register changed.",
    ].join(" "),
    "Rewrite each of the items below in that voice. Keep each to one or two sentences and roughly the length of the original. Do not summarise, do not add a conclusion, do not explain the cause.",
    "Every item must carry exactly one dry, understated aside of the kind a site manager would say to a colleague — never two, and never a joke that costs a fact. An item that comes back as plain technical description has failed this task. Where the original already contains an aside, keep it rather than replacing it.",
    `Return json as {"texts": [...]} with exactly ${texts.length} items, in the same order.`,
    texts.map((text, index) => `${index + 1}. ${text}`).join("\n"),
  ]
    .filter((part): part is string => part !== null)
    .join("\n\n");
}

type ChatReply = { content: string | null; inputTokens: number; outputTokens: number };

/**
 * One text-only completion, in whichever wire format the active provider uses.
 * Deliberately separate from `adapters.server.ts`: those send a photograph and
 * demand a survey envelope, and this needs neither. Returns null for a provider
 * this does not speak for, so the caller keeps the original prose rather than
 * failing the photograph.
 */
async function textChat(
  config: AiConfig,
  body: { system: string; user: string; maxTokens: number },
): Promise<ChatReply | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    if (config.provider === "deepseek" || config.provider === "openai") {
      const openaiCompatible = config.provider === "openai";
      const url = openaiCompatible
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.deepseek.com/chat/completions";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.models.triage,
          // DeepSeek takes max_tokens, OpenAI takes max_completion_tokens.
          ...(openaiCompatible
            ? { max_completion_tokens: body.maxTokens }
            : { max_tokens: body.maxTokens, thinking: { type: "disabled" } }),
          messages: [
            { role: "system", content: body.system },
            { role: "user", content: body.user },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!response.ok) return null;
      const raw = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        content: raw.choices?.[0]?.message?.content ?? null,
        inputTokens: raw.usage?.prompt_tokens ?? 0,
        outputTokens: raw.usage?.completion_tokens ?? 0,
      };
    }

    if (config.provider === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.models.triage,
          max_tokens: body.maxTokens,
          system: body.system,
          messages: [{ role: "user", content: body.user }],
        }),
      });
      if (!response.ok) return null;
      const raw = (await response.json()) as {
        content?: Array<{ type?: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      return {
        content: raw.content?.find((part) => part.type === "text")?.text ?? null,
        inputTokens: raw.usage?.input_tokens ?? 0,
        outputTokens: raw.usage?.output_tokens ?? 0,
      };
    }

    // Google is not spoken here. The caller keeps the original prose and the
    // report is unaffected — see the limitation recorded in the skill.
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseTexts(content: string): string[] | null {
  try {
    const parsed = JSON.parse(content) as { texts?: unknown };
    if (!Array.isArray(parsed.texts)) return null;
    return parsed.texts.map((item) => (typeof item === "string" ? item : ""));
  } catch {
    return null;
  }
}

/**
 * Rewrites prose in the report's voice, one call for the whole photograph.
 * Never throws, and never returns fewer items than it was given.
 */
export async function applyVoicePass(
  texts: string[],
  toneId: ReportToneId,
  config: AiConfig,
): Promise<VoicePassResult | null> {
  if (texts.length === 0) return null;
  if (!toneById(toneId).voicePass) return null;

  const reply = await textChat(config, {
    system: SYSTEM,
    user: userPrompt(texts, toneId),
    maxTokens: Math.min(config.maxOutputTokens, 4000),
  });
  if (!reply?.content) return null;

  const rewritten = parseTexts(reply.content);
  if (!rewritten || rewritten.length !== texts.length) return null;

  let kept = 0;
  const out = texts.map((original, index) => {
    const candidate = rewritten[index] ?? "";
    if (voiceRewriteIsSafe(original, candidate)) return candidate.trim();
    kept += 1;
    return original;
  });

  return {
    texts: out,
    usage: {
      model: config.models.triage,
      inputTokens: reply.inputTokens,
      outputTokens: reply.outputTokens,
      rewritten: texts.length - kept,
      keptOriginal: kept,
    },
  };
}
