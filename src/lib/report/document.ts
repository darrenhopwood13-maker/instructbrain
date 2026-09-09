import {
  NOT_ASSESSED_ID,
  outputSectionsOf,
  requiresTradeAssignment,
  resolveStatus,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";

/**
 * The assembled document model.
 *
 * One shape, built once, rendered by the on-screen report, the print route,
 * the read-only share link and the frozen version snapshot. There is no second
 * assembly path, so an issued PDF and a shared link can never disagree.
 *
 * Nothing in here is discipline-specific: every label comes from the report's
 * survey type snapshot.
 */

export type DocRegion = { x: number; y: number; w: number; h: number };

export type DocPhoto = {
  id: string;
  sequence: number;
  filename: string | null;
  capturedAt: string | null;
  url: string | null;
  thumbUrl: string | null;
  captureFields: Record<string, string>;
};

export type DocFindingPhoto = {
  photo: DocPhoto;
  role: string;
  region: DocRegion | null;
};

export type DocFinding = {
  id: string;
  ref: string;
  sequence: number;
  statusId: string;
  severityId: string | null;
  categoryId: string | null;
  findingText: string;
  remedialText: string;
  captureFields: Record<string, string>;
  assignedTrade: string | null;
  suggestedTrade: string | null;
  tradeReasoning: string | null;
  tradeConfidence: number | null;
  dueDate: string | null;
  lifecycleState: string;
  isConfidential: boolean;
  confirmedAt: string | null;
  likelyCause: string | null;
  regulatoryReference: string | null;
  abstainReason: string | null;
  photos: DocFindingPhoto[];
};

export type DocSynthesis = {
  executiveSummary: string;
  actions: Array<{ ref: string | null; action: string; priority: string }>;
  patterns: Array<{ title: string; detail: string; refs: string[] }>;
  generatedAt: string | null;
};

export type ReportDocument = {
  report: {
    id: string;
    title: string;
    subtitle: string | null;
    reference: string | null;
    reportDate: string;
    status: "draft" | "in_review" | "issued";
    issuedAt: string | null;
    currentVersion: number;
    scopeText: string | null;
    methodologyText: string | null;
    executiveSummary: string | null;
    synthesisConfirmed: boolean;
    coverPhotoId: string | null;
    /** The language this report is ISSUED in. English is the record copy. */
    outputLanguage: string;

  };
  project: {
    id: string;
    name: string;
    reference: string | null;
    clientName: string | null;
    address: string | null;
    principalContractor: string | null;
  } | null;
  organisation: {
    id: string;
    name: string;
    brandColour: string | null;
    logoUrl: string | null;
    address: string | null;
  } | null;
  snapshot: SurveyTypeSnapshot;
  /**
   * Every survey type this report covers, in document order. Absent or single
   * for an ordinary report; a custom report may cover several, and the
   * document is then sectioned by them.
   */
  surveyTypes?: Array<{ id: string; label: string }>;
  findings: DocFinding[];
  photos: DocPhoto[];
  synthesis: DocSynthesis | null;
  author: string | null;
};

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

export const SECTION_LABELS: Record<string, string> = {
  cover: "Cover",
  scope: "Scope and limitations",
  methodology: "Methodology",
  summary: "Report summary",
  schedule: "Schedule of findings",
  schedule_by_trade: "Schedule of findings by trade",
  schedule_by_area: "Schedule of findings by area",
  appendix: "Appendix — photographs",
};

export function sectionLabel(section: string): string {
  return SECTION_LABELS[section] ?? section.replace(/_/g, " ");
}

/** Sections come from the snapshot. The list is never hardcoded. */
export function documentSections(snapshot: SurveyTypeSnapshot): string[] {
  const sections = outputSectionsOf(snapshot);
  return sections.length > 0 ? sections : ["cover", "schedule", "appendix"];
}

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

export type FindingGroup = { key: string; label: string; findings: DocFinding[] };

const UNASSIGNED_TRADE = "Trade not yet confirmed";
const UNRECORDED_AREA = "Location not recorded";

function areaOf(finding: DocFinding): string {
  const fields = finding.captureFields ?? {};
  const first = Object.values(fields)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find((value) => value !== "");
  return first ?? UNRECORDED_AREA;
}

export function groupFindings(
  findings: DocFinding[],
  mode: "none" | "trade" | "area",
): FindingGroup[] {
  if (mode === "none") {
    return [{ key: "all", label: "All findings", findings }];
  }
  const groups = new Map<string, DocFinding[]>();
  for (const finding of findings) {
    const key =
      mode === "trade" ? (finding.assignedTrade ?? UNASSIGNED_TRADE) : areaOf(finding);
    groups.set(key, [...(groups.get(key) ?? []), finding]);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "en-GB"))
    .map(([key, items]) => ({ key, label: key, findings: items }));
}

