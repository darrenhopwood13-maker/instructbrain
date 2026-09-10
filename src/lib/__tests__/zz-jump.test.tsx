// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewList } from "@/components/review-list";
import type { Finding } from "@/lib/types";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

const snapshot = {
  id: "test",
  label: "Test survey",
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

describe("jump to first not assessed", () => {
  it("moves the visible card to the first not assessed finding", async () => {
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
    // not_assessed sorts first, so start there then move away
    screen.getByRole("button", { name: /^next$/i }).click();
    screen.getByRole("button", { name: /^next$/i }).click();
    expect(screen.getByText("Third fail")).toBeTruthy();
    screen.getByRole("button", { name: /go to first unresolved/i }).click();
    expect(screen.getByText("Blocked one")).toBeTruthy();
    expect(screen.queryByText("Third fail")).toBeNull();
  });
});
