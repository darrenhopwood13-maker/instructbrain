import { describe, expect, it } from "vitest";
import { defaultResultView, groupResults, safeResultView } from "@/lib/report/grouping";
import type { DocFinding, ReportDocument } from "@/lib/report/document";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * A survey that assigns trades exists to be handed out by trade, so its report
 * opens grouped that way — and the unallocated snags are the work outstanding.
 */

function finding(overrides: Partial<DocFinding>): DocFinding {
  return {
    id: overrides.id ?? "f1",
    ref: overrides.ref ?? "1",
    sequence: overrides.sequence ?? 1,
    statusId: overrides.statusId ?? "fail",
    severityId: overrides.severityId ?? null,
    categoryId: null,
    findingText: overrides.findingText ?? "Cracked render to the east elevation.",
    snagTitle: overrides.snagTitle ?? null,
    remedialText: overrides.remedialText ?? "Cut out and make good.",
    rectificationAlt: overrides.rectificationAlt ?? null,
    tradesmanHack: overrides.tradesmanHack ?? null,
    hsNotes: overrides.hsNotes ?? null,
    captureFields: {},
    assignedTrade: overrides.assignedTrade ?? null,
    suggestedTrade: null,
    tradeReasoning: null,
    tradeConfidence: null,
    dueDate: null,
    lifecycleState: "open",
    isConfidential: false,
    confirmedAt: null,
    likelyCause: null,
    regulatoryReference: null,
    abstainReason: null,
    photos: [],
  };
}

const snapshot = {
  id: "site_walk",
  version: 1,
  label: "Site condition",
  statuses: [{ id: "fail", label: "Defect", tone: "fail" as const }],
  requiresTradeAssignment: true,
} as unknown as SurveyTypeSnapshot;

const withoutTrades = { ...snapshot, requiresTradeAssignment: false } as unknown as SurveyTypeSnapshot;

function doc(findings: DocFinding[], type = snapshot): ReportDocument {
  return { snapshot: type, findings } as unknown as ReportDocument;
}

describe("the view a report opens on", () => {
  it("opens by trade when the survey assigns trades", () => {
    expect(defaultResultView(snapshot)).toBe("trade");
  });

  it("opens by severity when it does not", () => {
    expect(defaultResultView(withoutTrades)).toBe("severity");
  });

  it("falls back to severity rather than guessing, when there is no definition", () => {
    expect(defaultResultView(null)).toBe("severity");
    expect(defaultResultView(undefined)).toBe("severity");
  });

  it("lets an explicit choice win over the default", () => {
    const opensOn = defaultResultView(snapshot);
    expect(safeResultView("deadline", opensOn)).toBe("deadline");
    expect(safeResultView(undefined, opensOn)).toBe("trade");
    expect(safeResultView("nonsense", opensOn)).toBe("trade");
  });
});

describe("grouping a snag report by trade", () => {
  it("puts the unallocated snags first, then the trades alphabetically", () => {
    const groups = groupResults(
      doc([
        finding({ id: "a", ref: "1", assignedTrade: "Roofing" }),
        finding({ id: "b", ref: "2" }),
        finding({ id: "c", ref: "3", assignedTrade: "Groundworks" }),
      ]),
      "trade",
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Trade not yet confirmed",
      "Groundworks",
      "Roofing",
    ]);
    expect(groups[0].findings.map((item) => item.ref)).toEqual(["2"]);
  });

  it("keeps every snag exactly once, whatever view is chosen", () => {
    const findings = [
      finding({ id: "a", ref: "1", assignedTrade: "Roofing" }),
      finding({ id: "b", ref: "2" }),
      finding({ id: "c", ref: "3", assignedTrade: "Groundworks" }),
    ];

    for (const view of ["trade", "severity", "deadline"] as const) {
      const total = groupResults(doc(findings), view).reduce(
        (count, group) => count + group.findings.length,
        0,
      );
      expect(total).toBe(findings.length);
    }
  });

  it("names an unallocated snag as unconfirmed rather than leaving it out", () => {
    const groups = groupResults(doc([finding({ id: "a", ref: "1" })]), "trade");
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Trade not yet confirmed");
  });

  it("puts a snag with a blank trade in the unallocated bucket", () => {
    const groups = groupResults(doc([finding({ id: "a", ref: "1", assignedTrade: "   " })]), "trade");
    expect(groups.map((group) => group.label)).toEqual(["Trade not yet confirmed"]);
  });

  it("returns nothing at all for a report with no snags", () => {
    expect(groupResults(doc([]), "trade")).toEqual([]);
  });
});
