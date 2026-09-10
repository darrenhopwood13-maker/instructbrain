// @vitest-environment jsdom
import { describe, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReviewList } from "@/components/review-list";
import type { Finding } from "@/lib/types";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

const snapshot = {
  id: "test", label: "Test survey",
  statuses: [
    { id: "pass", label: "Satisfactory", tone: "pass", shortcut: "p" },
    { id: "fail", label: "Defective", tone: "fail", shortcut: "f" },
    { id: "not_assessed", label: "Not assessed", tone: "neutral" },
  ],
} as unknown as SurveyTypeSnapshot;

const asFinding = (id: string, ref: string, status: string, title: string): Finding =>
  ({
    id, ref, title, location: "L1", trade: "Trade not assigned", status,
    aiDrafted: true, confirmed: false, isConfidential: false, photoIds: [],
    note: "", description: "Desc.", remedial: "",
    likelyCause: null, likelyCauseConfirmed: false,
    regulatoryReference: null, regulatoryReferenceConfirmed: false,
  }) as unknown as Finding;

const visibleTitle = () =>
  document.querySelector("ul[aria-label='Findings for review'] li p.font-semibold")?.textContent;

describe("trace", () => {
  it("traces", () => {
    render(
      <ReviewList
        snapshot={snapshot}
        findings={[
          asFinding("a", "F-001", "pass", "First pass"),
          asFinding("b", "F-002", "not_assessed", "Blocked one"),
          asFinding("c", "F-003", "fail", "Third fail"),
        ]}
        onConfirm={() => Promise.resolve()}
      />,
    );
    console.log("initial:", visibleTitle(), "| activeEl:", document.activeElement?.textContent?.slice(0,20));
    const next = screen.getByRole("button", { name: /^next$/i });
    fireEvent.click(next);
    console.log("after next1:", visibleTitle());
    fireEvent.click(next);
    console.log("after next2:", visibleTitle());
    fireEvent.click(screen.getByRole("button", { name: /go to first unresolved/i }));
    console.log("after jump:", visibleTitle());
  });
});
