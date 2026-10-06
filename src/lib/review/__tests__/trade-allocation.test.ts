import { describe, expect, it } from "vitest";
import {
  allocationPlan,
  allocationSummary,
  groupByTrade,
  suggestionPlan,
  type AllocatableFinding,
} from "@/lib/review/trade-allocation";

/** Fixtures live in the test file. */

function finding(overrides: Partial<AllocatableFinding> = {}): AllocatableFinding {
  return {
    id: "f1",
    ref: "S-001",
    title: "Cracked render to the east elevation",
    assignedTrade: null,
    aiSuggestedTrade: null,
    aiTradeConfidence: null,
    ...overrides,
  };
}

describe("allocationPlan", () => {
  it("allocates the chosen trade to every selected snag", () => {
    const findings = [finding({ id: "a" }), finding({ id: "b", ref: "S-002" })];
    const plan = allocationPlan(findings, ["a", "b"], "Groundworks");

    expect(plan.assignments).toEqual([
      { id: "a", trade: "Groundworks" },
      { id: "b", trade: "Groundworks" },
    ]);
    expect(plan.unchanged).toEqual([]);
    expect(plan.missing).toEqual([]);
  });

  it("refuses an unnamed trade rather than storing an allocation to nobody", () => {
    const findings = [finding({ id: "a" })];
    expect(() => allocationPlan(findings, ["a"], "   ")).toThrow(/Choose a trade/);
  });

  it("counts a snag already on that trade as unchanged, not as a new assignment", () => {
    const findings = [finding({ id: "a", assignedTrade: "Groundworks" })];
    const plan = allocationPlan(findings, ["a"], "Groundworks");

    expect(plan.assignments).toEqual([]);
    expect(plan.unchanged).toEqual(["a"]);
  });

  it("treats a different spelling of the same trade as already on it", () => {
    const findings = [finding({ id: "a", assignedTrade: "Roofing" })];
    const plan = allocationPlan(findings, ["a"], "  roofing ");

    expect(plan.assignments).toEqual([]);
    expect(plan.unchanged).toEqual(["a"]);
  });

  it("moves a snag that is allocated to a different trade", () => {
    const findings = [finding({ id: "a", assignedTrade: "Roofing" })];
    const plan = allocationPlan(findings, ["a"], "Groundworks");

    expect(plan.assignments).toEqual([{ id: "a", trade: "Groundworks" }]);
  });

  it("counts a selection once even when the same id is sent twice", () => {
    const findings = [finding({ id: "a" })];
    const plan = allocationPlan(findings, ["a", "a"], "Groundworks");
    expect(plan.assignments).toHaveLength(1);
  });

  it("reports an id that is not part of this report instead of inventing a row", () => {
    const findings = [finding({ id: "a" })];
    const plan = allocationPlan(findings, ["a", "ghost"], "Groundworks");

    expect(plan.assignments).toEqual([{ id: "a", trade: "Groundworks" }]);
    expect(plan.missing).toEqual(["ghost"]);
  });

  it("trims the trade so two spellings of one trade do not split the report", () => {
    const findings = [finding({ id: "a" })];
    const plan = allocationPlan(findings, ["a"], "  Groundworks  ");
    expect(plan.assignments).toEqual([{ id: "a", trade: "Groundworks" }]);
  });
});

