import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiConfig } from "@/lib/ai/config";
import { applyVoicePass, voiceRewriteIsSafe } from "@/lib/ai/tone-pass.server";

/**
 * The voice pass exists because the register does not survive the vision prompt:
 * measured 1 run in 6 with the instruction alone, 2 findings in 18 once examples
 * in the voice were added to it. These tests hold the two things that make it
 * safe to ship — it changes prose, and it keeps every number.
 */
const config = {
  provider: "deepseek",
  apiKey: "test-key",
  models: { triage: "deepseek-flash", escalation: "deepseek-flash" },
  requestTimeoutMs: 1000,
  maxOutputTokens: 3000,
} as unknown as AiConfig;

function reply(texts: string[]): Response {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ texts }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    }),
  } as unknown as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe("a rewrite may only replace the original if it keeps every number", () => {
  it("accepts a rewrite that carries the same measurements", () => {
    expect(
      voiceRewriteIsSafe(
        "There is a 3-5 mm gap at the closing stile.",
        "The closing stile carries a 3-5 mm gap, which nobody has troubled to close.",
      ),
    ).toBe(true);
  });

  it("refuses a rewrite that drops a measurement", () => {
    expect(
      voiceRewriteIsSafe("A gap of 3-5 mm runs the height of the joint.", "The joint is open."),
    ).toBe(false);
  });

  it("refuses a rewrite that invents one", () => {
    expect(
      voiceRewriteIsSafe(
        "The paint is patchy.",
        "The paint is patchy over roughly 200 mm of the leaf.",
      ),
    ).toBe(false);
  });

  it("refuses an empty rewrite or one that has wandered far from the original", () => {
    expect(voiceRewriteIsSafe("The joints are ragged.", "   ")).toBe(false);
    expect(voiceRewriteIsSafe("The joints are ragged.", "No.")).toBe(false);
    expect(voiceRewriteIsSafe("The joints are ragged.", "x".repeat(400))).toBe(false);
  });
});

describe("the voice pass", () => {
  it("does nothing for a tone that reaches the model through the prompt", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await applyVoicePass(["The joints are ragged."], "formal", config)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rewrites prose in the voice, one call for the whole photograph", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        reply([
          "The padlock is secure, which is lovely, since the timber around it is flaking away.",
          "The pointing is ragged in places and inconsistent in width, in the way of work that stopped for lunch and never came back.",
        ]),
      ),
    );
    const result = await applyVoicePass(
      [
        "The padlock is secure. The timber around it is flaking.",
        "The pointing is ragged in places and inconsistent in width, with some joints recessed and some laid flush.",
      ],
      "sarcastic",
      config,
    );
    expect(result?.texts[0]).toContain("which is lovely");
    expect(result?.texts[1]).toContain("stopped for lunch");
    expect(result?.usage).toMatchObject({ rewritten: 2, keptOriginal: 0, inputTokens: 100 });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("keeps the original text where the rewrite would have changed a fact", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply(["The joint is open to roughly 40 mm.", "The gravel was swept in."])),
    );
    const original = ["The joint is open to roughly 10 mm.", "The gravel was swept in."];
    const result = await applyVoicePass(original, "sarcastic", config);
    expect(result?.texts[0]).toBe(original[0]);
    expect(result?.usage).toMatchObject({ rewritten: 1, keptOriginal: 1 });
  });

  it("returns nothing at all when the provider refuses or answers the wrong shape", async () => {
    const original = ["The joints are ragged."];

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401 }) as unknown as Response));
    expect(await applyVoicePass(original, "sarcastic", config)).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => reply(["only one of two items"])));
    expect(await applyVoicePass([...original, ...original], "sarcastic", config)).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(await applyVoicePass(original, "sarcastic", config)).toBeNull();
  });
});
