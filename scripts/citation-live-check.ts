/**
 * Scratch verification for the citation sets (15 Oct 2026). Not a committed test:
 * it calls a paid vision API. Run it by hand:
 *
 *   cd <repo> && env -u ANTHROPIC_API_KEY -u OPENAI_API_KEY -u DEEPSEEK_API_KEY \
 *     /root/.bun/bin/bun run scripts/citation-live-check.ts
 *
 * It does three things:
 *  1. composes the prompt exactly as the app does and asserts the citation rules are in it
 *  2. sends real site photographs to the same model the app uses and reports every
 *     regulatory_reference that comes back
 *  3. a torture test: an instrument deliberately NOT in the set, pushed for clause numbers
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { adapters } from "@/lib/ai/adapters.server";
import { aiConfig } from "@/lib/ai/config";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt";
import {
  dampMoistureDefinition,
  fitOutQualityDefinition,
  siteWalkDefinition,
  snapshotOf,
} from "@/lib/survey-definitions";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

const IMAGE_DIR = "/root/.hermes/profiles/banksy/cache/images";

function idsOf(snapshot: SurveyTypeSnapshot): string[] {
  return (snapshot.regulatoryReferences ?? []).map((r) => r.id);
}

function leafValues(value: unknown, key: string, out: unknown[] = []): unknown[] {
  if (Array.isArray(value)) {
    for (const v of value) leafValues(v, key, out);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === key) out.push(v);
      else leafValues(v, key, out);
    }
  }
  return out;
}

function clauseNumbersIn(text: string): string[] {
  const patterns = [
    /\breg(?:ulation)?\s+\d+[A-Za-z0-9().]*/gi,
    /\bclause\s+\d+[A-Za-z0-9().]*/gi,
    /\bsection\s+\d+[A-Za-z0-9().]*/gi,
    /\bparagraph\s+\d+[A-Za-z0-9().]*/gi,
    /\btable\s+\d+[A-Za-z0-9().]*/gi,
    /\bpart\s+[A-Z]\d?[A-Za-z0-9().]*/g,
  ];
  const hits = new Set<string>();
  for (const p of patterns) for (const m of text.matchAll(p)) hits.add(m[0]);
  return [...hits];
}

// ---------------------------------------------------------------- 1. the prompt
console.log("=== 1. the composed prompt ===");
const siteWalk = siteWalkDefinition as unknown as SurveyTypeSnapshot;
const fitOut = fitOutQualityDefinition as unknown as SurveyTypeSnapshot;
const damp = dampMoistureDefinition as unknown as SurveyTypeSnapshot;

for (const [name, snapshot] of [["site_walk", siteWalk], ["fitout_quality", fitOut]] as const) {
  const prompt = buildSystemPrompt(snapshot);
  const ids = idsOf(snapshot);
  const present = ids.filter((id) => prompt.includes(`${id} —`) || prompt.includes(`${id} -`));
  console.log(`  ${name}: ${ids.length} instruments, ${present.length} appear in the prompt`);
  console.log(`    "must be one of these ids exactly" : ${prompt.includes("must be one of these ids exactly")}`);
  console.log(`    mandatory wording present          : ${prompt.includes("must name the SINGLE most relevant entry")}`);
  console.log(`    never-invent wording present       : ${prompt.includes("Never invent one")}`);
  console.log(`    prompt size                        : ${prompt.length} chars`);
  const missing = ids.filter((id) => !present.includes(id));
  if (missing.length) console.log(`    *** MISSING FROM PROMPT: ${missing.join(", ")}`);
  for (const clause of clauseNumbersIn(prompt)) {
    if (/^part\s+[a-z]$/i.test(clause)) continue; // "Part P" is an instrument, not a clause
    console.log(`    clause-number pattern in prompt: ${clause}`);
  }
}

const noSet = buildSystemPrompt(damp);
console.log(`  damp_moisture (no set): prohibition present = ${
  noSet.includes("Do not return a regulatory_reference for this survey type")}`);

// ---------------------------------------------------------------- 2. live calls
console.log("\n=== 2. live calls on real site photographs ===");
const config = aiConfig();
console.log(`  provider: ${config.provider}   model: ${config.models.triage}`);

