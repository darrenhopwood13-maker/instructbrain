import { afterEach, describe, expect, it } from "vitest";

import {
  ESCALATION_AUTH_COOLDOWN_MS,
  escalationSkippedBecauseAuth,
  isAuthFailure,
  noteEscalationAuthFailure,
  resetEscalationGuard,
} from "@/lib/ai/escalation-guard";
import { isFast, speedFromValue } from "@/lib/ai/speed";

describe("the speed the AI is asked for", () => {
  it("treats anything that is not 'fast' as standard, which is the safer of the two", () => {
    expect(speedFromValue("fast")).toBe("fast");
    expect(speedFromValue("FAST")).toBe("fast");
    expect(speedFromValue("standard")).toBe("standard");
    expect(speedFromValue(null)).toBe("standard");
    expect(speedFromValue(undefined)).toBe("standard");
    expect(speedFromValue("")).toBe("standard");
    expect(speedFromValue("something else")).toBe("standard");
  });

  it("reports the two states plainly", () => {
    expect(isFast("fast")).toBe(true);
    expect(isFast("standard")).toBe(false);
    expect(isFast(null)).toBe(false);
  });
});

describe("a dead key on the second-opinion provider", () => {
  afterEach(() => resetEscalationGuard());

  it("recognises a rejected credential", () => {
    // the shape the live provider actually returned on a real report
    expect(
      isAuthFailure(
        'the AI provider returned 401. { "type": "invalid_request_error", "code": "invalid_api_key" }',
      ),
    ).toBe(true);
    expect(isAuthFailure("Incorrect API key provided: sk-4e60e***")).toBe(true);
    expect(isAuthFailure("Unauthorized")).toBe(true);
  });

  it("does not mistake another failure for a dead key", () => {
    expect(isAuthFailure("the AI provider returned 429 - rate limited")).toBe(false);
    expect(isAuthFailure("the request timed out")).toBe(false);
    expect(isAuthFailure("400 Unknown name additionalProperties")).toBe(false);
    expect(isAuthFailure(null)).toBe(false);
    expect(isAuthFailure(undefined)).toBe(false);
  });

  it("skips the second opinion for a while after one rejection", () => {
    const t = 1_000_000;
    expect(escalationSkippedBecauseAuth(t)).toBe(false);
    noteEscalationAuthFailure("the AI provider returned 401", t);
    expect(escalationSkippedBecauseAuth(t + 1)).toBe(true);
    expect(escalationSkippedBecauseAuth(t + ESCALATION_AUTH_COOLDOWN_MS - 1)).toBe(true);
    // and then tries again, so a key that gets fixed does not need a redeploy
    expect(escalationSkippedBecauseAuth(t + ESCALATION_AUTH_COOLDOWN_MS)).toBe(false);
  });

  it("keeps trying when the failure was something else", () => {
    const t = 5_000_000;
    noteEscalationAuthFailure("the AI provider returned 429 - rate limited", t);
    expect(escalationSkippedBecauseAuth(t + 1)).toBe(false);
    noteEscalationAuthFailure(null, t);
    expect(escalationSkippedBecauseAuth(t + 1)).toBe(false);
  });
});
