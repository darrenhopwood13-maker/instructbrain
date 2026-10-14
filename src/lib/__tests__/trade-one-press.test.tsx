// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  ONE_PRESS_CONFIDENCE,
  TradeAssignmentCard,
} from "@/components/review/trade-assignment-card";
import type { Finding } from "@/lib/types";

/**
 * The one-press allocation, per finding.
 *
 * The bulk version has been in the trade organiser at the same threshold; this is
 * the same rule for reviewing one item at a time. It is worth a test because the
 * whole point is that it fires ONLY when there is nothing left to decide: a
 * confident suggestion AND one firm holding that trade. Get that wrong in either
 * direction and it either allocates to a stranger or makes a person do work the
 * machine already did.
 */

const wiring: Finding = {
  id: "f1",
  ref: "F-001",
  title: "Missing surround",
  location: "Ground floor",
  trade: "Trade not assigned",
  status: "fail",
  aiDrafted: true,
  confirmed: false,
  isConfidential: false,
  photoIds: [],
  note: "",
  description: "No surround to the drainage gully.",
  remedial: "Form a surround.",
  severity: "high",
  assignedTrade: null,
  aiSuggestedTrade: "Groundworks",
  aiTradeConfidence: 0.92,
  aiTradeReasoning: "Exposed gully with no concrete surround.",
  dueDate: null,
  dueDateOverridden: false,
} as unknown as Finding;

const snapshot = {
  id: "snagging",
  version: 1,
  label: "Snagging",
  findingsPerPhoto: "single",
  statuses: [{ id: "fail", label: "Not compliant", tone: "fail" }],
  hazardCategories: [],
  regulatoryReferences: [],
} as never;

const soleHolders = new Map([["groundworks", "ABC Civil Engineering"]]);

/**
 * The card is a collapsed field until it is opened, and the allocation lives in
 * the opened panel. So every case opens it first and asserts the panel really is
 * on screen - otherwise the negative cases pass for the wrong reason, because a
 * closed card contains no button whatever the rule says.
 */
function renderCard(finding: Finding = wiring, holders: Map<string, string> | undefined = soleHolders) {
  const onAssign = vi.fn().mockResolvedValue(undefined);
  render(
    <TradeAssignmentCard
      finding={finding}
      snapshot={snapshot}
      tradeOptions={["Groundworks", "Decorator"]}
      soleHolders={holders}
      onAssign={onAssign}
    />,
  );
  const opener = screen.queryByRole("button", { name: /open responsible trade/i });
  if (opener) fireEvent.click(opener);
  expect(screen.getByRole("button", { name: /confirm assignment/i })).toBeTruthy();
  return onAssign;
}

describe("one press, when there is nothing left to decide", () => {
  afterEach(cleanup);

  it("offers the single action when the suggestion is confident and ONE firm holds the trade", () => {
    renderCard();
    expect(screen.getByRole("button", { name: /confirm and allocate to ABC Civil Engineering/i })).toBeTruthy();
  });

  it("allocates the suggested trade on that one press", async () => {
    const onAssign = renderCard();
    fireEvent.click(screen.getByRole("button", { name: /confirm and allocate/i }));
    await waitFor(() => expect(onAssign).toHaveBeenCalledTimes(1));
    expect(onAssign.mock.calls[0]?.[0]).toMatchObject({ trade: "Groundworks" });
  });

  it("does NOT offer it when two firms hold the trade", () => {
    // Two holders is a choice between two names. It belongs in the picker, where
    // both are visible, not in a button that picks one of them silently.
    renderCard(wiring, new Map());
    expect(screen.queryByRole("button", { name: /confirm and allocate/i })).toBeNull();
  });

  it("does NOT offer it below the confidence threshold", () => {
    renderCard({ ...wiring, aiTradeConfidence: ONE_PRESS_CONFIDENCE - 0.01 } as Finding);
    expect(screen.queryByRole("button", { name: /confirm and allocate/i })).toBeNull();
  });

  it("does NOT offer it when there is no suggestion at all", () => {
    renderCard({ ...wiring, aiSuggestedTrade: null, aiTradeConfidence: null } as Finding);
    expect(screen.queryByRole("button", { name: /confirm and allocate/i })).toBeNull();
  });

  it("does NOT offer it once a person has already assigned the item", () => {
    // A decided item is decided. Offering to decide it again is how an
    // allocation gets quietly overwritten.
    renderCard({ ...wiring, assignedTrade: "Decorator" } as Finding);
    expect(screen.queryByRole("button", { name: /confirm and allocate/i })).toBeNull();
  });
});
