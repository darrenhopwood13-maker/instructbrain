import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataError } from "@/lib/data";
import {
  REGISTER_WINDOW_WEEKS,
  checkType,
  deriveStatus,
  type ComplianceStatus,
} from "@/lib/compliance/checks";

/**
 * The compliance register data layer.
 *
 * Three rules live here and nowhere else:
 *  - a point belongs to the SITE, so it survives every run;
 *  - a new run PRE-POPULATES from the last one, so identities are stable;
 *  - an action belongs to the SITE too, so closing a run never orphans it.
 */

function from(table: string) {
  return supabase.from(table as never) as unknown as {
    select: (columns?: string, options?: Record<string, unknown>) => any;
    insert: (values: Record<string, unknown> | Record<string, unknown>[]) => any;
    update: (values: Record<string, unknown>) => any;
    delete: () => any;
  };
}

function unwrap<T>(result: { data: T | null; error: any }): T {
  if (result.error) {
    throw new DataError(
      result.error.message,
      result.error.code,
      result.error.hint,
      result.error.details,
    );
  }
  return (result.data ?? []) as T;
}

function check(result: { error: any }): void {
  if (result.error) {
    throw new DataError(
      result.error.message,
      result.error.code,
      result.error.hint,
      result.error.details,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type CompliancePoint = {
  id: string;
  projectId: string;
  checkType: string;
  location: string;
  unitRef: string;
  unitType: string | null;
  state: "active" | "decommissioned";
  decommissionedAt: string | null;
  decommissionNote: string | null;
};

export type ComplianceEntry = {
  id: string;
  runId: string;
  pointId: string;
  answers: Record<string, unknown>;
  status: ComplianceStatus;
  naReason: string | null;
  note: string | null;
  photoId: string | null;
  confirmed: boolean;
};

export type ComplianceRun = {
  id: string;
  organisationId: string;
  projectId: string;
  checkType: string;
  checkDate: string;
  siteReference: string | null;
  reportNumber: string | null;
  performedByName: string | null;
  signedAt: string | null;
  competentPerson: string | null;
  lockedAt: string | null;
  createdAt: string;
};

export type ComplianceAction = {
  id: string;
  projectId: string;
  pointId: string | null;
  raisedRunId: string | null;
  description: string;
  owner: string | null;
  openedOn: string;
  targetDate: string | null;
  status: "open" | "in_progress" | "closed";
  closedOn: string | null;
  closeoutPhotoId: string | null;
  closeoutNote: string | null;
};

const runColumns =
  "id, organisation_id, project_id, check_type, check_date, site_reference, report_number, performed_by_name, signed_at, competent_person, locked_at, created_at";
const pointColumns =
  "id, project_id, check_type, location, unit_ref, unit_type, state, decommissioned_at, decommission_note";
const entryColumns =
  "id, run_id, point_id, answers, status, na_reason, note, photo_id, confirmed";
const actionColumns =
  "id, project_id, point_id, raised_run_id, description, owner, opened_on, target_date, status, closed_on, closeout_photo_id, closeout_note";

function toRun(row: Record<string, any>): ComplianceRun {
  return {
    id: row["id"],
    organisationId: row["organisation_id"],
    projectId: row["project_id"],
    checkType: row["check_type"],
    checkDate: row["check_date"],
    siteReference: row["site_reference"] ?? null,
    reportNumber: row["report_number"] ?? null,
    performedByName: row["performed_by_name"] ?? null,
    signedAt: row["signed_at"] ?? null,
    competentPerson: row["competent_person"] ?? null,
    lockedAt: row["locked_at"] ?? null,
    createdAt: row["created_at"],
  };
}

function toPoint(row: Record<string, any>): CompliancePoint {
  return {
    id: row["id"],
    projectId: row["project_id"],
    checkType: row["check_type"],
    location: row["location"] ?? "",
    unitRef: row["unit_ref"] ?? "",
    unitType: row["unit_type"] ?? null,
    state: row["state"] === "decommissioned" ? "decommissioned" : "active",
    decommissionedAt: row["decommissioned_at"] ?? null,
    decommissionNote: row["decommission_note"] ?? null,
  };
}

function toEntry(row: Record<string, any>): ComplianceEntry {
  return {
    id: row["id"],
    runId: row["run_id"],
    pointId: row["point_id"],
    answers: (row["answers"] ?? {}) as Record<string, unknown>,
    status: (row["status"] ?? "not_applicable") as ComplianceStatus,
    naReason: row["na_reason"] ?? null,
    note: row["note"] ?? null,
    photoId: row["photo_id"] ?? null,
    confirmed: row["confirmed"] === true,
  };
}

function toAction(row: Record<string, any>): ComplianceAction {
  return {
    id: row["id"],
    projectId: row["project_id"],
    pointId: row["point_id"] ?? null,
    raisedRunId: row["raised_run_id"] ?? null,
    description: row["description"] ?? "",
    owner: row["owner"] ?? null,
    openedOn: row["opened_on"],
    targetDate: row["target_date"] ?? null,
    status: (row["status"] ?? "open") as ComplianceAction["status"],
    closedOn: row["closed_on"] ?? null,
    closeoutPhotoId: row["closeout_photo_id"] ?? null,
    closeoutNote: row["closeout_note"] ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export function complianceRunsQuery(projectId: string, type: string) {
  return queryOptions({
    queryKey: ["compliance", "runs", projectId, type],
    queryFn: async (): Promise<ComplianceRun[]> => {
      const rows = unwrap<Record<string, any>[]>(
        await from("compliance_runs")
          .select(runColumns)
          .eq("project_id", projectId)
          .eq("check_type", type)
          .order("check_date", { ascending: false })
          .limit(24),
      );
      return rows.map(toRun);
    },
  });
}

export function compliancePointsQuery(projectId: string, type: string) {
  return queryOptions({
    queryKey: ["compliance", "points", projectId, type],
    queryFn: async (): Promise<CompliancePoint[]> => {
      const rows = unwrap<Record<string, any>[]>(
        await from("compliance_points")
          .select(pointColumns)
          .eq("project_id", projectId)
          .eq("check_type", type)
          .order("location", { ascending: true })
          .order("unit_ref", { ascending: true }),
      );
      return rows.map(toPoint);
    },
  });
}

export function complianceEntriesQuery(runIds: string[]) {
  const key = [...runIds].sort().join(",");
  return queryOptions({
    queryKey: ["compliance", "entries", key],
    enabled: runIds.length > 0,
    queryFn: async (): Promise<ComplianceEntry[]> => {
      if (runIds.length === 0) return [];
      const rows = unwrap<Record<string, any>[]>(
        await from("compliance_entries").select(entryColumns).in("run_id", runIds),
      );
      return rows.map(toEntry);
    },
  });
}

export function complianceActionsQuery(projectId: string) {
  return queryOptions({
    queryKey: ["compliance", "actions", projectId],
    queryFn: async (): Promise<ComplianceAction[]> => {
      const rows = unwrap<Record<string, any>[]>(
        await from("compliance_actions")
          .select(actionColumns)
          .eq("project_id", projectId)
          .order("opened_on", { ascending: true }),
      );
      return rows.map(toAction);
    },
  });
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export async function createPoint(input: {
  organisationId: string;
  projectId: string;
  checkType: string;
  location: string;
  unitRef: string;
  unitType: string | null;
}): Promise<CompliancePoint> {
  const row = unwrap<Record<string, any>>(
    await from("compliance_points")
      .insert({
        organisation_id: input.organisationId,
        project_id: input.projectId,
        check_type: input.checkType,
        location: input.location,
        unit_ref: input.unitRef,
        unit_type: input.unitType,
      })
      .select(pointColumns)
      .single(),
  );
  return toPoint(row);
}

/** A removed or relocated unit is decommissioned, never deleted and never a fail. */
export async function decommissionPoint(pointId: string, note: string) {
  check(
    await from("compliance_points")
      .update({
        state: "decommissioned",
        decommissioned_at: new Date().toISOString(),
        decommission_note: note,
      })
      .eq("id", pointId),
  );
}

/**
 * Starts a run and pre-populates it from the previous one. Every active point
 * on the site arrives as an unconfirmed entry carrying last week's answers, so
 * "same extinguisher out of date three weeks running" is visible rather than
 * retyped into existence.
 */
export async function startRun(input: {
  organisationId: string;
  projectId: string;
  checkType: string;
  checkDate: string;
  siteReference: string | null;
  reportNumber: string | null;
  performedByName: string | null;
  competentPerson: string | null;
}): Promise<ComplianceRun> {
  const previous = unwrap<Record<string, any>[]>(
    await from("compliance_runs")
      .select("id")
      .eq("project_id", input.projectId)
      .eq("check_type", input.checkType)
      .order("check_date", { ascending: false })
      .limit(1),
  );
  const previousId = previous[0]?.["id"] as string | undefined;

  const run = toRun(
    unwrap<Record<string, any>>(
      await from("compliance_runs")
        .insert({
          organisation_id: input.organisationId,
          project_id: input.projectId,
          check_type: input.checkType,
          check_date: input.checkDate,
          site_reference: input.siteReference,
          report_number: input.reportNumber,
          performed_by_name: input.performedByName,
          competent_person: input.competentPerson,
        })
        .select(runColumns)
        .single(),
    ),
  );

  const points = unwrap<Record<string, any>[]>(
    await from("compliance_points")
      .select(pointColumns)
      .eq("project_id", input.projectId)
      .eq("check_type", input.checkType)
      .eq("state", "active"),
  ).map(toPoint);

  if (points.length === 0) return run;

  const carried = new Map<string, ComplianceEntry>();
  if (previousId) {
    for (const entry of unwrap<Record<string, any>[]>(
      await from("compliance_entries").select(entryColumns).eq("run_id", previousId),
    ).map(toEntry)) {
      carried.set(entry.pointId, entry);
    }
  }

  check(
    await from("compliance_entries").insert(
      points.map((point) => {
        const last = carried.get(point.id);
        return {
          organisation_id: input.organisationId,
          run_id: run.id,
          point_id: point.id,
          // Answers carry across as a starting position only — nothing counts
          // until a person confirms this week's entry.
          answers: last?.answers ?? {},
          status: "not_applicable",
          confirmed: false,
        };
      }),
    ),
  );

  return run;
}

export async function addPointToRun(input: {
  organisationId: string;
  runId: string;
  pointId: string;
}) {
  check(
    await from("compliance_entries").insert({
      organisation_id: input.organisationId,
      run_id: input.runId,
      point_id: input.pointId,
      answers: {},
      status: "not_applicable",
      confirmed: false,
    }),
  );
}

export async function saveEntry(
  entryId: string,
  patch: {
    answers?: Record<string, unknown>;
    status?: ComplianceStatus;
    naReason?: string | null;
    note?: string | null;
    photoId?: string | null;
    confirmed?: boolean;
  },
) {
  const update: Record<string, unknown> = {};
  if (patch.answers !== undefined) update["answers"] = patch.answers;
  if (patch.status !== undefined) update["status"] = patch.status;
  if (patch.naReason !== undefined) update["na_reason"] = patch.naReason;
  if (patch.note !== undefined) update["note"] = patch.note;
  if (patch.photoId !== undefined) update["photo_id"] = patch.photoId;
  if (patch.confirmed !== undefined) update["confirmed"] = patch.confirmed;
  check(await from("compliance_entries").update(update).eq("id", entryId));
}

export async function raiseAction(input: {
  organisationId: string;
  projectId: string;
  pointId: string | null;
  raisedRunId: string;
  raisedEntryId: string | null;
  description: string;
  owner: string | null;
  targetDate: string | null;
}) {
  check(
    await from("compliance_actions").insert({
      organisation_id: input.organisationId,
      project_id: input.projectId,
      point_id: input.pointId,
      raised_run_id: input.raisedRunId,
      raised_entry_id: input.raisedEntryId,
      description: input.description,
      owner: input.owner,
      target_date: input.targetDate,
      status: "open",
    }),
  );
}

export async function updateAction(
  actionId: string,
  patch: {
    status?: ComplianceAction["status"];
    owner?: string | null;
    targetDate?: string | null;
    closedOn?: string | null;
    closeoutNote?: string | null;
    closeoutPhotoId?: string | null;
  },
) {
  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update["status"] = patch.status;
  if (patch.owner !== undefined) update["owner"] = patch.owner;
  if (patch.targetDate !== undefined) update["target_date"] = patch.targetDate;
  if (patch.closedOn !== undefined) update["closed_on"] = patch.closedOn;
  if (patch.closeoutNote !== undefined) update["closeout_note"] = patch.closeoutNote;
  if (patch.closeoutPhotoId !== undefined) update["closeout_photo_id"] = patch.closeoutPhotoId;
  check(await from("compliance_actions").update(update).eq("id", actionId));
}

/** Locking is one-way. The database refuses every later write to the run. */
export async function lockRun(runId: string, performedByName: string | null) {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { locked_at: now, signed_at: now };
  if (performedByName) update["performed_by_name"] = performedByName;
  check(await from("compliance_runs").update(update).eq("id", runId));
}

export async function updateRunHeader(
  runId: string,
  patch: {
    checkDate?: string;
    siteReference?: string | null;
    reportNumber?: string | null;
    performedByName?: string | null;
    competentPerson?: string | null;
  },
) {
  const update: Record<string, unknown> = {};
  if (patch.checkDate !== undefined) update["check_date"] = patch.checkDate;
  if (patch.siteReference !== undefined) update["site_reference"] = patch.siteReference;
  if (patch.reportNumber !== undefined) update["report_number"] = patch.reportNumber;
  if (patch.performedByName !== undefined) update["performed_by_name"] = patch.performedByName;
  if (patch.competentPerson !== undefined) update["competent_person"] = patch.competentPerson;
  check(await from("compliance_runs").update(update).eq("id", runId));
}

/* ------------------------------------------------------------------ */
/* Derived                                                             */
/* ------------------------------------------------------------------ */

export function statusForEntry(
  type: string,
  point: CompliancePoint | undefined,
  entry: ComplianceEntry,
): ComplianceStatus {
  if (entry.status === "not_applicable" && entry.naReason) return "not_applicable";
  return deriveStatus(
    checkType(type),
    point?.unitType ?? null,
    entry.answers,
    entry.status === "not_applicable" && !!entry.naReason,
  );
}

/** The six-week window the client asks about, most recent first. */
export function windowRuns(runs: ComplianceRun[]): ComplianceRun[] {
  return runs.slice(0, REGISTER_WINDOW_WEEKS);
}

/**
 * A run cannot be completed while any point lacks its weekly photograph, or
 * while a non-compliant point has no action against it. A register without
 * evidence is not evidence.
 */
export function runBlockers(input: {
  type: string;
  points: CompliancePoint[];
  entries: ComplianceEntry[];
  actions: ComplianceAction[];
  runId: string;
}): string[] {
  const definition = checkType(input.type);
  const byId = new Map(input.points.map((point) => [point.id, point]));
  const blockers: string[] = [];

  const unconfirmed = input.entries.filter((entry) => !entry.confirmed);
  if (unconfirmed.length > 0) {
    blockers.push(`${unconfirmed.length} point(s) not yet confirmed.`);
  }

  if (definition.photoRequired) {
    const missing = input.entries.filter(
      (entry) =>
        !entry.photoId && statusForEntry(input.type, byId.get(entry.pointId), entry) !== "not_applicable",
    );
    if (missing.length > 0) {
      blockers.push(`${missing.length} point(s) have no photograph this week.`);
    }
  }

  const failing = input.entries.filter(
    (entry) => statusForEntry(input.type, byId.get(entry.pointId), entry) === "non_compliant",
  );
  const withAction = new Set(
    input.actions
      .filter((action) => action.status !== "closed" || action.raisedRunId === input.runId)
      .map((action) => action.pointId),
  );
  const unowned = failing.filter((entry) => !withAction.has(entry.pointId));
  if (unowned.length > 0) {
    blockers.push(`${unowned.length} non-compliant point(s) have no action raised.`);
  }

  return blockers;
}
