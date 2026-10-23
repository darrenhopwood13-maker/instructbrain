import { describe, expect, it } from "vitest";

import type { DashboardItem } from "@/lib/analytics/item-map";
import { compareSuggestions, parseComparison } from "@/lib/map/compare";

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