export function groupingForSection(section: string): "none" | "trade" | "area" {
  if (section === "schedule_by_trade") return "trade";
  if (section === "schedule_by_area") return "area";
  return "none";
}

/* ------------------------------------------------------------------ */
/* Issue gate                                                          */
/* ------------------------------------------------------------------ */

export type IssueBlockers = {
  notAssessed: DocFinding[];
  tradeMissing: DocFinding[];
  unconfirmed: DocFinding[];
  blocked: boolean;
};

/**
 * Invariant 1 and 6 in one place: nothing is issued while an item is
 * `not_assessed`, and nothing is issued while a trade attribution is still an
 * AI suggestion rather than a human decision.
 */
export function issueBlockers(document: ReportDocument): IssueBlockers {
  const snapshot = document.snapshot;
  const notAssessed = document.findings.filter(
    (finding) => resolveStatus(snapshot, finding.statusId).id === NOT_ASSESSED_ID,
  );
  const needsTrade = requiresTradeAssignment(snapshot);
  const tradeMissing = needsTrade
    ? document.findings.filter(
        (finding) =>
          resolveStatus(snapshot, finding.statusId).tone === "fail" &&
          !(finding.assignedTrade ?? "").trim(),
      )
    : [];
  const unconfirmed = document.findings.filter((finding) => !finding.confirmedAt);
  return {
    notAssessed,
    tradeMissing,
    unconfirmed,
    blocked: notAssessed.length > 0 || tradeMissing.length > 0 || unconfirmed.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/* Statistics                                                          */
/* ------------------------------------------------------------------ */

export type DocumentStatistics = {
  total: number;
  assessed: number;
  percentAssessed: number;
  byStatus: Array<{ id: string; label: string; tone: string; count: number }>;
  bySeverity: Array<{ id: string; label: string; count: number }>;
  byTrade: Array<{ trade: string; count: number }>;
};

export function documentStatistics(document: ReportDocument): DocumentStatistics {
  const snapshot = document.snapshot;
  const findings = document.findings;
  const statusCounts = new Map<string, number>();
  const severityCounts = new Map<string, number>();
  const tradeCounts = new Map<string, number>();

  for (const finding of findings) {
    const status = resolveStatus(snapshot, finding.statusId);
    statusCounts.set(status.id, (statusCounts.get(status.id) ?? 0) + 1);
    if (finding.severityId) {
      severityCounts.set(finding.severityId, (severityCounts.get(finding.severityId) ?? 0) + 1);
    }
    const trade = finding.assignedTrade ?? UNASSIGNED_TRADE;
    tradeCounts.set(trade, (tradeCounts.get(trade) ?? 0) + 1);
  }

  const notAssessed = statusCounts.get(NOT_ASSESSED_ID) ?? 0;
  const assessed = findings.length - notAssessed;

  return {
    total: findings.length,
    assessed,
    percentAssessed: findings.length === 0 ? 0 : Math.round((assessed / findings.length) * 100),
    byStatus: [...statusCounts.entries()].map(([id, count]) => {
      const status = resolveStatus(snapshot, id);
      return { id: status.id, label: status.label, tone: status.tone, count };
    }),
    bySeverity: [...severityCounts.entries()].map(([id, count]) => {
      const severity = (snapshot.severityScale ?? []).find((item) => item.id === id);
      return { id, label: severity?.label ?? id, count };
    }),
    byTrade: [...tradeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([trade, count]) => ({ trade, count })),
  };
}

export const documentDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDocumentDate(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : documentDateFormatter.format(date);
}
