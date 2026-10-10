import { describe, expect, it } from "vitest";
import { knownTrades, tradeOptions } from "@/lib/trades/known-trades";

describe("knownTrades", () => {
  it("gathers the trades the templates declare, rather than a hardcoded list", () => {
    const trades = knownTrades();
    // Declared by the snagging definition's own categories.
    expect(trades).toContain("Roofer");
    expect(trades).toContain("Carpenter / joiner");
    // Declared by the site walk definition.
    expect(trades).toContain("Cleaning");
    expect(trades).toContain("Principal contractor");
  });

  it("is deduplicated and sorted, so the picker never repeats or jumbles", () => {
    const trades = knownTrades();
    expect(new Set(trades).size).toBe(trades.length);
    expect([...trades].sort((a, b) => a.localeCompare(b))).toEqual(trades);
  });

  it("carries no trade a template cannot actually suggest", () => {
    // The picker exists so a trade named in the directory can always match an
    // assessment's suggestion. A word no template declares defeats that.
    expect(knownTrades()).not.toContain("Roofing");
  });
});

describe("tradeOptions", () => {
  it("is the known list when the project has nothing on it yet", () => {
    expect(tradeOptions()).toEqual(knownTrades());
    expect(tradeOptions([])).toEqual(knownTrades());
  });

  it("puts the project's own trades first, so one job stays consistent", () => {
    expect(tradeOptions(["Roofer", "Groundworks"]).slice(0, 2)).toEqual([
      "Roofer",
      "Groundworks",
    ]);
  });

  it("does not repeat a project trade that is also a known one, whatever the case", () => {
    const options = tradeOptions(["roofer"]);
    expect(options[0]).toBe("roofer");
    expect(options.filter((trade) => trade.toLowerCase() === "roofer")).toHaveLength(1);
  });

  it("ignores blank entries", () => {
    expect(tradeOptions(["", "   ", "Roofer"])).not.toContain("");
    expect(tradeOptions(["  "]).every((trade) => trade.trim() !== "")).toBe(true);
  });
});
