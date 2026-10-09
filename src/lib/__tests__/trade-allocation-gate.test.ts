import { describe, expect, it } from "vitest";
import { issueBlockers, type DocFinding, type ReportDocument } from "@/lib/report/document";
import { defaultResultView } from "@/lib/report/grouping";
import { snaggingDefinition, weatherproofingDefinition } from "@/lib/survey-definitions";

function finding(overrides: Partial<DocFinding>): DocFinding {
  return {
    id: overrides.id ?? "f1",
    ref: overrides.ref ?? "F-001",
    sequence: 1,
    statusId: "snag",
    severityId: "workmanship",
    categoryId: null,
    findingText: "Sealant missing to window head.",
    remedialText: "Reinstate sealant.",
    snagTitle: null,
    rectificationAlt: null,
    tradesmanHack: null,
    hsNotes: null,
    captureFields: { location: "Plot 4, level 2" },
    assignedTrade: "Window installer",
    suggestedTrade: "Window installer",
    tradeReasoning: null,
    tradeConfidence: 0.8,
    dueDate: null,
    lifecycleState: "open",
    isConfidential: false,
    confirmedAt: "2026-01-01T00:00:00Z",
    likelyCause: null,
    regulatoryReference: null,
    abstainReason: null,
    conditionGrade: null,
    suggestedGrade: null,
    gradeConfidence: null,
    photos: [],
    ...overrides,
  };
}

function document(
  findings: DocFinding[],
  snapshot = snaggingDefinition,
  tradeEnabled?: boolean,
): ReportDocument {
  return {
    report: {
      id: "r1",
      title: "Test report",
      subtitle: null,
      reference: "R-001",
      reportDate: "2026-01-01",
      status: "draft",
      issuedAt: null,
      currentVersion: 0,
      scopeText: null,
      methodologyText: null,
      executiveSummary: null,
      synthesisConfirmed: false,
      coverPhotoId: null,
      outputLanguage: "en",
    },
    project: null,
    organisation: null,
    snapshot,
    findings,
    photos: [],
    synthesis: null,
    author: null,
    ...(tradeEnabled === undefined ? {} : { tradeEnabled }),
  };
}

// A failing item with no trade assigned: the one thing the trade gate waits for.
const untraded = [finding({ assignedTrade: null })];

describe("the trade gate follows the switch", () => {
  it("blocks an untraded failing item while trade allocation is on", () => {
    const blocked = issueBlockers(document(untraded, snaggingDefinition, true));
    expect(blocked.tradeMissing.map((item) => item.ref)).toEqual(["F-001"]);
    expect(blocked.blocked).toBe(true);
  });

  it("does not block on a missing trade when the account has it switched off", () => {
    const open = issueBlockers(document(untraded, snaggingDefinition, false));
    expect(open.tradeMissing).toEqual([]);
    expect(open.blocked).toBe(false);
  });

  it("reads a document with no switch recorded as on, so nothing changes for old reports", () => {
    const blocked = issueBlockers(document(untraded));
    expect(blocked.tradeMissing.map((item) => item.ref)).toEqual(["F-001"]);
    expect(blocked.blocked).toBe(true);
  });

  it("switching off never removes a gate it never had a say in", () => {
    // An unconfirmed finding still blocks whatever the trade switch says.
    const withUnconfirmed = [finding({ assignedTrade: null, confirmedAt: null })];
    const blockers = issueBlockers(document(withUnconfirmed, snaggingDefinition, false));
    expect(blockers.unconfirmed.map((item) => item.ref)).toEqual(["F-001"]);
    expect(blockers.blocked).toBe(true);
  });

  it("keeps a template that never asked for trades out of it either way", () => {
    // This template has no trades at all, so neither switch can produce a trade
    // blocker. (Whether the item is blocked for another reason is a separate test.)
    expect(
      issueBlockers(document(untraded, weatherproofingDefinition, true)).tradeMissing,
    ).toEqual([]);
    expect(
      issueBlockers(document(untraded, weatherproofingDefinition, false)).tradeMissing,
    ).toEqual([]);
  });
});

describe("the report groups by trade only while the trade layer is on", () => {
  it("opens a trade report grouped by trade", () => {
    expect(defaultResultView(snaggingDefinition, true)).toBe("trade");
  });

  it("falls back to severity when the account has it switched off", () => {
    expect(defaultResultView(snaggingDefinition, false)).toBe("severity");
  });

  it("defaults to on when the caller says nothing, keeping old behaviour", () => {
    expect(defaultResultView(snaggingDefinition)).toBe("trade");
  });
});
