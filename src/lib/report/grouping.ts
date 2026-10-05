import type { DocFinding, FindingGroup, ReportDocument } from "@/lib/report/document";
import type { SurveyTypeSnapshot } from "@/lib/survey-types";
import {
  NOT_ASSESSED_ID,
  requiresConditionGrade,
  requiresTradeAssignment,
  resolveStatus,
  severitiesOf,
} from "@/lib/survey-types";
import {
  conditionGradeOf,
  normaliseConditionGrade,
  worstFirstRank,
} from "@/lib/review/condition-grade";

/**
 * One set of results, four ways of reading it. Every item appears exactly
 * once in whichever view is selected — there is no second list.
 */
export const RESULT_VIEWS = ["trade", "severity", "deadline", "grade"] as const;
export type ResultView = (typeof RESULT_VIEWS)[number];

export const RESULT_VIEW_LABELS: Record<ResultView, string> = {
  trade: "By trade",
  severity: "By severity",
  deadline: "By deadline",
  grade: "By grade",
};

/**
 * The views offered for a report. By grade is only offered where the survey
 * type actually grades its elements, so an ordinary report is not given a tab
 * that would sort everything into "to be confirmed".
 */
export function resultViewsFor(
  snapshot: SurveyTypeSnapshot | null | undefined,
): readonly ResultView[] {
  return requiresConditionGrade(snapshot)
    ? ["grade", "trade", "severity", "deadline"]
    : ["trade", "severity", "deadline"];
}

export function safeResultView(value: unknown, fallback: ResultView = "severity"): ResultView {
  return typeof value === "string" && (RESULT_VIEWS as readonly string[]).includes(value)
    ? (value as ResultView)
    : fallback;
}

/**
 * The view a report opens on, before anyone has chosen one.
 *
 * A survey that assigns trades exists to be handed out by trade, so its report
 * opens grouped that way — that is the reading the person holding it needs, and
 * the unallocated bucket is the work still to be done. Every other survey opens
 * on severity. An explicit choice always wins over this.
 */
export function defaultResultView(snapshot: SurveyTypeSnapshot | null | undefined): ResultView {
  // A condition survey exists to be read as a Schedule of Condition, so it
  // opens on the grade. A survey that assigns trades opens by trade, as before.
  if (requiresConditionGrade(snapshot)) return "grade";
  return requiresTradeAssignment(snapshot) ? "trade" : "severity";
}

const UNASSIGNED_TRADE = "Trade not yet confirmed";
const NO_SEVERITY = "Severity not set";
const NO_DUE_DATE = "No target date";
const NOT_ASSESSED_LABEL = "Not assessed — a person must resolve these";
const UNGRADED_LABEL = "To be confirmed — a person must grade these";

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

  if (view === "grade") {
    // Ungraded first, then the worst grade down to the best. Ungraded elements
    // are the outstanding work and are never folded into a grade.
    const map = new Map<string, DocFinding[]>();
    for (const finding of findings) {
      push(map, normaliseConditionGrade(finding.conditionGrade) ?? "", finding);
    }
    return [...map.entries()]
      .sort(([a], [b]) => worstFirstRank(b) - worstFirstRank(a))
      .map(([key, items]) => {
        const grade = conditionGradeOf(key);
        return {
          key: key === "" ? "ungraded" : key,
          label: grade ? `${grade.code} — ${grade.label}` : UNGRADED_LABEL,
          findings: items,
        };
      });
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
