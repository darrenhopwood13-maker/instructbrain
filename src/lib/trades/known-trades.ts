import { systemDefinitions } from "@/lib/survey-definitions";
import { tradesOf, type SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * The trades the templates themselves offer, gathered from every survey type.
 *
 * Two things have to line up for an extract to reach the right trade:
 *
 *   1. the assessment names a trade — it is handed `tradesOf(snapshot)` for the
 *      report's own template and its suggestion is stored against that name;
 *   2. the project directory holds a row whose trade matches it exactly —
 *      distribution groups by trade and looks the recipient up by that string.
 *
 * A blank box lets a person type "Roofing" against a suggestion of "Roofer".
 * The two never meet, the finding has no recipient, and it falls to the
 * fallback recipient instead of the roofer. So the picker offers this list.
 *
 * Derived from the definitions, never hardcoded — adding a trade to a template
 * adds it here, and no discipline-specific word lives outside a definition.
 */
export function knownTrades(): string[] {
  const seen = new Set<string>();
  for (const definition of systemDefinitions) {
    for (const trade of tradesOf(definition as unknown as SurveyTypeSnapshot)) {
      if (trade.trim() !== "") seen.add(trade.trim());
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * What the picker shows: trades already on this project first — so the same job
 * stays consistent with itself — then everything else the templates recognise.
 * Identity is case-insensitive, matching how allocation groups trades.
 */
export function tradeOptions(existing: readonly string[] = []): string[] {
  const seen = new Set<string>();
  const options: string[] = [];
  for (const candidate of [...existing, ...knownTrades()]) {
    const named = candidate.trim();
    if (named === "") continue;
    const key = named.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(named);
  }
  return options;
}
