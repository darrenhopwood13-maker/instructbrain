/**
 * The condition grade: a fixed four-tier legend, and the arithmetic that reads
 * it back out of a set of findings.
 *
 * This module PROPOSES and PLANS. It never writes. A grade is a suggestion by
 * the machine and a decision by a person — the assessment proposes
 * `aiSuggestedGrade` beside its `aiGradeConfidence`, and only a person's
 * confirmed `conditionGrade` reads as fact on the report. Nothing here is
 * allowed to fill a missing grade in with a default: a finding with no
 * confirmed grade is *ungraded*, and is counted as its own thing, never as
 * "Good".
 *
 * The same discipline the trade allocation module states for trades applies
 * here: there is one place a grade is read from and one place it is counted,
 * so a grade cannot be set in one screen and read differently on the report.
 */

/**
 * The legend, in one ordered list best-to-worst. Order IS the contract: A is
 * the best grade and D the worst, so "worst first" is the reverse of this list.
 */
export const CONDITION_GRADE_LEGEND = [
  { code: "A", label: "Good", meaning: "As new or recently renewed, no action." },
  { code: "B", label: "Satisfactory", meaning: "Sound but needs routine maintenance." },
  { code: "C", label: "Fair", meaning: "Deteriorating, planned repair or replacement." },
  { code: "D", label: "Poor", meaning: "Defective or a risk, urgent attention." },
] as const;

export type ConditionGrade = (typeof CONDITION_GRADE_LEGEND)[number];
export type ConditionGradeCode = ConditionGrade["code"];

/** The letters, best to worst. Derived from the legend so the two cannot drift. */
export const CONDITION_GRADE_CODES: readonly ConditionGradeCode[] = CONDITION_GRADE_LEGEND.map(
  (grade) => grade.code,
);

const BY_CODE = new Map<string, ConditionGrade>(
  CONDITION_GRADE_LEGEND.map((grade) => [grade.code, grade]),
);

/**
 * The grade behind a stored value, or null.
 *
 * Identity is case-insensitive and trimmed, so a "b" typed by hand is the same
 * code as "B" — but anything outside the legend is REJECTED (null) rather than
 * quietly promoted to a grade. A value the legend does not define is not a
 * grade, and pretending it is would put a grade on a report that no person
 * chose and the machine never proposed.
 */
export function conditionGradeOf(value: unknown): ConditionGrade | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return BY_CODE.get(code) ?? null;
}

/** The bare letter for a stored value, or null when it is not a legend grade. */
export function normaliseConditionGrade(value: unknown): ConditionGradeCode | null {
  return conditionGradeOf(value)?.code ?? null;
}

/** Whether a value is a defined grade (case-insensitive, trimmed). */
export function isConditionGrade(value: unknown): boolean {
  return conditionGradeOf(value) !== null;
}

export function conditionGradeLabel(value: unknown): string | null {
  return conditionGradeOf(value)?.label ?? null;
}

/** The part of a finding this module reasons about. */
export type GradableFinding = {
  id: string;
  ref: string;
  /** The person's decision. Null until someone confirms one. */
  conditionGrade: string | null;
  /** The assessment's proposal, kept beside its confidence. */
  aiSuggestedGrade: string | null;
  aiGradeConfidence: number | null;
};

/**
 * The rank a grade sorts on, worst first.
 *
 * Ungraded sits BEFORE the worst grade, not after the best: an unconfirmed
 * grade is outstanding work, and a report that buried it at the bottom would
 * hide the one thing still to do. Then D, C, B, A.
 */
export function worstFirstRank(value: unknown): number {
  const code = normaliseConditionGrade(value);
  // Ungraded is the highest rank: it sits above even the worst grade, because an
  // unconfirmed grade is outstanding work, not a settled "Good".
  if (code === null) return CONDITION_GRADE_CODES.length + 1;
  // CONDITION_GRADE_CODES is best-first, so A ranks 1 and D ranks 4.
  return CONDITION_GRADE_CODES.indexOf(code) + 1;
}

/**
 * The findings, worst first, with the ungraded ones at the very top.
 *
 * The sort is stable on the input order within each rank, so a report never
 * reshuffles evidence that shares a grade.
 */
export function orderByWorstFirst<T extends GradableFinding>(findings: readonly T[]): T[] {
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((a, b) => {
      const rank =
        worstFirstRank(b.finding.conditionGrade) - worstFirstRank(a.finding.conditionGrade);
      return rank !== 0 ? rank : a.index - b.index;
    })
    .map((entry) => entry.finding);
}

export type ConditionGradeSummary = {
  total: number;
  /** Confirmed grades only. */
  graded: number;
  /** Not yet confirmed by a person — outstanding, and never a silent default. */
  ungraded: number;
  /**
   * One entry per legend tier, ALWAYS all four and in legend order, so the
   * closing count on a Schedule of Condition states every tier, including the
   * ones that hold nothing.
   */
  byGrade: Array<ConditionGrade & { count: number }>;
};

/**
 * Count the findings per grade, and count the ungraded ones separately.
 *
 * An ungraded finding is never folded into a tier. "Not yet confirmed" and
 * "confirmed Good" are different facts and the count must say so.
 */
export function conditionGradeSummary(findings: readonly GradableFinding[]): ConditionGradeSummary {
  const counts = new Map<ConditionGradeCode, number>();
  let ungraded = 0;
  let graded = 0;

  for (const finding of findings) {
    const code = normaliseConditionGrade(finding.conditionGrade);
    if (code === null) {
      ungraded += 1;
      continue;
    }
    graded += 1;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return {
    total: findings.length,
    graded,
    ungraded,
    byGrade: CONDITION_GRADE_LEGEND.map((grade) => ({
      ...grade,
      count: counts.get(grade.code) ?? 0,
    })),
  };
}

/** The ungraded findings, in input order — the ones still to be decided. */
export function ungradedFindings<T extends GradableFinding>(findings: readonly T[]): T[] {
  return findings.filter((finding) => normaliseConditionGrade(finding.conditionGrade) === null);
}

export type ConditionGradeSuggestion = {
  grade: ConditionGrade;
  /** The assessment's own number, kept even when it is low. */
  confidence: number | null;
  /** Enough support to accept without a second look. Presentation, not a filter. */
  confident: boolean;
};

/**
 * The assessment's own proposal for a finding, if it made one.
 *
 * A low-confidence proposal is NOT discarded — it is returned with
 * `confident: false`, so the interface can offer it while saying how sure the
 * machine was. Dropping it would leave a finding reading "no suggestion" beside
 * a recorded confidence, which is neither a suggestion nor an answer.
 */
export function gradeSuggestion(
  finding: Pick<GradableFinding, "aiSuggestedGrade" | "aiGradeConfidence">,
  threshold: number,
): ConditionGradeSuggestion | null {
  const grade = conditionGradeOf(finding.aiSuggestedGrade);
  if (grade === null) return null;
  const confidence =
    typeof finding.aiGradeConfidence === "number" && Number.isFinite(finding.aiGradeConfidence)
      ? finding.aiGradeConfidence
      : null;
  return {
    grade,
    confidence,
    confident: confidence !== null && confidence >= threshold,
  };
}
