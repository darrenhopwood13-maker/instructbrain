// @vitest-environment jsdom
import { describe, it } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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

const asFinding = (id: string, ref: string, status: string, title: string, photoIds: string[] = []): Finding =>
  ({
    id, ref, title, location: "L1", trade: "Trade not assigned", status,
    aiDrafted: true, confirmed: false, isConfidential: false, photoIds,
    note: "", description: "Desc.", remedial: "",
    likelyCause: null, likelyCauseConfirmed: false,
    regulatoryReference: null, regulatoryReferenceConfirmed: false,
  }) as unknown as Finding;

const visibleTitle = () =>
  document.querySelector("ul[aria-label='Findings for review'] li p.font-semibold")?.textContent;

// Simulate a real browser click: mousedown moves focus to the button first.
function realClick(el: HTMLElement) {
  fireEvent.mouseDown(el);
  act(() => { el.focus(); });
  fireEvent.mouseUp(el);
  fireEvent.click(el);
}

describe("real click", () => {
  it("jump works with browser-like focus", () => {
    render(
      <ReviewList
        snapshot={snapshot}
        findings={[
          asFinding("a", "F-001", "pass", "First pass", ["p1"]),
          asFinding("b", "F-002", "not_assessed", "Blocked one", ["p2"]),
          asFinding("c", "F-003", "not_assessed", "Blocked two", ["p3"]),
          asFinding("d", "F-004", "fail", "Third fail", ["p4"]),
        ]}
        onConfirm={() => Promise.resolve()}
      />,
    );
    console.log("initial:", visibleTitle());
    realClick(screen.getByRole("button", { name: /^next$/i }));
    console.log("after next1:", visibleTitle());
    realClick(screen.getByRole("button", { name: /^next$/i }));
    console.log("after next2:", visibleTitle());
    realClick(screen.getByRole("button", { name: /go to first unresolved/i }));
    console.log("after jump:", visibleTitle());
  });
});
