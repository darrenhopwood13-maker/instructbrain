// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ConditionGradeCard } from "@/components/review/condition-grade-card";
import { ConditionGradeOrganiser } from "@/components/review/condition-grade-organiser";
import type { Finding } from "@/lib/types";

/**
 * The grade control in the review flow: a person picks a grade, or accepts the
 * assessment's suggestion in one tap — and the assessment's confidence number is
 * always shown beside its suggestion. Nothing is written until a person acts.
 */

const asFinding = (
  id: string,
  ref: string,
  title: string,
  conditionGrade: string | null,
  aiSuggestedGrade: string | null = null,
  aiGradeConfidence: number | null = null,
): Finding =>
  ({
    id,
    ref,
    title,
    location: "L1",
    trade: "Trade not assigned",
    status: "fail",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: [],
    note: "",
    description: "Desc.",
    remedial: "",
    conditionGrade,
    aiSuggestedGrade,
    aiGradeConfidence,
  }) as unknown as Finding;

describe("the condition grade card", () => {
  afterEach(cleanup);

  it("shows the assessment's suggestion together with its confidence", () => {
    render(
      <ConditionGradeCard
        finding={asFinding("a", "F-001", "Cracked render", null, "c", 0.84)}
        threshold={0.8}
        onGrade={vi.fn()}
      />,
    );

    expect(screen.getByText(/84% sure/)).toBeTruthy();
    expect(screen.getByText(/Not yet confirmed/)).toBeTruthy();
  });

  it("lets a person set a grade, and writes only what they chose", async () => {
    const onGrade = vi.fn().mockResolvedValue(undefined);
    render(
      <ConditionGradeCard
        finding={asFinding("a", "F-001", "Cracked render", null, "c", 0.84)}
        threshold={0.8}
        onGrade={onGrade}
      />,
    );

    // Nothing is written until a person acts.
    expect(onGrade).not.toHaveBeenCalled();

    // The control lives in the card's full-size overlay, like the trade card's.
    fireEvent.click(screen.getByRole("button", { name: /open condition grade/i }));
    fireEvent.change(screen.getByLabelText("Condition grade for F-001"), {
      target: { value: "D" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm grade for F-001" }));

    await waitFor(() => expect(onGrade).toHaveBeenCalledTimes(1));
    expect(onGrade).toHaveBeenCalledWith("D");
  });

  it("shows a confirmed grade with its meaning, and a missing grade as to be confirmed", () => {
    const { unmount } = render(
      <ConditionGradeCard
        finding={asFinding("b", "F-002", "Loose coping", "B")}
        threshold={0.8}
        onGrade={vi.fn()}
      />,
    );
    expect(screen.getByText(/B — Satisfactory/)).toBeTruthy();
    expect(screen.getByText(/Sound but needs routine maintenance/)).toBeTruthy();
    unmount();

    render(
      <ConditionGradeCard
        finding={asFinding("c", "F-003", "Nothing seen", null)}
        threshold={0.8}
        onGrade={vi.fn()}
      />,
    );
    expect(screen.getByText(/to be confirmed/)).toBeTruthy();
  });
});

describe("the condition grade organiser", () => {
  afterEach(cleanup);

  const findings = [
    asFinding("a", "F-001", "Already good", "A"),
    asFinding("b", "F-002", "Needs a decision", null),
    asFinding("c", "F-003", "Suggested fair", null, "C", 0.91),
  ];

  it("puts the ungraded items first and says how many are outstanding", () => {
    render(<ConditionGradeOrganiser findings={findings} threshold={0.8} onGrade={vi.fn()} />);

    expect(screen.getByText(/3 elements . 1 graded . 2 to be confirmed/)).toBeTruthy();

    const section = screen.getByRole("region", { name: /condition grades/i }).textContent ?? "";
    // The two ungraded items read before the one that is already graded Good.
    expect(section.indexOf("F-002")).toBeLessThan(section.indexOf("F-001"));
    expect(section.indexOf("F-003")).toBeLessThan(section.indexOf("F-001"));
    expect(screen.getAllByText("To be confirmed").length).toBeGreaterThanOrEqual(2);
  });

  it("grades one element when a person picks a grade for it", async () => {
    const onGrade = vi.fn().mockResolvedValue(undefined);
    render(<ConditionGradeOrganiser findings={findings} threshold={0.8} onGrade={onGrade} />);

    fireEvent.change(screen.getByLabelText("Grade F-002"), { target: { value: "D" } });

    await waitFor(() => expect(onGrade).toHaveBeenCalledTimes(1));
    expect(onGrade).toHaveBeenCalledWith(["b"], "D");
  });

  it("accepts the assessment's suggestions in one press, showing their confidence", async () => {
    const onGrade = vi.fn().mockResolvedValue(undefined);
    render(<ConditionGradeOrganiser findings={findings} threshold={0.8} onGrade={onGrade} />);

    expect(screen.getByText(/Suggested C — Fair, 91% sure, unconfirmed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /use all 1 grade suggestions/i }));

    await waitFor(() => expect(onGrade).toHaveBeenCalledTimes(1));
    expect(onGrade).toHaveBeenCalledWith(["c"], "C");
  });
});
