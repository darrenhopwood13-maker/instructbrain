import { describe, expect, it } from "vitest";
import {
  TRADE_ALLOCATION_DEFAULT,
  resolveTradeAllocation,
  tradeAllocationActive,
} from "@/lib/trade-switch";

describe("resolveTradeAllocation", () => {
  it("defaults to on when nothing has been set anywhere", () => {
    expect(TRADE_ALLOCATION_DEFAULT).toBe(true);
    expect(resolveTradeAllocation(null, null)).toBe(true);
    expect(resolveTradeAllocation(undefined, undefined)).toBe(true);
  });

  it("follows the account switch when the report has no opinion", () => {
    expect(resolveTradeAllocation(false, null)).toBe(false);
    expect(resolveTradeAllocation(true, null)).toBe(true);
  });

  it("lets a report override the account, in both directions", () => {
    expect(resolveTradeAllocation(true, false)).toBe(false);
    expect(resolveTradeAllocation(false, true)).toBe(true);
  });

  it("treats a missing report value as inherit, not as off", () => {
    expect(resolveTradeAllocation(false, undefined)).toBe(false);
    expect(resolveTradeAllocation(true, undefined)).toBe(true);
  });

  it("ignores anything that is not a boolean", () => {
    expect(resolveTradeAllocation("false", 0)).toBe(true);
    expect(resolveTradeAllocation(true, "false")).toBe(true);
  });
});

describe("tradeAllocationActive", () => {
  it("needs both the switch and a template that asks for trades", () => {
    const asks = { requiresTradeAssignment: true } as never;
    const doesNot = { requiresTradeAssignment: false } as never;
    expect(tradeAllocationActive(asks, true)).toBe(true);
    expect(tradeAllocationActive(asks, false)).toBe(false);
    expect(tradeAllocationActive(doesNot, true)).toBe(false);
    expect(tradeAllocationActive(doesNot, false)).toBe(false);
  });

  it("never adds a trade layer to a template that has none, or to no template", () => {
    expect(tradeAllocationActive(null, true)).toBe(false);
    expect(tradeAllocationActive(undefined, true)).toBe(false);
  });
});