describe("suggestionPlan", () => {
  it("returns the assessment's own trade, with its confidence kept", () => {
    const findings = [finding({ id: "a", aiSuggestedTrade: "Roofing", aiTradeConfidence: 0.42 })];
    const plan = suggestionPlan(findings, ["a"], 0.8);

    expect(plan.suggestions).toEqual([
      { id: "a", trade: "Roofing", confidence: 0.42, confident: false },
    ]);
    expect(plan.skipped).toEqual([]);
  });

  it("does not filter out a low-confidence suggestion, it marks it", () => {
    const findings = [
      finding({ id: "a", aiSuggestedTrade: "Roofing", aiTradeConfidence: 0.2 }),
      finding({ id: "b", ref: "S-002", aiSuggestedTrade: "Groundworks", aiTradeConfidence: 0.91 }),
    ];
    const plan = suggestionPlan(findings, ["a", "b"], 0.8);

    expect(plan.suggestions).toHaveLength(2);
    expect(plan.suggestions.map((item) => item.confident)).toEqual([true, false]);
  });

  it("puts the confident suggestions first, then the best supported", () => {
    const findings = [
      finding({ id: "a", aiSuggestedTrade: "Roofing", aiTradeConfidence: 0.55 }),
      finding({ id: "b", ref: "S-002", aiSuggestedTrade: "Groundworks", aiTradeConfidence: 0.95 }),
      finding({ id: "c", ref: "S-003", aiSuggestedTrade: "Joinery", aiTradeConfidence: 0.93 }),
    ];
    const plan = suggestionPlan(findings, ["a", "b", "c"], 0.9);

    expect(plan.suggestions.map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("skips a snag the assessment had no trade for, and says why", () => {
    const findings = [finding({ id: "a", ref: "S-007" })];
    const plan = suggestionPlan(findings, ["a"], 0.8);

    expect(plan.suggestions).toEqual([]);
    expect(plan.skipped).toEqual([
      { id: "a", ref: "S-007", reason: "The assessment named no trade for this snag." },
    ]);
  });

  it("treats a blank suggestion as no suggestion rather than allocating a blank trade", () => {
    const findings = [finding({ id: "a", aiSuggestedTrade: "   " })];
    const plan = suggestionPlan(findings, ["a"], 0.8);

    expect(plan.suggestions).toEqual([]);
    expect(plan.skipped).toHaveLength(1);
  });

  it("accepts a suggestion with no confidence recorded, keeping the number null", () => {
    const findings = [finding({ id: "a", aiSuggestedTrade: "Roofing" })];
    const plan = suggestionPlan(findings, ["a"], 0.8);

    expect(plan.suggestions).toEqual([
      { id: "a", trade: "Roofing", confidence: null, confident: false },
    ]);
  });
});

describe("groupByTrade", () => {
  it("puts unallocated snags first, then trades alphabetically", () => {
    const findings = [
      finding({ id: "a", assignedTrade: "Roofing" }),
      finding({ id: "b", ref: "S-002" }),
      finding({ id: "c", ref: "S-003", assignedTrade: "Groundworks" }),
    ];
    const groups = groupByTrade(findings);

    expect(groups.map((group) => group.trade)).toEqual([null, "Groundworks", "Roofing"]);
    expect(groups[0]?.findings.map((item) => item.id)).toEqual(["b"]);
  });

  it("always returns the unallocated bucket, even when it is empty", () => {
    const groups = groupByTrade([finding({ id: "a", assignedTrade: "Roofing" })]);
    expect(groups[0]).toEqual({ trade: null, findings: [] });
  });

  it("keeps the report's own order inside a group", () => {
    const findings = [
      finding({ id: "a", assignedTrade: "Roofing" }),
      finding({ id: "b", ref: "S-002", assignedTrade: "Roofing" }),
      finding({ id: "c", ref: "S-003", assignedTrade: "Roofing" }),
    ];
    const groups = groupByTrade(findings);
    expect(groups[1]?.findings.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("does not split one trade over two spellings or two cases", () => {
    const findings = [
      finding({ id: "a", assignedTrade: "Roofing" }),
      finding({ id: "b", ref: "S-002", assignedTrade: "  roofing " }),
    ];
    const groups = groupByTrade(findings);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.findings).toEqual([]);
    expect(groups[1]?.findings).toHaveLength(2);
  });
});

describe("allocationSummary", () => {
  it("counts allocated, unallocated and the unallocated ones already suggested", () => {
    const findings = [
      finding({ id: "a", assignedTrade: "Roofing" }),
      finding({ id: "b", ref: "S-002", aiSuggestedTrade: "Groundworks" }),
      finding({ id: "c", ref: "S-003" }),
      finding({ id: "d", ref: "S-004", assignedTrade: "Joinery", aiSuggestedTrade: "Joinery" }),
    ];
    const summary = allocationSummary(findings);

    expect(summary).toEqual({ total: 4, allocated: 2, unallocated: 2, suggested: 1 });
  });

  it("does not count an already-allocated snag's suggestion as outstanding", () => {
    const findings = [
      finding({ id: "a", assignedTrade: "Roofing", aiSuggestedTrade: "Groundworks" }),
    ];
    const summary = allocationSummary(findings);

    expect(summary.suggested).toBe(0);
    expect(summary.unallocated).toBe(0);
  });
});
