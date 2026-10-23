import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AiNotConfiguredError, aiConfig } from "@/lib/ai/config";
import { callTextJson } from "@/lib/ai/text-json.server";
import type { CompareDimension } from "@/lib/map/compare";

/**
 * Reads a loose question and maps it onto values that already exist in the caller's data.
 *
 * The model is given a closed list per dimension and may only answer from it. It never sees a
 * count, never sees a finding, and never produces a number - the arithmetic all happens in the
 * browser against the same items the dashboard draws. So the worst a bad answer can do is pick the
 * wrong real trade, which reads as an odd comparison rather than a false figure.
 *
 * If no provider key is configured the caller is told plainly and the deterministic matcher is
 * used instead; a missing key must not look like a broken comparison.
 */

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["dimension", "groups", "unmatched"],
  properties: {
    dimension: { type: "string", enum: ["trade", "project", "severity", "hazard", "survey", "month"] },
    groups: { type: "array", items: { type: "string" }, maxItems: 4 },
    unmatched: { type: "array", items: { type: "string" }, maxItems: 4 },
  },
} as const;

const SYSTEM = `You map a construction site manager's question about their own survey findings onto values that already exist in their data.

Rules:
1. Choose exactly one dimension from: trade, project, severity, hazard, survey, month.
2. Choose one to four values, copied character for character from that dimension's list. Never invent a value, never reword one, never pluralise one.
3. Pick the dimension where BOTH sides of the comparison appear if there is one. A town name may appear inside a project address - that counts as that project.
4. Anything the reader named that appears in no list goes in "unmatched" as they wrote it.
5. If the question only names one side, return that one value; the app compares it against everything else.
6. If nothing in the question matches any list, return an empty groups array.
7. Each value comes with its own counts (raised, open, overdue, median days to close), listed worst first by overdue. When the question asks which is worst, slowest, dragging its heels or sitting on the most late work, return up to four values in that order - the worst first - and only choose values whose counts support it.
8. One value means "this against everything else", so only return a single value when the question names exactly one thing.
9. Never state a number yourself. The app counts everything; you only choose which of their real values the question is about.

Return json only, in this shape:
{"dimension": "trade", "groups": ["Electrical", "M&E"], "unmatched": []}`;

const vocabularySchema = z.record(z.string(), z.array(z.string()).max(600));

export type InterpretResult =
  | {
      status: "ok";
      dimension: CompareDimension;
      groups: string[];
      unmatched: string[];
      model: string;
    }
  | { status: "no_match"; note: string }
  | { status: "no_model"; note: string }
  | { status: "error"; note: string };

export const interpretCompare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        query: z.string().trim().min(2).max(300),
        // The closed list the model may answer from: the caller's own values, nothing else.
        vocabulary: vocabularySchema,
        // Counts behind those values, so a "which is worst" question has something to judge on.
        profile: z
          .record(
            z.string(),
            z
              .array(
                z.object({
                  value: z.string(),
                  raised: z.number(),
                  open: z.number(),
                  overdue: z.number(),
                  medianDaysToClose: z.number().nullable(),
                }),
              )
              .max(60),
          )
          .optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<InterpretResult> => {
    let config;
    try {
      config = aiConfig();
    } catch (error) {
      if (error instanceof AiNotConfiguredError) {
        return {
          status: "no_model",
          note: "No AI provider key is configured, so the question was read by the built-in matcher only.",
        };
      }
      throw error;
    }

    // Only pass dimensions that actually have values; an empty list invites a guess.
    const values: Record<string, string[]> = {};
    for (const [dimension, list] of Object.entries(data.vocabulary)) {
      if (list.length > 0) values[dimension] = list.slice(0, 400);
    }
    if (Object.keys(values).length === 0) {
      return { status: "no_match", note: "There is nothing in scope to compare yet." };
    }

    try {
      const { payload } = await callTextJson(
        config,
        {
          system: SYSTEM,
          user: JSON.stringify({
            question: data.query,
            values: data.profile
              ? Object.fromEntries(
                  Object.entries(values).map(([dimension, list]) => {
                    const profiles = data.profile?.[dimension] ?? [];
                    const known = profiles.filter((entry) => list.includes(entry.value));
                    const extra = list
                      .filter((value) => !profiles.some((entry) => entry.value === value))
                      .map((value) => ({ value }));
                    // Worst first: the ordering is the judgement, and it comes from real counts.
                    return [dimension, [...known, ...extra].slice(0, 200)];
                  }),
                )
              : values,
          }),
        },
        {
          schema: SCHEMA as unknown as Record<string, unknown>,
          schemaName: "compare_reading",
          maxOutputTokens: 700,
          // Extraction, not writing: the same question should read the same way twice.
          temperature: 0,
        },
      );

      const raw = (payload ?? {}) as Record<string, unknown>;
      const dimension = typeof raw["dimension"] === "string" ? raw["dimension"] : "";
      const allowed = values[dimension] ?? [];
      const picked = Array.isArray(raw["groups"]) ? raw["groups"] : [];

      const groups: string[] = [];
      for (const entry of picked) {
        if (typeof entry !== "string") continue;
        const match = allowed.find((value) => value.toLowerCase() === entry.trim().toLowerCase());
        if (match && !groups.includes(match)) groups.push(match);
        if (groups.length >= 4) break;
      }

      if (!dimension || groups.length === 0) {
        return {
          status: "no_match",
          note: "The question did not name anything that exists in this data, so there is nothing to compare.",
        };
      }

      const unmatched = Array.isArray(raw["unmatched"])
        ? (raw["unmatched"] as unknown[]).filter((item): item is string => typeof item === "string").slice(0, 4)
        : [];

      return {
        status: "ok",
        dimension: dimension as CompareDimension,
        groups,
        unmatched,
        model: config.models.escalation,
      };
    } catch (error) {
      // A provider fault must not read as "your data has no answer".
      return {
        status: "error",
        note: error instanceof Error ? `The model call failed: ${error.message}` : "The model call failed.",
      };
    }
  });
