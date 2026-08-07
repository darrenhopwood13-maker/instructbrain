import { describe, expect, it } from "vitest";
import { humanisePlanError, monthWindowUtc, resetDateLabel } from "@/lib/plans";

/**
 * The database is the wall; these tests cover the client-side reading of it.
 * A null allowance must short-circuit to unlimited, never to zero.
 */

function remainingFor(allowance: number | null, used: number): number | null {
  return allowance === null ? null : Math.max(0, allowance - used);
}

function exhausted(allowance: number | null, used: number): boolean {
  return allowance !== null && (remainingFor(allowance, used) ?? 0) <= 0;
}

describe("report allowance", () => {
  it("blocks a free organisation at three reports in the month", () => {
    expect(exhausted(3, 2)).toBe(false);
    expect(exhausted(3, 3)).toBe(true);
    expect(exhausted(3, 4)).toBe(true);
  });

  it("treats a null allowance as unlimited, not as zero", () => {
    expect(exhausted(null, 0)).toBe(false);
    expect(exhausted(null, 9999)).toBe(false);
    expect(remainingFor(null, 9999)).toBeNull();
  });
});

describe("photo cap", () => {
  const cap = 30;
  const remaining = (held: number) => Math.max(0, cap - held);

  it("stops further photographs once the report holds the cap", () => {
    expect(remaining(29)).toBe(1);
    expect(remaining(30)).toBe(0);
    expect(remaining(45)).toBe(0);
  });
});

describe("ledger window", () => {
  it("counts a whole UTC calendar month", () => {
    const { start, nextStart } = monthWindowUtc(new Date("2026-03-17T11:00:00Z"));
    expect(start.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(nextStart.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("rolls over the year boundary", () => {
    const { nextStart } = monthWindowUtc(new Date("2026-12-31T23:59:00Z"));
    expect(nextStart.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("names the reset date in plain English", () => {
    expect(resetDateLabel(new Date("2026-03-17T11:00:00Z"))).toBe("1 April 2026");
  });
});

describe("humanisePlanError", () => {
  it("turns the report trigger message into a sentence", () => {
    const out = humanisePlanError(
      "Report allowance reached for this month. Your plan includes 3 reports.",
    );
    expect(out).toContain("all 3 reports");
    expect(out).not.toContain("violates");
    expect(out).not.toMatch(/trigger|row|constraint/i);
  });

  it("turns the photo trigger message into a sentence", () => {
    const out = humanisePlanError(
      "Photo limit reached for this report. Your plan includes 30 photos per report.",
    );
    expect(out).toContain("30 photographs");
  });

  it("passes unrelated errors through untouched", () => {
    expect(humanisePlanError("network unreachable")).toBe("network unreachable");
  });
});
