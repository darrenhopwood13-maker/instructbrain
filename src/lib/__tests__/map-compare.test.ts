import { describe, expect, it } from "vitest";

import type { DashboardItem } from "@/lib/analytics/item-map";
import {
  compareSuggestions,
  comparisonFor,
  rankComparison,
  scopedComparison,
  modelProfile,
  modelVocabulary,
  parseComparison,
  validateInterpretation,
  type CompareDimension,
} from "@/lib/map/compare";

const TODAY = "2026-10-23";

function item(overrides: Partial<DashboardItem> = {}): DashboardItem {
  return {
    id: "i1",
    ref: "SNG-001",
    title: "Damaged board",
    status: "open",
    lifecycleState: "open",
    severity: "high",
    hazardCategory: null,
    dueDate: "2026-10-30",
    createdAt: "2026-10-02T09:00:00Z",
    assignedTrade: null,
    reportId: "r1",
    reportRef: "R-001",
    reportTitle: "Report",
    reportDate: "2026-10-02",
    surveyLabel: "Finding identification & remedial schedule",
    projectId: "p1",
    projectName: "Northbank Phase 3",
    projectRef: "DEMO-01",
    closedAt: null,
    updatedAt: null,
    ...overrides,
  };
}

const ITEMS: DashboardItem[] = [
  // Electrical: one closed in 10 days, one late
  item({
    id: "e1",
    assignedTrade: "Electrical",
    lifecycleState: "verified",
    closedAt: "2026-10-12T09:00:00Z",
    updatedAt: "2026-10-13T09:00:00Z",
    createdAt: "2026-10-02T09:00:00Z",
  }),
  item({
    id: "e2",
    assignedTrade: "Electrical",
    lifecycleState: "open",
    dueDate: "2026-10-01",
    severity: "high",
  }),
  // M&E: one closed in 40 days, none late
  item({
    id: "m1",
    assignedTrade: "M&E",
    lifecycleState: "verified",
    closedAt: "2026-10-21T09:00:00Z",
    updatedAt: "2026-10-22T09:00:00Z",
    createdAt: "2026-09-11T09:00:00Z",
  }),
  item({
    id: "m2",
    assignedTrade: "M&E",
    lifecycleState: "open",
    dueDate: "2026-11-20",
    severity: "low",
    projectName: "Wellington Place",
  }),
];

