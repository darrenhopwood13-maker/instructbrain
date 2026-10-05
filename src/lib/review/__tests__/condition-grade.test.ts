import { describe, expect, it } from "vitest";
import {
  CONDITION_GRADE_CODES,
  CONDITION_GRADE_LEGEND,
  conditionGradeLabel,
  conditionGradeOf,
  conditionGradeSummary,
  gradeSuggestion,
  isConditionGrade,
  normaliseConditionGrade,
  orderByWorstFirst,
  ungradedFindings,
  type GradableFinding,
} from "@/lib/review/condition-grade";

/** Fixtures live in the test file. */

function finding(overrides: Partial<GradableFinding> = {}): GradableFinding {
  return {
    id: "f1",
    ref: "S-001",
    conditionGrade: null,
    aiSuggestedGrade: null,
    aiGradeConfidence: null,
    ...overrides,
  };
}

describe("the condition grade legend", () => {
  it("is a single ordered list of four tiers, best first, letters only", () => {
    expect(CONDITION_GRADE_LEGEND.map((grade) => grade.code)).toEqual(["A", "B", "C", "D"]);
    expect(CONDITION_GRADE_LEGEND.map((grade) => grade.label)).toEqual([
      "Good",
      "Satisfactory",
      "Fair",
      "Poor",
    ]);
    // Every tier carries a meaning; none is a bare label.
    expect(CONDITION_GRADE_LEGEND.every((grade) => grade.meaning.trim().length > 0)).toBe(true);
    expect(CONDITION_GRADE_CODES).toEqual(["A", "B", "C", "D"]);
  });
});

describe("normaliseConditionGrade", () => {
  it("treats a lower-case letter as the same grade as its upper-case form", () => {
    expect(normaliseConditionGrade("a")).toBe("A");
    expect(normaliseConditionGrade("b")).toBe("B");
    expect(normaliseConditionGrade("a")).toBe(normaliseConditionGrade("A"));
  });

  it("trims surrounding whitespace before reading the grade", () => {
    expect(normaliseConditionGrade("  c  ")).toBe("C");
  });

  it("rejects an off-legend value rather than silently accepting it", () => {
    for (const junk of ["E", "good", "1", "AB", "", "   ", "F", "A+", null, undefined, 2]) {
      expect(normaliseConditionGrade(junk)).toBeNull();
    }
  });

  it("does not promote an off-legend value to the best grade", () => {
    // The failure mode this guards: defaulting an unknown grade to "A" would
    // put "Good" on a report nobody chose.
    expect(normaliseConditionGrade("Good")).not.toBe("A");
    expect(normaliseConditionGrade("Excellent")).toBeNull();
  });

  it("resolves a defined grade to its label and meaning", () => {
    expect(conditionGradeOf("b")).toEqual({
      code: "B",
      label: "Satisfactory",
      meaning: "Sound but needs routine maintenance.",
    });
    expect(conditionGradeLabel("d")).toBe("Poor");
    expect(isConditionGrade("C")).toBe(true);
    expect(isConditionGrade("C+")).toBe(false);
  });
});

describe("conditionGradeSummary", () => {
  it("counts each grade and reports the ungraded separately", () => {
    const findings = [
      finding({ id: "a", conditionGrade: "A" }),
      finding({ id: "b", ref: "S-002", conditionGrade: "B" }),
      finding({ id: "c", ref: "S-003", conditionGrade: "b" }),
      finding({ id: "d", ref: "S-004", conditionGrade: "D" }),
      finding({ id: "e", ref: "S-005" }),
      finding({ id: "f", ref: "S-006" }),
    ];
    const summary = conditionGradeSummary(findings);

    expect(summary.total).toBe(6);
    expect(summary.graded).toBe(4);
    expect(summary.ungraded).toBe(2);
    expect(summary.byGrade).toEqual([
      { code: "A", label: "Good", meaning: "As new or recently renewed, no action.", count: 1 },
      {
        code: "B",
        label: "Satisfactory",
        meaning: "Sound but needs routine maintenance.",
        count: 2,
      },
      {
        code: "C",
        label: "Fair",
        meaning: "Deteriorating, planned repair or replacement.",
        count: 0,
      },
      {
        code: "D",
        label: "Poor",
        meaning: "Defective or a risk, urgent attention.",
        count: 1,
      },
    ]);
  });

  it("never counts an ungraded finding as a grade", () => {
    const summary = conditionGradeSummary([
      finding({ id: "a" }),
      finding({ id: "b", ref: "S-002" }),
    ]);
    expect(summary.ungraded).toBe(2);
    expect(summary.graded).toBe(0);
    // No tier has absorbed the ungraded items.
    expect(summary.byGrade.every((tier) => tier.count === 0)).toBe(true);
    expect(summary.byGrade.reduce((sum, tier) => sum + tier.count, 0)).toBe(0);
  });

  it("always states all four tiers, even when a report holds nothing", () => {
    const summary = conditionGradeSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.byGrade.map((tier) => tier.code)).toEqual(["A", "B", "C", "D"]);
  });

  it("rejects an off-legend stored value into the ungraded count, not a tier", () => {
    const summary = conditionGradeSummary([finding({ conditionGrade: "excellent" })]);
    expect(summary.ungraded).toBe(1);
    expect(summary.byGrade.every((tier) => tier.count === 0)).toBe(true);
  });
});

