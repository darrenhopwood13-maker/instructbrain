// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
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

describe("go to first unresolved", () => {
  it("jumps back to the first not assessed finding and focuses its card", () => {
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
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(visibleTitle()).toBe("Third fail");
    fireEvent.click(screen.getByRole("button", { name: /go to first unresolved/i }));
    expect(visibleTitle()).toBe("Blocked one");
    expect(document.activeElement?.textContent).toContain("Blocked one");
  });
});
