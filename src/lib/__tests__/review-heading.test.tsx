// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ReviewList } from "@/components/review-list";
import type { Finding } from "@/lib/types";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * The observation must appear once on a finding card.
 *
 * On screen the card printed the same sentence twice — as the heading and again
 * under Description — because the heading was the first line of the observation
 * and the Description was all of it. These assertions count occurrences in the
 * rendered output, which is the only place the defect was ever visible.
 *
 * Every "counts once" assertion is paired with a control that proves the text
 * is being rendered at all: a count of zero would otherwise satisfy it.
 */

const snapshot = {
  id: "test",
  label: "Test survey",
  statuses: [
    { id: "pass", label: "Satisfactory", tone: "pass", shortcut: "p" },
    { id: "fail", label: "Defective", tone: "fail", shortcut: "f" },
    { id: "not_assessed", label: "Not assessed", tone: "neutral" },
  ],
} as unknown as SurveyTypeSnapshot;

const asFinding = (title: string, description: string): Finding =>
  ({
    id: "a",
    ref: "F-001",
    title,
    location: "L1",
    trade: "Trade not assigned",
    status: "fail",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: [],
    note: description,
    description,
    remedial: "",
    likelyCause: null,
    likelyCauseConfirmed: false,
    regulatoryReference: null,
    regulatoryReferenceConfirmed: false,
  }) as unknown as Finding;

const renderList = (finding: Finding) => {
  const { container } = render(<ReviewList snapshot={snapshot} findings={[finding]} />);
  return container.textContent ?? "";
};

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("a finding card prints its observation once", () => {
  it("drops a heading that would only restate the description", () => {
    const oneLine = "Lead and air hose traced across the slab";
    const text = renderList(asFinding(oneLine, oneLine));

    // The control: the sentence really is on the card.
    expect(occurrences(text, oneLine)).toBeGreaterThan(0);
    // The fix: exactly once.
    expect(occurrences(text, oneLine)).toBe(1);
  });

  it("still shows a real heading when it says something the description does not", () => {
    const text = renderList(asFinding("Rusted handrail", "The handrail has rusted through."));

    expect(text).toContain("Rusted handrail");
    expect(text).toContain("The handrail has rusted through.");
    expect(occurrences(text, "The handrail has rusted through.")).toBe(1);
  });

  it("does not print a long observation in full as its own heading", () => {
    const long =
      "The temporary stair up to the raised slab is propped at its base on loose timber offcuts and what appear to be bricks.";
    const text = renderList(asFinding(long, long));

    expect(text).toContain(long);
    expect(occurrences(text, long)).toBe(1);
  });

  it("matches the heading against the description across line breaks", () => {
    // Same words, different whitespace: still one sentence, still printed once.
    const flow = "Loose coping stone on the parapet";
    const wrapped = "Loose coping stone\non the parapet";
    const text = renderList(asFinding(flow, wrapped));

    expect(occurrences(text, "Loose coping stone")).toBe(1);
  });
});
