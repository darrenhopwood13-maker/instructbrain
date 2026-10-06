// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { TradeOrganiser } from "@/components/review/trade-organiser";
import type { Finding } from "@/lib/types";

/**
 * Allocating snags to trades the way rooms are allocated to photographs: tick
 * some, then allocate them — or accept the assessment's suggestion in one press.
 * Nothing is allocated until a person presses something.
 */

const asFinding = (
  id: string,
  ref: string,
  title: string,
  assignedTrade: string | null,
  aiSuggestedTrade: string | null = null,
  aiTradeConfidence: number | null = null,
): Finding =>
  ({
    id,
    ref,
    title,
    location: "L1",
    trade: assignedTrade ?? "Trade not assigned",
    status: "fail",
    aiDrafted: true,
    confirmed: false,
    isConfidential: false,
    photoIds: [],
    note: "",
    description: "Desc.",
    remedial: "",
    assignedTrade,
    aiSuggestedTrade,
    aiTradeConfidence,
  }) as unknown as Finding;

const findings = [
  asFinding("a", "F-001", "Needs a trade", null),
  asFinding("b", "F-002", "Already assigned", "Bricklayer"),
  asFinding("c", "F-003", "Also needs one", null, "Groundworks", 0.92),
  asFinding("d", "F-004", "Quiet one", null, "Roofing", 0.31),
  asFinding("e", "F-005", "Sitting on groundworks", "Groundworks"),
];

const tradeOptions = ["Bricklayer", "Groundworks", "Roofing"];

function renderOrganiser(onAssign = vi.fn().mockResolvedValue(undefined)) {
  render(
    <TradeOrganiser
      findings={findings}
      tradeOptions={tradeOptions}
      threshold={0.8}
      onAssign={onAssign}
    />,
  );
  return onAssign;
}

describe("trade organiser", () => {
  afterEach(cleanup);

  it("shows the unallocated bucket first and counts what is outstanding", () => {
    renderOrganiser();

    expect(screen.getByText(/5 findings . 2 allocated . 3 unallocated/)).toBeTruthy();
    expect(screen.getByText("Unallocated")).toBeTruthy();

    // Every snag is listed, grouped: the unallocated ones in the bucket first.
    expect(screen.getByLabelText(/F-002/)).toBeTruthy();
    expect(screen.getByLabelText(/F-005/)).toBeTruthy();

    const section = screen.getByRole("region", { name: /trades/i }).textContent ?? "";
    expect(section.indexOf("Unallocated")).toBeLessThan(section.indexOf("Bricklayer"));
  });

  it("allocates nothing until someone presses something", () => {
    const onAssign = renderOrganiser();
    expect(onAssign).not.toHaveBeenCalled();
  });

  it("accepts every suggestion in one press, one write per trade", async () => {
    const onAssign = renderOrganiser();

    fireEvent.click(screen.getByRole("button", { name: /use all 2 suggestions/i }));

    await waitFor(() => expect(onAssign).toHaveBeenCalledTimes(2));
    expect(onAssign).toHaveBeenCalledWith(["c"], "Groundworks");
    expect(onAssign).toHaveBeenCalledWith(["d"], "Roofing");
  });

  it("says how many of the suggestions it applied were low-confidence", async () => {
    renderOrganiser();

    fireEvent.click(screen.getByRole("button", { name: /use all 2 suggestions/i }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("2 suggestions applied");
    expect(status.textContent).toContain("1 of them low-confidence");
  });

  it("allocates a ticked snag into an existing trade group", async () => {
    const onAssign = renderOrganiser();

    fireEvent.click(screen.getByLabelText(/F-001/));
    fireEvent.click(screen.getByRole("button", { name: /add 1 to bricklayer/i }));

    await waitFor(() => expect(onAssign).toHaveBeenCalledTimes(1));
    expect(onAssign).toHaveBeenCalledWith(["a"], "Bricklayer");
  });

  it("leaves a snag with no suggestion alone, and says so rather than dropping it", async () => {
    const onAssign = renderOrganiser();

    fireEvent.click(screen.getByLabelText(/F-001/));
    fireEvent.click(screen.getByLabelText(/F-003/));
    fireEvent.click(screen.getByRole("button", { name: /use suggestions for 2/i }));

    await waitFor(() => expect(onAssign).toHaveBeenCalledTimes(1));
    expect(onAssign).toHaveBeenCalledWith(["c"], "Groundworks");

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("1 had no trade suggested, still to allocate");
  });

  it("ticks every unallocated snag in one press", () => {
    renderOrganiser();

    fireEvent.click(screen.getByRole("button", { name: /tick the 3 unallocated/i }));

    expect((screen.getByLabelText(/F-001/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/F-003/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/F-004/) as HTMLInputElement).checked).toBe(true);
  });
});
