/**
 * Translation is a DISPLAY layer. English is always the record copy: nothing
 * here overwrites a finding, a document or a version. Translations are cached
 * per report AND per language, so one report can exist in several languages at
 * once and be sent in each of them.
 */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";

const PRESERVE =
  'Preserve exactly: product names ("instructBrain", "instructSite", "Instruct"), company and trade names, ' +
  "person names, acronyms (BSR, CDM, RICS, NHBC, MEP, PPE, RAMS, CSCS, BS/EN, HSE, H&S, QA, RFI, PDF), " +
  "regulatory references and clause numbers, measurements, units, dates, currency, reference codes such as F-012, " +
  "numbers, and placeholders like {plan}.";

async function callModel(system: string, payload: unknown): Promise<Record<string, unknown>> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("The translation service is not configured.");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`The translation service returned ${response.status}. ${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? "";
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