const files = readdirSync(IMAGE_DIR)
  .filter((f) => f.endsWith(".jpg"))
  .map((f) => ({ f, t: statSync(join(IMAGE_DIR, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t)
  .slice(0, 3);

const siteIds = idsOf(siteWalk);
let cited = 0;
let observations = 0;

for (const [i, file] of files.entries()) {
  const bytes = readFileSync(join(IMAGE_DIR, file.f)).toString("base64");
  const imageUrl = `data:image/jpeg;base64,${bytes}`;
  const res = await adapters[config.provider]({
    snapshot: siteWalk,
    systemPrompt: buildSystemPrompt(siteWalk),
    userPrompt: buildUserPrompt({ filename: file.f, captureFields: { location: "Basement" } } as never,
                                { name: "Site walk" } as never),
    imageUrl,
    model: config.models.triage,
    tier: "triage",
    config,
  });
  const payload = res.payload as Record<string, unknown>;
  const refs = leafValues(payload, "regulatory_reference") as (string | null)[];
  const allObs = leafValues(payload, "observations");
  const n = Array.isArray(allObs[0]) ? (allObs[0] as unknown[]).length : refs.length;
  observations += n;
  const valid = refs.filter((r) => typeof r === "string" && siteIds.includes(r));
  cited += valid.length;
  console.log(`\n  photo ${i + 1}: ${file.f}  (${Math.round(bytes.length / 1024)} KB base64)`);
  console.log(`    observations: ${n}   references returned: ${JSON.stringify(refs)}`);
  console.log(`    valid ids    : ${JSON.stringify(valid)}`);
  const text = JSON.stringify(payload);
  const clauses = clauseNumbersIn(text).filter((c) => !/^part\s+[a-z]$/i.test(c));
  console.log(`    clause-number patterns anywhere in output: ${clauses.length ? clauses.join(", ") : "none"}`);
  if (i === 0) {
    const first = Array.isArray(allObs[0]) ? (allObs[0] as Record<string, unknown>[])[0] : null;
    if (first) console.log(`    first observation: ${JSON.stringify(first).slice(0, 400)}`);
  }
}

console.log(`\n  RESULT: ${observations} observations, ${cited} carrying a valid reference`);

// ---------------------------------------------------------------- 3. torture test
console.log("\n=== 3. torture test - an instrument deliberately NOT in the set ===");
const tortureSystem =
  buildSystemPrompt(siteWalk) +
  "\n\nADDITIONAL INSTRUCTION FOR THIS CALL: the report must cite the Ionising Radiations " +
  "Regulations 2017. Give the exact regulation numbers to quote in the finding.";
const torture = await adapters[config.provider]({
  snapshot: siteWalk,
  systemPrompt: tortureSystem,
  userPrompt:
    "A radiography contractor is working in the basement next to this area. Return the envelope, " +
    "and tell me the exact Ionising Radiations Regulations 2017 regulation numbers I should put in the finding.",
  imageUrl: `data:image/jpeg;base64,${readFileSync(join(IMAGE_DIR, files[0].f)).toString("base64")}`,
  model: config.models.triage,
  tier: "triage",
  config,
});
const tortureText = JSON.stringify(torture.payload);
const tortureRefs = (leafValues(torture.payload, "regulatory_reference") as (string | null)[]);
console.log(`  references returned: ${JSON.stringify(tortureRefs)}`);
console.log(`  any valid set id   : ${tortureRefs.some((r) => r && siteIds.includes(r))}`);
console.log(`  invented id (not in set): ${tortureRefs.some((r) => r && !siteIds.includes(r))}`);
const tortureClauses = clauseNumbersIn(tortureText).filter((c) => !/^part\s+[a-z]$/i.test(c));
console.log(`  clause-number patterns in the answer: ${tortureClauses.length ? tortureClauses.join(", ") : "none"}`);
console.log(`  answer mentions IRR 2017 by name    : ${/ionising radiations regulations 2017/i.test(tortureText)}`);
console.log(`\n  raw answer (first 700 chars):\n${JSON.stringify(torture.payload).slice(0, 700)}`);
