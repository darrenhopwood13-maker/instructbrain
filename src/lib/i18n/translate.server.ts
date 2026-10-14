/**
 * Translation is a DISPLAY layer. English is always the record copy: nothing
 * here overwrites a finding, a document or a version. Translations are cached
 * per report AND per language, so one report can exist in several languages at
 * once and be sent in each of them.
 *
 * IT RUNS ON THE DEPLOYMENT'S OWN PROVIDER. This used to be hard-wired to
 * OpenAI with its own key, which meant a translation silently depended on a
 * second key being alive while everything else ran on one — and when that key
 * went stale the 30-language feature failed on its own, with nothing in the
 * analysis path to show for it. It now uses whichever provider the app is
 * configured with and the same key as everything else.
 */

import { aiConfig, aiIsConfigured } from "@/lib/ai/config";

const PRESERVE =
  'Preserve exactly: product names ("instructBrain", "instructSite", "Instruct"), company and trade names, ' +
  "person names, acronyms (BSR, CDM, RICS, NHBC, MEP, PPE, RAMS, CSCS, BS/EN, HSE, H&S, QA, RFI, PDF), " +
  "regulatory references and clause numbers, measurements, units, dates, currency, reference codes such as F-012, " +
  "numbers, and placeholders like {plan}.";

const MAX_OUTPUT_TOKENS = 4096;

async function callModel(system: string, payload: unknown): Promise<Record<string, unknown>> {
  if (!aiIsConfigured()) throw new Error("The translation service is not configured.");

  const config = aiConfig();
  const model = config.models.triage;
  // DeepSeek accepts only `json_object` and requires the literal word "json" in
  // the prompt, so the shape is named in every language here rather than
  // enforced by the API. Harmless for the providers that do enforce it.
  const asks = `${system}\n\nReturn valid json only.`;
  const user = JSON.stringify(payload);

  let response: Response;
  let contentOf: (json: unknown) => string;

  if (config.provider === "anthropic") {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: asks,
        messages: [{ role: "user", content: user }],
      }),
    });
    contentOf = (json) =>
      ((json as { content?: { text?: string }[] })?.content ?? [])
        .map((part) => part?.text ?? "")
        .join("");
  } else if (config.provider === "google") {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: asks }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: MAX_OUTPUT_TOKENS },
        }),
      },
    );
    contentOf = (json) =>
      ((json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]
        ?.content?.parts ?? [])
        .map((part) => part?.text ?? "")
        .join("");
  } else {
    const deepseek = config.provider === "deepseek";
    response = await fetch(
      deepseek ? "https://api.deepseek.com/chat/completions" : "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          // DeepSeek takes max_tokens, OpenAI takes max_completion_tokens.
          ...(deepseek
            ? { max_tokens: MAX_OUTPUT_TOKENS, thinking: { type: "disabled" } }
            : { max_completion_tokens: MAX_OUTPUT_TOKENS }),
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: asks },
            { role: "user", content: user },
          ],
        }),
      },
    );
    contentOf = (json) =>
      (json as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content ?? "";
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`The translation service returned ${response.status}. ${body.slice(0, 200)}`);
  }

  const content = contentOf(await response.json());
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("The translation could not be read back.");
  }
}


/** Interface strings: same keys in, same keys out, English kept on any miss. */
export async function translateFlat(
  language: string,
  strings: Record<string, string>,
): Promise<Record<string, string>> {
  const system =
    `You are a professional interface translator for a UK construction reporting app. ` +
    `Translate the VALUES of the given JSON object into ${language}. ${PRESERVE} ` +
    `Keep the tone short, professional and plain. ` +
    `Return ONLY a JSON object with the SAME keys and translated string values.`;

  const parsed = await callModel(system, strings);
  const translations: Record<string, string> = {};
  for (const [key, english] of Object.entries(strings)) {
    const value = parsed[key];
    translations[key] = typeof value === "string" && value.length > 0 ? value : english;
  }
  return translations;
}

/**
 * Report prose: findings, remedials, summaries. Keys are opaque ids so the
 * caller can put the strings back exactly where they came from.
 */
export async function translateReportStrings(
  language: string,
  strings: Record<string, string>,
): Promise<Record<string, string>> {
  const entries = Object.entries(strings).filter(([, value]) => value.trim() !== "");
  if (entries.length === 0) return {};

  const system =
    `You are a professional translator of UK construction survey reports into ${language}. ` +
    `These are factual observations in a legal-adjacent document. Translate faithfully and neutrally: ` +
    `do not soften, strengthen, summarise, add blame, or add anything that is not in the source. ` +
    `An abstention or an unknown must stay an abstention or an unknown. ${PRESERVE} ` +
    `Return ONLY a JSON object with the SAME keys and translated string values.`;

  // Batched so a long report does not exceed a single response.
  const batches: [string, string][][] = [];
  const size = 40;
  for (let index = 0; index < entries.length; index += size) {
    batches.push(entries.slice(index, index + size));
  }

  const out: Record<string, string> = {};
  for (const batch of batches) {
    const payload = Object.fromEntries(batch);
    const parsed = await callModel(system, payload);
    for (const [key, english] of batch) {
      const value = parsed[key];
      out[key] = typeof value === "string" && value.length > 0 ? value : english;
    }
  }
  return out;
}
