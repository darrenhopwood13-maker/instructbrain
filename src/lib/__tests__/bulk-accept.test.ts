import { describe, expect, it } from "vitest";
import { acceptPlan, type AcceptCandidate } from "@/lib/review/bulk-accept";

const NOT_ASSESSED = "not_assessed";

function candidate(overrides: Partial<AcceptCandidate> = {}): AcceptCandidate {
  return {
    id: overrides.id ?? "f1",
    ref: overrides.ref ?? "F-001",
    statusId: "snag",
    confirmed: false,
    assignedTrade: null,
    aiSuggestedTrade: "Groundworker",
    aiTradeConfidence: 0.9,
    conditionGrade: null,
    aiSuggestedGrade: "C3",
    aiGradeConfidence: 0.9,
    ...overrides,
  };
}

const base = { notAssessedId: NOT_ASSESSED, tradeRequired: false, gradeRequired: false };

describe("what one press may accept", () => {
  it("accepts an unread-confident item with nothing else required", () => {
    const plan = acceptPlan([candidate()], base);
    expect(plan.accept.map((item) => item.ref)).toEqual(["F-001"]);
    expect(plan.attention).toEqual([]);
    expect(plan.blocked).toBe(false);
  });

  it("counts what is already accepted and never rewrites it", () => {
    const plan = acceptPlan([candidate({ confirmed: true })], base);
    expect(plan.accept).toEqual([]);
    expect(plan.alreadyAccepted).toBe(1);
  });

  it("sends an unassessed item to a person, in plain words", () => {
    const plan = acceptPlan([candidate({ statusId: NOT_ASSESSED })], base);
    expect(plan.accept).toEqual([]);
    expect(plan.attention[0]?.reason).toBe("not_assessed");
    expect(plan.attention[0]?.detail).toMatch(/needs a status from you/);
    expect(plan.blocked).toBe(true);
  });
});

describe("trades, when the brief asks for them", () => {
  const trades = { ...base, tradeRequired: true };

  it("accepts the AI suggestion in the same press when it is confident", () => {
    const plan = acceptPlan([candidate()], trades);
    expect(plan.accept[0]?.trade).toBe("Groundworker");
    expect(plan.attention).toEqual([]);
  });

  it("leaves a low-confidence suggestion to a person and names it", () => {
    const plan = acceptPlan([candidate({ aiTradeConfidence: 0.5 })], trades);
    expect(plan.accept).toEqual([]);
    expect(plan.attention[0]?.reason).toBe("unsure_trade");
    expect(plan.attention[0]?.detail).toContain("Groundworker");
  });

  it("leaves a missing suggestion to a person", () => {
    const plan = acceptPlan([candidate({ aiSuggestedTrade: null })], trades);
    expect(plan.attention[0]?.reason).toBe("no_trade_suggested");
  });

  it("does not ask for a trade that a person has already chosen", () => {
    const plan = acceptPlan([candidate({ assignedTrade: "Bricklayer" })], trades);
    expect(plan.accept[0]?.trade).toBeNull();
    expect(plan.attention).toEqual([]);
  });

  it("asks for nothing at all when the account has trades switched off", () => {
    const plan = acceptPlan(
      [candidate({ aiSuggestedTrade: null, aiTradeConfidence: null })],
      base,
    );
    expect(plan.accept).toHaveLength(1);
    expect(plan.attention).toEqual([]);
  });
});

describe("grades, when the brief asks for them", () => {
  const grades = { ...base, gradeRequired: true };

  it("accepts a confident suggested grade in the same press", () => {
    expect(acceptPlan([candidate()], grades).accept[0]?.grade).toBe("C3");
  });

  it("leaves an unsure grade to a person", () => {
    const plan = acceptPlan([candidate({ aiGradeConfidence: 0.2 })], grades);
    expect(plan.attention[0]?.reason).toBe("unsure_grade");
  });

  it("leaves a missing grade to a person", () => {
    const plan = acceptPlan([candidate({ aiSuggestedGrade: null })], grades);
    expect(plan.attention[0]?.reason).toBe("no_grade_suggested");
  });
});

describe("the count on the button is the count that decides publishing", () => {
  it("settles trade and grade in one item, in one press", () => {
    const plan = acceptPlan([candidate()], { ...base, tradeRequired: true, gradeRequired: true });
    expect(plan.accept).toHaveLength(1);
    expect(plan.accept[0]?.trade).toBe("Groundworker");
    expect(plan.accept[0]?.grade).toBe("C3");
    expect(plan.blocked).toBe(false);
  });

  it("reports blocked as soon as one item needs a person", () => {
    const plan = acceptPlan(
      [candidate(), candidate({ id: "f2", ref: "F-002", statusId: NOT_ASSESSED })],
      { ...base, tradeRequired: true, gradeRequired: true },
    );
    expect(plan.accept.map((item) => item.ref)).toEqual(["F-001"]);
    expect(plan.attention.map((item) => item.ref)).toEqual(["F-002"]);
    expect(plan.blocked).toBe(true);
  });

  it("adds up: accepted before, accepted now and needing a person is every item", () => {
    const plan = acceptPlan(
      [
        candidate({ id: "f1", ref: "F-001", confirmed: true }),
        candidate({ id: "f2", ref: "F-002" }),
        candidate({ id: "f3", ref: "F-003", statusId: NOT_ASSESSED }),
      ],
      base,
    );
    expect(plan.alreadyAccepted + plan.accept.length + plan.attention.length).toBe(3);
  });
});
