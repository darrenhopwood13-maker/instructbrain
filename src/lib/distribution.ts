import type { Finding } from "@/lib/types";
import {
  resolveSeverity,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";
import { ConfidentialFindingError, type ExtractItem } from "@/lib/email/templates";

/**
 * Invariant 7: findings involving a person are confidential and are EXCLUDED
 * from every subcontractor distribution. The database trigger blocks them and
 * `buildTradeExtractItems` filters them; the assertion here is the third line,
 * placed where the document itself is built so nothing can be RENDERED either.
 */
export function selectDistributionFindings(findings: Finding[], trade?: string): Finding[] {
  return findings.filter(
    (finding) => !finding.isConfidential && (trade === undefined || finding.trade === trade),
  );
}

/** Refs included in a trade extract, in stable creation order. */
export function distributionRefs(findings: Finding[], trade?: string): string[] {
  return selectDistributionFindings(findings, trade).map((finding) => finding.ref);
}

/* ------------------------------------------------------------------ */
/* Grouping                                                             */
/* ------------------------------------------------------------------ */

/** The definition chooses how a report is broken up for distribution. */
export type GroupingKey = "trade" | "area" | "severity";

const GROUPINGS: GroupingKey[] = ["trade", "area", "severity"];

export function resolveGrouping(value: unknown): GroupingKey {
  return GROUPINGS.includes(value as GroupingKey) ? (value as GroupingKey) : "trade";
}

/** A finding shaped for grouping — the subset every caller can supply. */
export type GroupableFinding = {
  id: string;
  ref: string;
  sequence?: number;
  assignedTrade: string | null;
  severityId: string | null;
  captureFields: Record<string, string>;
  isConfidential: boolean;
  findingText: string;
  remedialText: string;
  dueDate: string | null;
};

export const UNASSIGNED_GROUP = "__unassigned__";

export function locationOf(captureFields: Record<string, string>): string {
  return (
    captureFields["location"] ??
    captureFields["zone"] ??
    captureFields["area"] ??
    captureFields["level"] ??
    ""
  );
}

/** The group key for one finding under the definition's chosen grouping. */
export function groupKeyOf(
  finding: GroupableFinding,
  grouping: GroupingKey,
  snapshot?: SurveyTypeSnapshot | null,
): string {
  if (grouping === "area") return locationOf(finding.captureFields) || UNASSIGNED_GROUP;
  if (grouping === "severity") {
    return resolveSeverity(snapshot, finding.severityId)?.id ?? UNASSIGNED_GROUP;
  }
  const trade = (finding.assignedTrade ?? "").trim();
  return trade === "" ? UNASSIGNED_GROUP : trade;
}

export function groupLabelOf(
  key: string,
  grouping: GroupingKey,
  snapshot?: SurveyTypeSnapshot | null,
): string {
  if (key === UNASSIGNED_GROUP) {
    return grouping === "trade"
      ? "No trade assigned"
      : grouping === "area"
        ? "No location recorded"
        : "No severity recorded";
  }
  if (grouping === "severity") return resolveSeverity(snapshot, key)?.label ?? key;
  return key;
}

export type ExtractGroup = {
  key: string;
  label: string;
  findings: GroupableFinding[];
  items: ExtractItem[];
};

/**
 * Splits a report into distributable groups. Confidential findings are removed
 * BEFORE grouping, so they cannot appear in any group, including the
 * unassigned one.
 */
export function groupForDistribution(
  findings: GroupableFinding[],
  grouping: GroupingKey,
  snapshot?: SurveyTypeSnapshot | null,
): ExtractGroup[] {
  const groups = new Map<string, ExtractGroup>();

  for (const finding of findings) {
    if (finding.isConfidential) continue;
    const key = groupKeyOf(finding, grouping, snapshot);
    const group = groups.get(key) ?? {
      key,
      label: groupLabelOf(key, grouping, snapshot),
      findings: [],
      items: [],
    };
    group.findings.push(finding);
    group.items.push(toExtractItem(finding, snapshot));
    groups.set(key, group);
  }

  // Unassigned first: it is the one group a person must act on before sending.
  return [...groups.values()].sort((a, b) => {
    if (a.key === UNASSIGNED_GROUP) return -1;
    if (b.key === UNASSIGNED_GROUP) return 1;
    return a.label.localeCompare(b.label);
  });
}

export function toExtractItem(
  finding: GroupableFinding,
  snapshot?: SurveyTypeSnapshot | null,
): ExtractItem {
  return {
    ref: finding.ref,
    location: locationOf(finding.captureFields),
    action: finding.remedialText || finding.findingText || "",
    severityLabel: resolveSeverity(snapshot, finding.severityId)?.label ?? "",
    dueDate: finding.dueDate,
    isConfidential: finding.isConfidential,
  };
}

/* ------------------------------------------------------------------ */
/* The extract document                                                 */
/* ------------------------------------------------------------------ */

export type ExtractDocument = {
  groupKey: string;
  groupLabel: string;
  grouping: GroupingKey;
  projectName: string;
  projectAddress: string | null;
  reportTitle: string;
  reportReference: string | null;
  reportDate: string;
  organisationName: string | null;
  items: ExtractItem[];
  findingIds: string[];
};

export type ExtractSource = {
  projectName: string;
  projectAddress: string | null;
  reportTitle: string;
  reportReference: string | null;
  reportDate: string;
  organisationName: string | null;
};

/**
 * Builds one self-contained extract. A confidential finding reaching this
 * point is a programming error, so it THROWS rather than rendering: an extract
 * that quietly dropped it would leave nobody aware it had been attempted.
 */
export function buildExtractDocument(
  group: ExtractGroup,
  grouping: GroupingKey,
  source: ExtractSource,
): ExtractDocument {
  const leaked = group.findings.filter((finding) => finding.isConfidential);
  if (leaked.length > 0) {
    throw new ConfidentialFindingError(leaked.map((finding) => finding.ref));
  }
  const leakedItems = group.items.filter((item) => item.isConfidential);
  if (leakedItems.length > 0) {
    throw new ConfidentialFindingError(leakedItems.map((item) => item.ref));
  }

  return {
    groupKey: group.key,
    groupLabel: group.label,
    grouping,
    ...source,
    items: group.items,
    findingIds: group.findings.map((finding) => finding.id),
  };
}
