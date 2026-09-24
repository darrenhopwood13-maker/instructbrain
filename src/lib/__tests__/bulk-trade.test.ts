import { describe, expect, it } from "vitest";
import { bulkTradeEligible } from "@/lib/findings/bulk-trade";
import { tradesOf } from "@/lib/survey-types";
import type { Finding } from "@/lib/types";

const f = (over: Partial<Finding>): Finding => ({
  id: over.id ?? "x",
  ref: "F-1",
  title: "",
  location: "",
  trade: "",
  status: "not_assessed",
  aiDrafted: true,
  confirmed: false,
  isConfidential: false,
  photoIds: [],
  note: "",
  ...over,
});

describe("bulk trade confirmation", () => {
  it("only offers unassigned findings with a suggestion at or above 80%", () => {
    const list = [
      f({ id: "a", aiSuggestedTrade: "Roofer", aiTradeConfidence: 0.8 }),
      f({ id: "b", aiSuggestedTrade: "Roofer", aiTradeConfidence: 0.79 }),
      f({ id: "c", aiSuggestedTrade: null, aiTradeConfidence: 0.95 }),
      f({ id: "d", aiSuggestedTrade: "Roofer", aiTradeConfidence: 0.9, assignedTrade: "Glazier" }),
      f({ id: "e", aiSuggestedTrade: "Roofer", aiTradeConfidence: null }),
    ];
    expect(bulkTradeEligible(list).map((x) => x.id)).toEqual(["a"]);
  });

  it("offers the definition's standard trades", () => {
    expect(tradesOf({ standardTrades: ["Principal contractor"] } as never)).toContain(
      "Principal contractor",
    );
  });
});
