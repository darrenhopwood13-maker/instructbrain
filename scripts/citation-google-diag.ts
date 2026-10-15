/**
 * Is the Gemini 400 caused by the citation work, or pre-existing?
 * Call the google adapter with a snapshot that has NO citation set, and with one that does.
 * If both fail identically, the schema issue predates this change.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { adapters } from "@/lib/ai/adapters.server";
import { aiConfig } from "@/lib/ai/config";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt";
import { propertyInventoryDefinition, siteWalkDefinition } from "@/lib/survey-definitions";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

const IMAGE_DIR = "/root/.hermes/profiles/banksy/cache/images";
const config = aiConfig();
const file = readdirSync(IMAGE_DIR)
  .filter((f) => f.endsWith(".jpg"))
  .map((f) => ({ f, t: statSync(join(IMAGE_DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)[0];
const imageUrl = `data:image/jpeg;base64,${readFileSync(join(IMAGE_DIR, file.f)).toString("base64")}`;

for (const [label, snapshot] of [
  ["google + property_inventory (NO set)", propertyInventoryDefinition],
  ["google + site_walk (21-instrument set)", siteWalkDefinition],
] as const) {
  try {
    const res = await adapters.google({
      snapshot: snapshot as unknown as SurveyTypeSnapshot,
      systemPrompt: buildSystemPrompt(snapshot as unknown as SurveyTypeSnapshot),
      userPrompt: buildUserPrompt({ filename: file.f } as never, {} as never),
      imageUrl,
      model: "gemini-2.5-flash",
      tier: "triage",
      config,
    });
    console.log(`${label}: OK (unexpected) tokens=${res.usage.outputTokens}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const first = msg.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 3).join(" | ");
    console.log(`${label}: FAILED -> ${first.slice(0, 240)}`);
  }
}
