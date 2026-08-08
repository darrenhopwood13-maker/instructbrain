import type { DocFinding, FindingGroup, ReportDocument } from "@/lib/report/document";
import { NOT_ASSESSED_ID, resolveStatus, severitiesOf } from "@/lib/survey-types";

/**
 * One set of results, three ways of reading it. Every item appears exactly
 * once in whichever view is selected — there is no second list.
 */
export const RESULT_VIEWS = ["trade", "severity", "deadline"] as const;
export type ResultView = (typeof RESULT_VIEWS)[number];

export const RESULT_VIEW_LABELS: Record<ResultView, string> = {
  trade: "By trade",
  severity: "By severity",
  deadline: "By deadline",
};

export function safeResultView(value: unknown): ResultView {
  return typeof value === "string" && (RESULT_VIEWS as readonly string[]).includes(value)
    ? (value as ResultView)
    : "severity";
}

const UNASSIGNED_TRADE = "Trade not yet confirmed";
const NO_SEVERITY = "Severity not set";
const NO_DUE_DATE = "No target date";
const NOT_ASSESSED_LABEL = "Not assessed — a person must resolve these";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function dueLabel(value: string | null): string {
  if (!value) return NO_DUE_DATE;
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? NO_DUE_DATE : dateFormatter.format(date);
}

function push(map: Map<string, DocFinding[]>, key: string, finding: DocFinding): void {
  map.set(key, [...(map.get(key) ?? []), finding]);
}

export function groupResults(document: ReportDocument, view: ResultView): FindingGroup[] {
  const snapshot = document.snapshot;
  const findings = document.findings;
  if (findings.length === 0) return [];

  if (view === "trade") {
    const map = new Map<string, DocFinding[]>();
    for (const finding of findings) {
      push(map, (finding.assignedTrade ?? "").trim() || UNASSIGNED_TRADE, finding);
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (a === UNASSIGNED_TRADE) return -1;
        if (b === UNASSIGNED_TRADE) return 1;
        return a.localeCompare(b, "en-GB");
      })
      .map(([key, items]) => ({ key, label: key, findings: items }));
  }

  if (view === "severity") {
    const order = severitiesOf(snapshot).map((severity) => severity.id);
    const map = new Map<string, DocFinding[]>();
    for (const finding of findings) {
      const notAssessed = resolveStatus(snapshot, finding.statusId).id === NOT_ASSESSED_ID;
      push(map, notAssessed ? NOT_ASSESSED_ID : (finding.severityId ?? ""), finding);
    }
    const rank = (key: string): number => {
      if (key === NOT_ASSESSED_ID) return -1;
      if (key === "") return order.length + 1;
      const index = order.indexOf(key);
      return index === -1 ? order.length : index;
    };
    return [...map.entries()]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([key, items]) => ({
        key: key || "unset",
        label:
          key === NOT_ASSESSED_ID
            ? NOT_ASSESSED_LABEL
            : key === ""
              ? NO_SEVERITY
              : (severitiesOf(snapshot).find((severity) => severity.id === key)?.label ?? key),
        findings: items,
      }));
  }

  // Deadline: overdue first, then soonest, undated last.
  const today = new Date().toISOString().slice(0, 10);
  const overdue: DocFinding[] = [];
  const map = new Map<string, DocFinding[]>();
  for (const finding of findings) {
    const due = finding.dueDate;
    if (due && due.slice(0, 10) < today && finding.lifecycleState !== "closed") {
      overdue.push(finding);
      continue;
    }
    push(map, due ?? "", finding);
  }
  const dated = [...map.entries()]
    .sort(([a], [b]) => {
      if (a === "") return 1;
      if (b === "") return -1;
      return a.localeCompare(b);
    })
    .map(([key, items]) => ({
      key: key || "undated",
      label: dueLabel(key || null),
      findings: items,
    }));
  return overdue.length > 0
    ? [{ key: "overdue", label: "Overdue", findings: overdue }, ...dated]
    : dated;
}
