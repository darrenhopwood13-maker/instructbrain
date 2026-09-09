/**
 * The register model — layer 2.
 *
 * Pure functions only: runs + points + entries + actions in, a grid out. No
 * React, no Supabase, so both the screen and the downloadable pack read the
 * same shape and can never disagree.
 */
import {
  REGISTER_WINDOW_WEEKS,
  checkType,
  deriveStatus,
  type ComplianceStatus,
} from "@/lib/compliance/checks";
import type {
  ComplianceAction,
  ComplianceEntry,
  CompliancePoint,
  ComplianceRun,
} from "@/lib/compliance/compliance-data";

export type CellState = ComplianceStatus | "not_checked";

export type RegisterCell = {
  runId: string;
  state: CellState;
  label: string;
  /** True where the point needed a photograph this week and has none. */
  photoMissing: boolean;
  note: string | null;
  entryId: string | null;
};

export type RegisterRow = {
  point: CompliancePoint;
  cells: RegisterCell[];
};

export type WeekSummary = {
  run: ComplianceRun;
  checked: number;
  compliant: number;
  nonCompliant: number;
  notApplicable: number;
  photosMissing: number;
  locked: boolean;
  signed: boolean;
};

export type ActionSummary = {
  open: number;
  overdue: number;
  oldestOpenedOn: string | null;
};

export type RegisterModel = {
  checkTypeId: string;
  weeks: WeekSummary[];
  rows: RegisterRow[];
  actions: ActionSummary;
};

export const CELL_LABELS: Record<CellState, string> = {
  compliant: "Compliant",
  non_compliant: "Non-compliant",
  not_applicable: "Not applicable",
  not_checked: "Not checked",
};

function statusOf(
  typeId: string,
  point: CompliancePoint | undefined,
  entry: ComplianceEntry,
): ComplianceStatus {
  return deriveStatus(
    checkType(typeId),
    point?.unitType ?? null,
    entry.answers,
    entry.status === "not_applicable" && !!entry.naReason,
  );
}

/** True where this definition wanted a photograph for this outcome and none exists. */
export function photoMissing(
  typeId: string,
  status: ComplianceStatus,
  entry: ComplianceEntry,
): boolean {
  const definition = checkType(typeId);
  if (!definition.photoRequired) return false;
  if (entry.photoId) return false;
  if (status === "not_applicable") return false;
  if (definition.photoRequired === "on_fail") return status === "non_compliant";
  return true;
}

/** The six-week window, oldest week first so it reads left to right. */
export function registerWeeks(runs: ComplianceRun[]): ComplianceRun[] {
  return [...runs]
    .sort((a, b) => a.checkDate.localeCompare(b.checkDate))
    .slice(-REGISTER_WINDOW_WEEKS);
}

export function buildRegister(input: {
  checkTypeId: string;
  runs: ComplianceRun[];
  points: CompliancePoint[];
  entries: ComplianceEntry[];
  actions: ComplianceAction[];
  today?: Date;
}): RegisterModel {
  const weeksRuns = registerWeeks(input.runs);
  const runIds = new Set(weeksRuns.map((run) => run.id));
  const pointById = new Map(input.points.map((point) => [point.id, point]));

  const entriesInWindow = input.entries.filter((entry) => runIds.has(entry.runId));

  const byRunAndPoint = new Map<string, ComplianceEntry>();
  for (const entry of entriesInWindow) byRunAndPoint.set(`${entry.runId}:${entry.pointId}`, entry);

  // Only points that appear somewhere in the window, plus every active point,
  // so a decommissioned unit keeps its history instead of vanishing.
  const seen = new Set(entriesInWindow.map((entry) => entry.pointId));
  const rowPoints = input.points
    .filter((point) => point.state === "active" || seen.has(point.id))
    .sort(
      (a, b) => a.location.localeCompare(b.location) || a.unitRef.localeCompare(b.unitRef),
    );

  const rows: RegisterRow[] = rowPoints.map((point) => ({
    point,
    cells: weeksRuns.map((run) => {
      const entry = byRunAndPoint.get(`${run.id}:${point.id}`);
      if (!entry) {
        return {
          runId: run.id,
          state: "not_checked" as CellState,
          label: CELL_LABELS.not_checked,
          photoMissing: false,
          note: null,
          entryId: null,
        };
      }
      const status = statusOf(input.checkTypeId, point, entry);
      return {
        runId: run.id,
        state: status,
        label: CELL_LABELS[status],
        photoMissing: photoMissing(input.checkTypeId, status, entry),
        note: entry.note,
        entryId: entry.id,
      };
    }),
  }));

  const weeks: WeekSummary[] = weeksRuns.map((run) => {
    const runEntries = entriesInWindow.filter((entry) => entry.runId === run.id);
    let compliant = 0;
    let nonCompliant = 0;
    let notApplicable = 0;
    let photosMissing = 0;
    for (const entry of runEntries) {
      const status = statusOf(input.checkTypeId, pointById.get(entry.pointId), entry);
      if (status === "compliant") compliant += 1;
      else if (status === "non_compliant") nonCompliant += 1;
      else notApplicable += 1;
      if (photoMissing(input.checkTypeId, status, entry)) photosMissing += 1;
    }
    return {
      run,
      checked: runEntries.length,
      compliant,
      nonCompliant,
      notApplicable,
      photosMissing,
      locked: !!run.lockedAt,
      signed: !!run.signedAt,
    };
  });

  return {
    checkTypeId: input.checkTypeId,
    weeks,
    rows,
    actions: summariseActions(input.actions, input.today ?? new Date()),
  };
}

/** Overdue is a date comparison, always shown with the word "Overdue". */
export function isActionOverdue(action: ComplianceAction, today = new Date()): boolean {
  if (action.status === "closed") return false;
  if (!action.targetDate) return false;
  return action.targetDate < today.toISOString().slice(0, 10);
}

export function summariseActions(
  actions: ComplianceAction[],
  today = new Date(),
): ActionSummary {
  const open = actions.filter((action) => action.status !== "closed");
  const opened = [...open].sort((a, b) => a.openedOn.localeCompare(b.openedOn));
  return {
    open: open.length,
    overdue: open.filter((action) => isActionOverdue(action, today)).length,
    oldestOpenedOn: opened[0]?.openedOn ?? null,
  };
}
