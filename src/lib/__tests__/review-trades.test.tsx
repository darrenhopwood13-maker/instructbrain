// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ReviewList } from "@/components/review-list";
import type { Finding } from "@/lib/types";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * The complaint this answers, in the owner's words: "I need to be able to easily
 * view and confirm trades." Five findings with no confirmed trade blocked an
 * issue, the dialog named them as bare text, and in a long schedule on a phone
 * there was nothing that said how many were outstanding or showed only those.
 */
const snapshot = {
  id: "test",
  label: "Test survey",
  requiresTradeAssignment: true,
  statuses: [
    { id: "pass", label: "Satisfactory", tone: "pass", shortcut: "p" },
    { id: "fail", label: "Defective", tone: "fail", shortcut: "f" },
    { id: "not_assessed", label: "Not assessed", tone: "neutral" },
  ],
} as unknown as SurveyTypeSnapshot;

const asFinding = (id: string, ref: string, title: string, assignedTrade: string | null): Finding =>
  ({
    id,
    ref,
    title,
    location: "L1",
    trade: assignedTrade ?? "Trade not assigned",
    status: "fail",
    aiDrafted: true,
    confirmed: true,
    isConfidential: false,
    photoIds: [],
    note: "",
    description: "Desc.",
    remedial: "",
    assignedTrade,
    likelyCause: null,
    likelyCauseConfirmed: false,
    regulatoryReference: null,
    regulatoryReferenceConfirmed: false,
  }) as unknown as Finding;

const findings = [
  asFinding("a", "F-001", "Needs a trade", null),
  asFinding("b", "F-002", "Already assigned", "Bricklayer"),
  asFinding("c", "F-003", "Also needs one", "  "),
];

function renderList() {
  return render(
    <ReviewList
      snapshot={snapshot}
      findings={findings}
      onConfirm={() => Promise.resolve()}
      onAssignTrade={() => Promise.resolve()}
    />,
  );
}

describe("trades still to confirm", () => {
  // Auto-cleanup is not wired up in this suite, so a second render in the same
  // file would leave the first screen mounted and match twice.
  afterEach(cleanup);

  it("counts the findings with no confirmed trade", () => {
    renderList();
    expect(screen.getByRole("button", { name: /trades to confirm/i }).textContent).toContain(
      "2 left",
    );
  });

  it("shows only those findings once it is turned on, and says it is showing them", () => {
    renderList();
    const toggle = screen.getByRole("button", { name: /trades to confirm/i });
    fireEvent.click(toggle);

    // The one that already has a trade is gone; the two outstanding ones remain.
    expect(screen.queryByRole("button", { name: /Open .*Already assigned/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Open .*Also needs one/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /showing trades to confirm/i })).toBeTruthy();
  });

  it("stays out of the way when every trade is confirmed", () => {
    render(
      <ReviewList
        snapshot={snapshot}
        findings={[asFinding("b", "F-002", "Already assigned", "Bricklayer")]}
        onConfirm={() => Promise.resolve()}
        onAssignTrade={() => Promise.resolve()}
      />,
    );
    expect(screen.queryByRole("button", { name: /trades to confirm/i })).toBeNull();
  });

  it("is not offered at all on a survey type that does not assign trades", () => {
    render(
      <ReviewList
        snapshot={{ ...snapshot, requiresTradeAssignment: false } as unknown as SurveyTypeSnapshot}
        findings={findings}
        onConfirm={() => Promise.resolve()}
        onAssignTrade={() => Promise.resolve()}
      />,
    );
    expect(screen.queryByRole("button", { name: /trades to confirm/i })).toBeNull();
  });
});
