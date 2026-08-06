import { describe, expect, it } from "vitest";
import {
  documentSections,
  documentStatistics,
  groupFindings,
  issueBlockers,
  type DocFinding,
  type ReportDocument,
} from "@/lib/report/document";
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
    photos: [],
    ...overrides,
  };
}

function document(findings: DocFinding[], snapshot = snaggingDefinition): ReportDocument {
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
    },
    project: null,
    organisation: null,
    snapshot,
    findings,
    photos: [],
    synthesis: null,
    author: null,
  };
}

describe("issue gate", () => {
  it("blocks while any finding is not assessed", () => {
    const blockers = issueBlockers(
      document([finding({}), finding({ id: "f2", ref: "F-002", statusId: "not_assessed" })]),
    );
    expect(blockers.blocked).toBe(true);
    expect(blockers.notAssessed.map((item) => item.ref)).toEqual(["F-002"]);
  });

  it("blocks a fail-tone finding with no confirmed trade where the type requires one", () => {
    const blockers = issueBlockers(document([finding({ assignedTrade: null })]));
    expect(blockers.tradeMissing).toHaveLength(1);
    expect(blockers.blocked).toBe(true);
  });

  it("does not require a trade where the definition does not", () => {
    const blockers = issueBlockers(
      document(
        [finding({ statusId: "damaged", severityId: "high", assignedTrade: null })],
        weatherproofingDefinition,
      ),
    );
    expect(blockers.tradeMissing).toHaveLength(0);
    expect(blockers.blocked).toBe(false);
  });

  it("blocks while a finding is unconfirmed", () => {
    const blockers = issueBlockers(document([finding({ confirmedAt: null })]));
    expect(blockers.unconfirmed).toHaveLength(1);
  });
});

describe("document assembly", () => {
  it("takes its section list from the snapshot, never from a hardcoded list", () => {
    expect(documentSections(snaggingDefinition)).toEqual(snaggingDefinition.outputSections);
    expect(documentSections(weatherproofingDefinition)).toEqual(
      weatherproofingDefinition.outputSections,
    );
    expect(documentSections({ id: "x", version: 1, label: "X", statuses: [] })).toEqual([
      "cover",
      "schedule",
      "appendix",
    ]);
  });

  it("groups by trade and by area from the same schedule", () => {
    const findings = [
      finding({ id: "a", ref: "F-001", assignedTrade: "Tiler" }),
      finding({
        id: "b",
        ref: "F-002",
        assignedTrade: "Tiler",
        captureFields: { location: "Plot 9" },
      }),
      finding({ id: "c", ref: "F-003", assignedTrade: null }),
    ];
    expect(groupFindings(findings, "trade").map((group) => group.label)).toEqual([
      "Tiler",
      "Trade not yet confirmed",
    ]);
    expect(groupFindings(findings, "area").map((group) => group.label)).toEqual([
      "Plot 4, level 2",
      "Plot 9",
    ]);
    expect(groupFindings(findings, "none")).toHaveLength(1);
  });

  it("counts not assessed items out of the assessed percentage without dropping them", () => {
    const stats = documentStatistics(
      document([finding({}), finding({ id: "f2", ref: "F-002", statusId: "not_assessed" })]),
    );
    expect(stats.total).toBe(2);
    expect(stats.assessed).toBe(1);
    expect(stats.percentAssessed).toBe(50);
    expect(stats.byStatus.find((entry) => entry.id === "not_assessed")?.count).toBe(1);
  });

  it("coerces an unknown status to not assessed rather than to a passing one", () => {
    const stats = documentStatistics(document([finding({ statusId: "invented_status" })]));
    expect(stats.byStatus[0]?.id).toBe("not_assessed");
    expect(stats.byStatus.some((entry) => entry.tone === "pass")).toBe(false);
  });
});