describe("orderByWorstFirst", () => {
  it("puts the ungraded first, then the worst grade down to the best", () => {
    const findings = [
      finding({ id: "a", conditionGrade: "A" }),
      finding({ id: "b", ref: "S-002", conditionGrade: "D" }),
      finding({ id: "c", ref: "S-003" }),
      finding({ id: "d", ref: "S-004", conditionGrade: "C" }),
      finding({ id: "e", ref: "S-005", conditionGrade: "B" }),
      finding({ id: "f", ref: "S-006" }),
    ];
    expect(orderByWorstFirst(findings).map((item) => item.id)).toEqual([
      "c",
      "f",
      "b",
      "d",
      "e",
      "a",
    ]);
  });

  it("keeps the input order within one grade rather than reshuffling", () => {
    const findings = [
      finding({ id: "a", conditionGrade: "B" }),
      finding({ id: "b", ref: "S-002", conditionGrade: "B" }),
      finding({ id: "c", ref: "S-003", conditionGrade: "B" }),
    ];
    expect(orderByWorstFirst(findings).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the list it is given", () => {
    const findings = [
      finding({ id: "a", conditionGrade: "A" }),
      finding({ id: "b", ref: "S-002", conditionGrade: "D" }),
    ];
    orderByWorstFirst(findings);
    expect(findings.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("ungradedFindings", () => {
  it("returns only the findings a person has not yet graded", () => {
    const findings = [
      finding({ id: "a", conditionGrade: "A" }),
      finding({ id: "b", ref: "S-002" }),
      finding({ id: "c", ref: "S-003", conditionGrade: "nonsense" }),
    ];
    expect(ungradedFindings(findings).map((item) => item.id)).toEqual(["b", "c"]);
  });
});

describe("gradeSuggestion", () => {
  it("returns the assessment's grade and keeps a low confidence marked, not dropped", () => {
    const suggestion = gradeSuggestion({ aiSuggestedGrade: "c", aiGradeConfidence: 0.31 }, 0.8);
    expect(suggestion).toEqual({
      grade: { code: "C", label: "Fair", meaning: "Deteriorating, planned repair or replacement." },
      confidence: 0.31,
      confident: false,
    });
  });

  it("marks a well-supported suggestion as confident", () => {
    expect(
      gradeSuggestion({ aiSuggestedGrade: "B", aiGradeConfidence: 0.94 }, 0.8)?.confident,
    ).toBe(true);
  });

  it("returns nothing when the assessment proposed no grade", () => {
    expect(gradeSuggestion({ aiSuggestedGrade: null, aiGradeConfidence: 0.9 }, 0.8)).toBeNull();
    expect(gradeSuggestion({ aiSuggestedGrade: "E", aiGradeConfidence: 0.9 }, 0.8)).toBeNull();
  });

  it("accepts a suggestion with no confidence recorded, keeping the number null", () => {
    expect(gradeSuggestion({ aiSuggestedGrade: "A", aiGradeConfidence: null }, 0.8)).toEqual({
      grade: { code: "A", label: "Good", meaning: "As new or recently renewed, no action." },
      confidence: null,
      confident: false,
    });
  });
});