describe("parseComparison", () => {
  it("compares two trades named in plain English", () => {
    const result = parseComparison("electrical vs M&E", ITEMS, TODAY);
    expect(result).not.toBeNull();
    expect(result?.dimension).toBe("trade");
    expect(result?.groups.map((group) => group.label)).toEqual(["Electrical", "M&E"]);
    expect(result?.againstRest).toBe(false);
  });

  it("measures cycle time from recorded close dates, not from what is still open", () => {
    const result = parseComparison("electrical vs M&E", ITEMS, TODAY);
    const electrical = result?.groups.find((group) => group.label === "Electrical");
    const me = result?.groups.find((group) => group.label === "M&E");
    expect(electrical?.medianDaysToClose).toBe(10);
    expect(me?.medianDaysToClose).toBe(40);
    expect(electrical?.overdue).toBe(1);
    expect(me?.overdue).toBe(0);
  });

  it("says which side closes faster", () => {
    const verdict = parseComparison("electrical vs M&E", ITEMS, TODAY)?.verdict ?? "";
    expect(verdict).toContain("Electrical closes in a median 10 days");
    expect(verdict).toContain("30 days quicker than M&E");
  });

  it("compares projects when the words are project names", () => {
    const result = parseComparison("Northbank against Wellington", ITEMS, TODAY);
    expect(result?.dimension).toBe("project");
    expect(result?.groups.map((group) => group.label)).toEqual([
      "Northbank Phase 3",
      "Wellington Place",
    ]);
  });

  it("compares severity when that is what was asked", () => {
    const result = parseComparison("high vs low severity", ITEMS, TODAY);
    expect(result?.dimension).toBe("severity");
    expect(result?.groups.map((group) => group.label)).toEqual(["High", "Low"]);
  });

  it("holds one named group against everything else", () => {
    const result = parseComparison("electrical", ITEMS, TODAY);
    expect(result?.againstRest).toBe(true);
    expect(result?.groups.map((group) => group.label)).toEqual(["Electrical", "Everything else"]);
    expect(result?.groups[1]?.raised).toBe(2);
  });

  it("refuses to invent a group when neither word exists in the data", () => {
    // Both trades are absent, so the honest answer is "nothing matches", not a made-up comparison.
    expect(parseComparison("bricklayer vs scaffolder", ITEMS, TODAY)).toBeNull();
  });

  it("holds the named side against the rest when the other word is not recognised", () => {
    const result = parseComparison("electrical vs scaffolder", ITEMS, TODAY);
    expect(result?.groups.map((group) => group.label)).toEqual(["Electrical", "Everything else"]);
    expect(result?.unmatched).toContain("scaffolder");
  });

  it("finds a project by its address and shows the project's own name", () => {
    const withAddress: DashboardItem[] = [
      item({ id: "a1", projectName: "Northbank Phase 3", projectAddress: "Wapping Wharf, Bristol BS1 6WE" }),
      item({ id: "a2", projectName: "Wellington Place Block C", projectAddress: "Wellington Place, Leeds LS1 4AP" }),
    ];
    const result = parseComparison("bristol vs leeds", withAddress, TODAY);
    expect(result?.dimension).toBe("project");
    expect(result?.groups.map((group) => group.label)).toEqual([
      "Northbank Phase 3",
      "Wellington Place Block C",
    ]);
  });

  it("returns nothing for an empty box", () => {
    expect(parseComparison("   ", ITEMS, TODAY)).toBeNull();
  });

  it("never shows a comparison without the caveat", () => {
    expect(parseComparison("electrical vs M&E", ITEMS, TODAY)?.caveat).toContain("recorded close date");
  });
});

describe("compareSuggestions", () => {
  it("offers examples built from the reader's own data", () => {
    const suggestions = compareSuggestions(ITEMS);
    expect(suggestions.length).toBeGreaterThan(1);
    expect(suggestions.some((suggestion) => suggestion.includes("Electrical"))).toBe(true);
  });
});

const VOCAB: Record<CompareDimension, string[]> = {
  trade: ["Electrical", "M&E"],
  project: ["Northbank Phase 3", "Wapping Wharf, Bristol BS1 6WE"],
  severity: ["high", "low"],
  hazard: [],
  survey: [],
  month: ["2026-10"],
};

describe("validateInterpretation - the guard on a model's answer", () => {
  it("keeps values that exist in the reader's data", () => {
    const result = validateInterpretation(VOCAB, {
      dimension: "trade",
      groups: ["Electrical", "M&E"],
      unmatched: [],
    });
    expect(result).toEqual({ dimension: "trade", groups: ["Electrical", "M&E"], unmatched: [] });
  });

  it("drops an invented value instead of comparing it", () => {
    const result = validateInterpretation(VOCAB, {
      dimension: "trade",
      groups: ["Scaffolder", "Electrical"],
      unmatched: ["scaffolder"],
    });
    expect(result?.groups).toEqual(["Electrical"]);
  });

  it("returns nothing when every value was invented", () => {
    expect(
      validateInterpretation(VOCAB, { dimension: "trade", groups: ["Scaffolder"], unmatched: [] }),
    ).toBeNull();
  });

  it("canonicalises the model's casing to the stored value", () => {
    const result = validateInterpretation(VOCAB, {
      dimension: "trade",
      groups: ["electrical"],
      unmatched: [],
    });
    expect(result?.groups).toEqual(["Electrical"]);
  });

  it("rejects a dimension that was not offered", () => {
    expect(
      validateInterpretation(VOCAB, { dimension: "supplier", groups: ["Electrical"], unmatched: [] }),
    ).toBeNull();
  });

  it("rejects a dimension with no values to choose from", () => {
    expect(validateInterpretation(VOCAB, { dimension: "hazard", groups: ["Waste"], unmatched: [] })).toBeNull();
  });
});

