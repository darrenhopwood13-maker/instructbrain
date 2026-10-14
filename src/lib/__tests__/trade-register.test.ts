import { describe, expect, it } from "vitest";
import { knownTrades, registerFirstOptions } from "@/lib/trades/known-trades";

describe("what a picker offers for a report", () => {
  const template = ["Roofer", "Groundworks", "Decorator"];

  it("offers the job's own register when it has one, and nothing else", () => {
    // A trade the job has let nobody for has nobody to send to. Offering it
    // looks like an allocation and quietly delivers to the fallback instead.
    expect(registerFirstOptions(["Decorator", "Tiler"], template)).toEqual(["Decorator", "Tiler"]);
  });

  it("falls back to the template's list only when there is no job behind it", () => {
    expect(registerFirstOptions([], template)).toEqual(["Decorator", "Groundworks", "Roofer"]);
    expect(registerFirstOptions(["   "], template)).toEqual(["Decorator", "Groundworks", "Roofer"]);
  });

  it("de-duplicates and sorts, so one job reads the same way twice", () => {
    // One spelling per trade: allocation matches trades without case, so two
    // spellings would be two names offered for one thing.
    expect(registerFirstOptions(["Tiler", "tiler", "Decorator"], template)).toEqual([
      "Decorator",
      "Tiler",
    ]);
  });

  it("is a different question to the whole library", () => {
    expect(knownTrades().length).toBeGreaterThan(registerFirstOptions(["Decorator"], template).length);
  });
});
