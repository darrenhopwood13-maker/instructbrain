import type { Finding } from "@/lib/types";
import {
  resolveSeverity,
  type SurveyTypeSnapshot,
} from "@/lib/survey-types";
import { ConfidentialFindingError, type ExtractItem } from "@/lib/email/templates";
import { resolveLocation } from "@/lib/report/location";

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

/**
 * How a report is broken up for distribution.
 *
 * "subcontractor" is the one that answers the question a site actually asks:
 * who is going to receive this? Trade is what a survey can name, but a firm is
 * what receives an extract, and the two are not the same thing — one firm can
 * hold several trades, and one trade can be held by two firms working different
 * packages. Grouping by trade sends a firm an extract per trade and cannot tell
 * two firms apart at all.
 */
export type GroupingKey = "trade" | "area" | "severity" | "subcontractor";

const GROUPINGS: GroupingKey[] = ["trade", "area", "severity", "subcontractor"];

export function resolveGrouping(value: unknown): GroupingKey {
  return GROUPINGS.includes(value as GroupingKey) ? (value as GroupingKey) : "trade";
}

/** A finding shaped for grouping — the subset every caller can supply. */
export type GroupableFinding = {
  id: string;
  ref: string;
  sequence?: number;
  assignedTrade: string | null;
  /**
   * The directory row this finding belongs to, resolved by the caller.
   *
   * It is resolved outside this module because the answer needs the project's
   * directory, and resolution is a database question, not a grouping one. An
   * explicit assignment wins; a trade held by exactly one firm resolves to that
   * firm; anything else stays null and is handed to a person.
   */
  assignedFirmKey?: string | null;
  /** The contact a person explicitly assigned this item to, if any. */
  assignedContactId?: string | null;
  severityId: string | null;
  captureFields: Record<string, string>;
  isConfidential: boolean;
  findingText: string;
  remedialText: string;
  dueDate: string | null;
};

export const UNASSIGNED_GROUP = "__unassigned__";

/** One firm's hold on one trade, as the directory stores it. */
export type DirectoryHolder = { id: string; trade: string | null; contactIds: string[] };

/**
 * Which firm a finding belongs to.
 *
 * The order matters and each step has a reason:
 *
 *   1. An explicit assignment wins. A person put this item somewhere, and the
 *      machine does not overrule a person.
 *   2. Failing that, a trade held by exactly ONE firm resolves to it. There is
 *      nothing to decide, so making somebody decide would be noise.
 *   3. A trade held by TWO firms resolves to nobody. This is the case that used
 *      to go wrong silently: the old lookup took the first directory row whose
 *      trade matched, so a second firm on the same trade was simply never sent
 *      anything and nobody was told. A decision belongs to a person, and an
 *      item that is nobody's shows up as "Nobody allocated" where it can be
 *      seen.
 *
 * Returns the directory row id, which is what a firm is identified by.
 */
export function resolveFirmKey(
  finding: { assignedContactId?: string | null; assignedTrade: string | null },
  holdersByTrade: Map<string, DirectoryHolder[]>,
  firmByContact: Map<string, string>,
): string | null {
  const contactId = (finding.assignedContactId ?? "").trim();
  if (contactId !== "") {
    const firm = firmByContact.get(contactId);
    if (firm) return firm;
  }
  const tradeKey = (finding.assignedTrade ?? "").trim().toLowerCase();
  if (tradeKey === "") return null;
  const holders = holdersByTrade.get(tradeKey) ?? [];
  return holders.length === 1 ? (holders[0]?.id ?? null) : null;
}

/** Kept as this module's own name for the shared answer, not a second opinion. */
export function locationOf(captureFields: Record<string, string>): string {
  return resolveLocation(captureFields);
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
  if (grouping === "subcontractor") {
    const firm = (finding.assignedFirmKey ?? "").trim();
    return firm === "" ? UNASSIGNED_GROUP : firm;
  }
  const trade = (finding.assignedTrade ?? "").trim();
  return trade === "" ? UNASSIGNED_GROUP : trade;
}

export function groupLabelOf(
  key: string,
  grouping: GroupingKey,
  snapshot?: SurveyTypeSnapshot | null,
  firmLabels?: Map<string, string> | null,
): string {
  if (key === UNASSIGNED_GROUP) {
    return grouping === "trade"
      ? "No trade assigned"
      : grouping === "subcontractor"
        ? "Nobody allocated"
        : grouping === "area"
          ? "No location recorded"
          : "No severity recorded";
  }
  if (grouping === "severity") return resolveSeverity(snapshot, key)?.label ?? key;
  if (grouping === "subcontractor") return firmLabels?.get(key) ?? key;
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
  firmLabels?: Map<string, string> | null,
): ExtractGroup[] {
  const groups = new Map<string, ExtractGroup>();

  for (const finding of findings) {
    if (finding.isConfidential) continue;
    const key = groupKeyOf(finding, grouping, snapshot);
    const group = groups.get(key) ?? {
      key,
      label: groupLabelOf(key, grouping, snapshot, firmLabels),
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