describe("comparisonFor", () => {
  it("builds the measured comparison from values alone", () => {
    const result = comparisonFor("trade", ["Electrical", "M&E"], ITEMS, TODAY);
    expect(result?.groups.map((group) => group.label)).toEqual(["Electrical", "M&E"]);
    expect(result?.groups[0]?.medianDaysToClose).toBe(10);
  });

  it("collapses a project named twice (by name and by address) into one group", () => {
    const withAddress: DashboardItem[] = [
      item({ id: "p1", projectName: "Northbank Phase 3", projectAddress: "Wapping Wharf, Bristol BS1 6WE" }),
      item({ id: "p2", projectName: "Wellington Place Block C", projectAddress: "Wellington Place, Leeds LS1 4AP" }),
    ];
    const result = comparisonFor(
      "project",
      ["Northbank Phase 3", "Wapping Wharf, Bristol BS1 6WE"],
      withAddress,
      TODAY,
    );
    expect(result?.groups.map((group) => group.label)).toEqual([
      "Northbank Phase 3",
      "Everything else",
    ]);
  });
});

describe("what a model is allowed to see", () => {
  it("sends project names and counts, never a project address", () => {
    const withAddress: DashboardItem[] = [
      item({ id: "p1", projectName: "Northbank Phase 3", projectAddress: "Wapping Wharf, Bristol BS1 6WE" }),
    ];
    const vocabulary = modelVocabulary(withAddress);
    const profile = modelProfile(withAddress, TODAY);

    expect(vocabulary.project).toEqual(["Northbank Phase 3"]);
    expect(JSON.stringify({ vocabulary, profile })).not.toContain("Wapping Wharf");
  });
});

describe("asking about a single site", () => {
  const site: DashboardItem[] = [
    item({ id: "s1", projectId: "p9", projectName: "Albert Dock Conversion", assignedTrade: "Electrical", lifecycleState: "open", dueDate: "2026-10-01" }),
    item({ id: "s2", projectId: "p9", projectName: "Albert Dock Conversion", assignedTrade: "Decorator", dueDate: "2026-11-01" }),
    item({ id: "s3", projectId: "p9", projectName: "Albert Dock Conversion", assignedTrade: "Decorator", dueDate: "2026-11-02" }),
  ];

  it("splits a single site by trade when the question names the site", () => {
    const result = scopedComparison("Albert Dock Conversion, who is behind?", site, TODAY);
    expect(result?.dimension).toBe("trade");
    expect(result?.groups.map((group) => group.label)).toContain("Electrical");
  });

  it("answers a trade question about one site directly", () => {
    const result = scopedComparison("electrical vs decorator", site, TODAY);
    expect(result?.dimension).toBe("trade");
    expect(result?.groups.map((group) => group.label)).toEqual(["Electrical", "Decorator"]);
  });

  it("returns nothing when the words mean nothing here, so the model can be asked", () => {
    expect(scopedComparison("which is dragging its heels", site, TODAY)).toBeNull();
  });

  it("refuses a half-answer when the other side is not on this site", () => {
    // "joiner" has no work here, so comparing the survey that happens to say "electrical"
    // against everything else would answer a question nobody asked.
    expect(scopedComparison("electrical vs joiner", site, TODAY)).toBeNull();
  });

  it("ranks the worst trades on a site, worst first", () => {
    const ranked = rankComparison("trade", site, TODAY, 3);
    expect(ranked?.groups[0]?.label).toBe("Electrical");
    expect(ranked?.groups[0]?.overdue).toBe(1);
  });
});
