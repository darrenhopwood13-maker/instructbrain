/**
 * Diagnose the Gemini 400. Three questions:
 *  A. does the google adapter fail on a snapshot with NO citation set?  (-> adapter/schema issue)
 *  B. does it fail on site_walk WITH the new set?                       (-> my change)
 *  C. does the deepseek adapter work on the same call?                  (-> which provider is usable)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { adapters } from "@/lib/ai/adapters.server";
import { aiConfig, providerProfiles } from "@/lib/ai/config";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt";
import {
  propertyInventoryDefinition,
  siteWalkDefinition,
  snapshotOf,
} from "@/lib/survey-definitions";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

const IMAGE_DIR = "/root/.hermes/profiles/banksy/cache/images";
const config = aiConfig();

console.log("provider selected:", config.provider, "| model:", config.models.triage);
console.log("profiles available:", providerProfiles().map((p) => p.id).join(", "));

const file = readdirSync(IMAGE_DIR)
  .filter((f) => f.endsWith(".jpg"))
  .map((f) => ({ f, t: statSync(join(IMAGE_DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)[0];
const imageUrl = `data:image/jpeg;base64,${readFileSync(join(IMAGE_DIR, file.f)).toString("base64")}`;
console.log("photo:", file.f);

const cases: Array<[string, SurveyTypeSnapshot, string]> = [
  ["A. property_inventory (no set)", propertyInventoryDefinition as unknown as SurveyTypeSnapshot,
   config.provider],
  ["B. site_walk (21-instrument set)", siteWalkDefinition as unknown as SurveyTypeSnapshot,
   config.provider],
  ["C. site_walk on deepseek", siteWalkDefinition as unknown as SurveyTypeSnapshot, "deepseek"],
];

for (const [label, snapshot, provider] of cases) {
  const models = provider === "deepseek"
    ? { triage: "deepseek-chat", escalation: "deepseek-reasoner" }
    : config.models;
  try {
    const res = await adapters[provider as "google"]({
      snapshot,
      systemPrompt: buildSystemPrompt(snapshot),
      userPrompt: buildUserPrompt({ filename: file.f } as never, {} as never),
      imageUrl,
      model: models.triage,
      tier: "triage",
      config,
    });
    const refs: unknown[] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
          if (k === "regulatory_reference") refs.push(x);
          walk(x);
        }
      }
    };
    walk(res.payload);
    console.log(`\n${label}: OK  provider=${provider} tokens=${res.usage.outputTokens}`);
    console.log(`   references: ${JSON.stringify(refs)}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`\n${label}: FAILED via ${provider}`);
    console.log(`   ${msg.split("\n").slice(0, 6).join("\n   ")}`);
  }
}
