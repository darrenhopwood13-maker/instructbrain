import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { humanisePlanError } from "@/lib/plans";
import type { SurveyDefinition } from "@/lib/survey-types";
import type { ReportBrief } from "@/lib/report/brief";
import {
  coerceReportStatus,
  type DirectoryEntry,
  type Finding,
  type OverdueItem,
  type Project,
  type RecentReport,
  type Report,
} from "@/lib/types";

/**
 * Every read in this module goes through the browser Supabase client, so RLS
 * scopes it to the signed-in user's organisation membership. A query that
 * returns nothing for a new account is correct behaviour, never a bug.
 *
 * Postgres errors are surfaced verbatim — an RLS rejection has to be readable
 * by the person it happened to.
 */
export class DataError extends Error {
  readonly code: string | undefined;
  readonly hint: string | undefined;
  constructor(message: string, code?: string | null, hint?: string | null, details?: string | null) {
    super([message, details].filter(Boolean).join(" — "));
    this.name = "DataError";
    this.code = code ?? undefined;
    this.hint = hint ?? undefined;
  }
}

type Result<T> = {
  data: T | null;
  error: { message: string; code?: string | null; hint?: string | null; details?: string | null } | null;
};

function unwrap<T>(result: Result<T>): T {
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

/** Untyped escape hatch: the generated types lag behind applied migrations. */
function from(table: string) {
  return supabase.from(table as never) as unknown as {
    select: (columns?: string, options?: Record<string, unknown>) => any;
    insert: (values: Record<string, unknown>) => any;
    update: (values: Record<string, unknown>) => any;
  };
}

/* ------------------------------------------------------------------ */
/* Snapshot coercion                                                    */
/* ------------------------------------------------------------------ */

import { coerceSnapshot } from "@/lib/report/snapshot";
export { coerceSnapshot };



/* ------------------------------------------------------------------ */
/* Memberships and organisation                                         */
/* ------------------------------------------------------------------ */

export type MembershipRow = {
  organisation_id: string;
  role: "owner" | "admin" | "surveyor" | "viewer" | "supervisor";
};

export const membershipsQuery = (userId: string | null) =>
  queryOptions({
    queryKey: ["memberships", userId],
    enabled: !!userId,
    queryFn: async (): Promise<MembershipRow[]> =>
      unwrap(
        await from("memberships").select("organisation_id, role").eq("user_id", userId),
      ) as MembershipRow[],
  });

export type OrganisationRow = {
  id: string;
  name: string;
  logo_path: string | null;
  brand_colour: string | null;
  address: string | null;
};

export const organisationQuery = (organisationId: string | null) =>
  queryOptions({
    queryKey: ["organisation", organisationId],
    enabled: !!organisationId,
    queryFn: async (): Promise<OrganisationRow | null> => {
      const rows = unwrap(
        await from("organisations")
          .select("id, name, logo_path, brand_colour, address")
          .eq("id", organisationId)
          .limit(1),
      ) as OrganisationRow[];
      return rows[0] ?? null;
    },
  });

export async function updateOrganisation(
  organisationId: string,
  values: { name: string; brand_colour: string | null; address: string | null },
): Promise<void> {
  const { error } = await from("organisations").update(values).eq("id", organisationId);
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);
}

/* ------------------------------------------------------------------ */
/* Projects                                                             */
/* ------------------------------------------------------------------ */

type ProjectRow = {
  id: string;
  organisation_id: string;
  name: string;
  reference: string | null;
  client_name: string | null;
  address: string | null;
  principal_contractor: string | null;
};

function toProject(row: ProjectRow, openReports: number, overdueItems: number): Project {
  return {
    id: row.id,
    name: row.name,
    reference: row.reference ?? "No reference",
    client: row.client_name ?? "Client not recorded",
    address: row.address ?? "Address not recorded",
    openReports,
    overdueItems,
  };
}

const today = () => new Date().toISOString().slice(0, 10);

export const projectsQuery = (organisationIds: string[]) =>
  queryOptions({
    queryKey: ["projects", [...organisationIds].sort()],
    enabled: organisationIds.length > 0,
    queryFn: async (): Promise<Project[]> => {
      const rows = unwrap(
        await from("projects")
          .select("id, organisation_id, name, reference, client_name, address, principal_contractor")
          .in("organisation_id", organisationIds)
          .order("created_at", { ascending: false }),
      ) as ProjectRow[];
      if (rows.length === 0) return [];

      const projectIds = rows.map((row) => row.id);
      const reports = unwrap(
        await from("reports")
          .select("id, project_id, status")
          .in("project_id", projectIds),
      ) as Array<{ id: string; project_id: string; status: string }>;

      const reportProject = new Map(reports.map((report) => [report.id, report.project_id]));
      const openByProject = new Map<string, number>();
      for (const report of reports) {
        if (coerceReportStatus(report.status) === "issued") continue;
        openByProject.set(report.project_id, (openByProject.get(report.project_id) ?? 0) + 1);
      }

      const overdueByProject = new Map<string, number>();
      if (reports.length > 0) {
        const overdue = unwrap(
          await from("findings")
            .select("id, report_id")
            .in(
              "report_id",
              reports.map((report) => report.id),
            )
            .eq("lifecycle_state", "open")
            .lt("due_date", today()),
        ) as Array<{ id: string; report_id: string }>;
        for (const finding of overdue) {
          const projectId = reportProject.get(finding.report_id);
          if (!projectId) continue;
          overdueByProject.set(projectId, (overdueByProject.get(projectId) ?? 0) + 1);
        }
      }

      return rows.map((row) =>
        toProject(row, openByProject.get(row.id) ?? 0, overdueByProject.get(row.id) ?? 0),
      );
    },
  });

export const projectQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["project", projectId],
    queryFn: async (): Promise<Project | null> => {
      const rows = unwrap(
        await from("projects")
          .select("id, organisation_id, name, reference, client_name, address, principal_contractor")
          .eq("id", projectId)
          .limit(1),
      ) as ProjectRow[];
      const row = rows[0];
      return row ? toProject(row, 0, 0) : null;
    },
  });

export type NewProject = {
  organisationId: string;
  name: string;
  reference: string;
  clientName: string;
  address: string;
  principalContractor: string;
};

export async function createProject(input: NewProject): Promise<string> {
  const { data, error } = await from("projects")
    .insert({
      organisation_id: input.organisationId,
      name: input.name.trim(),
      reference: input.reference.trim() || null,
      client_name: input.clientName.trim() || null,
      address: input.address.trim() || null,
      principal_contractor: input.principalContractor.trim() || null,
    })
    .select("id")
    .single();
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);
  return (data as { id: string }).id;
}

/* ------------------------------------------------------------------ */
/* Reports                                                              */
/* ------------------------------------------------------------------ */

type ReportRow = {
  id: string;
  project_id: string;
  organisation_id: string;
  title: string;
  reference: string | null;
  status: string;
  survey_type_snapshot: unknown;
  updated_at: string;
  report_date: string;
  author_id: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function toReport(row: ReportRow, photoCount: number, findingCount: number): Report {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    surveyTypeSnapshot: coerceSnapshot(row.survey_type_snapshot),
    status: coerceReportStatus(row.status),
    reference: row.reference ?? "No reference",
    photoCount,
    findingCount,
    updated: dateFormatter.format(new Date(row.updated_at)),
    author: row.author_id ? "Recorded author" : "Author not recorded",
  };
}

const reportColumns =
  "id, project_id, organisation_id, title, reference, status, survey_type_snapshot, updated_at, report_date, author_id";

async function countsFor(reportIds: string[]) {
  if (reportIds.length === 0) {
    return { photos: new Map<string, number>(), findings: new Map<string, number>() };
  }
  const [photoRows, findingRows] = await Promise.all([
    from("photos").select("id, report_id").in("report_id", reportIds),
    from("findings").select("id, report_id").in("report_id", reportIds),
  ]);
  const photos = new Map<string, number>();
  for (const row of (unwrap(photoRows) as Array<{ report_id: string }>) ?? []) {
    photos.set(row.report_id, (photos.get(row.report_id) ?? 0) + 1);
  }
  const findings = new Map<string, number>();
  for (const row of (unwrap(findingRows) as Array<{ report_id: string }>) ?? []) {
    findings.set(row.report_id, (findings.get(row.report_id) ?? 0) + 1);
  }
  return { photos, findings };
}

export const projectReportsQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["reports", "project", projectId],
    queryFn: async (): Promise<Report[]> => {
      const rows = unwrap(
        await from("reports")
          .select(reportColumns)
          .eq("project_id", projectId)
          .order("updated_at", { ascending: false }),
      ) as ReportRow[];
      const counts = await countsFor(rows.map((row) => row.id));
      return rows.map((row) =>
        toReport(row, counts.photos.get(row.id) ?? 0, counts.findings.get(row.id) ?? 0),
      );
    },
  });

export const reportQuery = (reportId: string) =>
  queryOptions({
    queryKey: ["report", reportId],
    queryFn: async (): Promise<{ report: Report; project: Project | null } | null> => {
      const rows = unwrap(
        await from("reports").select(reportColumns).eq("id", reportId).limit(1),
      ) as ReportRow[];
      const row = rows[0];
      if (!row) return null;
      const counts = await countsFor([row.id]);
      // A quick report has no project behind it: skip the lookup entirely.
      const projects = row.project_id
        ? ((unwrap(
            await from("projects")
              .select(
                "id, organisation_id, name, reference, client_name, address, principal_contractor",
              )
              .eq("id", row.project_id)
              .limit(1),
          ) as ProjectRow[]) ?? [])
        : [];

      return {
        report: toReport(row, counts.photos.get(row.id) ?? 0, counts.findings.get(row.id) ?? 0),
        project: projects[0] ? toProject(projects[0], 0, 0) : null,
      };
    },
  });

export type NewReport = {
  organisationId: string;
  /** Null for a quick report: it stands alone, with no project behind it. */
  projectId: string | null;
  title: string;
  reference: string;
  /** Optional header details, entered by hand where the survey type asks for them. */
  subtitle?: string;
  reportDate?: string;
  definition: SurveyDefinition;
  surveyTypeId?: string | null;
  authorId: string | null;
  isQuick?: boolean;
  /** Custom Reports only: preset, tone and special request. */
  brief?: ReportBrief | null;
  /** Every survey type this report covers, in document order. */
  surveyTypeIds?: string[];
};

/**
 * The chosen definition is COPIED into `survey_type_snapshot` at creation.
 * A later edit to the definition never alters an issued document.
 */
export async function createReport(input: NewReport): Promise<string> {
  const { data, error } = await from("reports")
    .insert({
      organisation_id: input.organisationId,
      project_id: input.projectId,
      title: input.title.trim(),
      reference: input.reference.trim() || null,
      subtitle: input.subtitle?.trim() || null,
      status: "draft",
      report_date: input.reportDate?.trim() || today(),
      author_id: input.authorId,
      is_quick: input.isQuick ?? false,
      survey_type_snapshot: JSON.parse(JSON.stringify(input.definition)),
      ...(input.surveyTypeId ? { survey_type_id: input.surveyTypeId } : {}),
    })


    .select("id")
    .single();
  // A plan limit raised in the database must read like a sentence, not SQL.
  if (error)
    throw new DataError(humanisePlanError(error.message), error.code, error.hint, error.details);
  return (data as { id: string }).id;
}

/**
 * A quick report stands alone until someone chooses to attach it to a
 * project. Once attached, the existing project-scoped distribution and
 * directory machinery picks it up automatically — nothing else changes.
 */
export async function attachReportToProject(reportId: string, projectId: string): Promise<void> {
  const { error } = await from("reports").update({ project_id: projectId }).eq("id", reportId);
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);
}

/* ------------------------------------------------------------------ */
/* Findings                                                             */
/* ------------------------------------------------------------------ */

type FindingRow = {
  id: string;
  ref: string;
  status: string | null;
  severity: string | null;
  hazard_category: string | null;
  finding_text: string | null;
  remedial_text: string | null;
  capture_fields: Record<string, string> | null;
  human_edited: boolean;
  assigned_trade: string | null;
  ai_suggested_trade: string | null;
  confirmed_at: string | null;
  is_confidential: boolean;
  likely_cause: string | null;
  regulatory_reference: string | null;
  sequence: number;
  ai_trade_confidence: number | null;
  ai_trade_reasoning: string | null;
  due_date: string | null;
  due_date_overridden: boolean | null;
  lifecycle_state: string | null;
};

const findingColumns =
  "id, ref, status, severity, hazard_category, finding_text, remedial_text, capture_fields, human_edited, assigned_trade, ai_suggested_trade, ai_trade_confidence, ai_trade_reasoning, confirmed_at, is_confidential, likely_cause, regulatory_reference, sequence, due_date, due_date_overridden, lifecycle_state";

function locationOf(captureFields: Record<string, string> | null): string {
  if (!captureFields) return "Location not recorded";
  const parts = Object.values(captureFields)
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Location not recorded";
}

function toFinding(row: FindingRow, photoIds: string[]): Finding {
  return {
    id: row.id,
    ref: row.ref,
    title: row.finding_text?.split("\n")[0]?.trim() || "Finding awaiting description",
    location: locationOf(row.capture_fields),
    // Trade attribution is a suggestion until a human confirms it.
    trade: row.assigned_trade ?? row.ai_suggested_trade ?? "Trade not assigned",
    status: row.status ?? "",
    ...(row.severity ? { severity: row.severity } : {}),
    ...(row.hazard_category ? { category: row.hazard_category } : {}),
    aiDrafted: !row.human_edited,
    confirmed: !!row.confirmed_at,
    isConfidential: row.is_confidential,
    photoIds,
    note: row.remedial_text ?? row.finding_text ?? "",
    description: row.finding_text ?? "",
    remedial: row.remedial_text ?? "",

    // The suggestion and the human decision are stored, and read, separately.
    assignedTrade: row.assigned_trade,
    aiSuggestedTrade: row.ai_suggested_trade,
    aiTradeConfidence: row.ai_trade_confidence,
    aiTradeReasoning: row.ai_trade_reasoning,
    dueDate: row.due_date,
    dueDateOverridden: row.due_date_overridden === true,
    lifecycleState: row.lifecycle_state ?? "open",

    likelyCause: row.likely_cause,
    likelyCauseConfirmed: row.human_edited,
    regulatoryReference: row.regulatory_reference,
    regulatoryReferenceConfirmed: row.human_edited,
  };
}

export const findingsQuery = (reportId: string) =>
  queryOptions({
    queryKey: ["findings", reportId],
    queryFn: async (): Promise<Finding[]> => {
      const rows = unwrap(
        await from("findings")
          .select(findingColumns)
          .eq("report_id", reportId)
          .order("sequence", { ascending: true }),
      ) as FindingRow[];
      if (rows.length === 0) return [];
      const links = unwrap(
        await from("finding_photos")
          .select("finding_id, photo_id")
          .in(
            "finding_id",
            rows.map((row) => row.id),
          ),
      ) as Array<{ finding_id: string; photo_id: string }>;
      const byFinding = new Map<string, string[]>();
      for (const link of links) {
        byFinding.set(link.finding_id, [...(byFinding.get(link.finding_id) ?? []), link.photo_id]);
      }
      return rows.map((row) => toFinding(row, byFinding.get(row.id) ?? []));
    },
  });

function daysPastDue(dueDate: string): number {
  return Math.floor((Date.now() - new Date(`${dueDate}T00:00:00Z`).getTime()) / 86_400_000);
}

function overdueLabel(dueDate: string): string {
  const days = daysPastDue(dueDate);
  if (days <= 0) return "Due today";
  return `Overdue by ${days} day${days === 1 ? "" : "s"}`;
}

type OverdueFindingRow = {
  id: string;
  ref: string;
  finding_text: string | null;
  assigned_trade: string | null;
  ai_suggested_trade: string | null;
  severity: string | null;
  due_date: string;
  report_id: string;
};

function toOverdueItem(row: OverdueFindingRow): OverdueItem {
  return {
    id: row.id,
    ref: row.ref,
    title: row.finding_text?.split("\n")[0]?.trim() || "Finding awaiting description",
    trade: row.assigned_trade ?? row.ai_suggested_trade ?? "Trade not assigned",
    due: overdueLabel(row.due_date),
    reportId: row.report_id,
    severityId: row.severity,
    dueDate: row.due_date,
    daysOverdue: daysPastDue(row.due_date),
  };
}

const overdueFindingColumns =
  "id, ref, finding_text, assigned_trade, ai_suggested_trade, severity, due_date, report_id";

/**
 * Real overdue items: still open, with a target date already passed. Sorted by
 * how far past due, worst first — the thing a site manager needs to see is the
 * item that has been sitting longest.
 */
export const overdueItemsQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["overdue", projectId],
    queryFn: async (): Promise<OverdueItem[]> => {
      const rows = unwrap(
        await from("findings")
          .select(`${overdueFindingColumns}, reports!inner(project_id)`)
          .eq("reports.project_id", projectId)
          .in("lifecycle_state", ["open", "assigned", "in_progress", "fixed", "rejected"])
          .lt("due_date", today())
          .order("due_date", { ascending: true }),
      ) as OverdueFindingRow[];
      return rows.map(toOverdueItem);
    },
  });

/** Same as overdueItemsQuery, but across every project AND every quick report
 * in the organisation — the dashboard has no single project to scope to. */
export const orgOverdueItemsQuery = (organisationIds: string[]) =>
  queryOptions({
    queryKey: ["overdue", "org", [...organisationIds].sort()],
    enabled: organisationIds.length > 0,
    queryFn: async (): Promise<OverdueItem[]> => {
      const rows = unwrap(
        await from("findings")
          .select(`${overdueFindingColumns}, reports!inner(organisation_id)`)
          .in("reports.organisation_id", organisationIds)
          .in("lifecycle_state", ["open", "assigned", "in_progress", "fixed", "rejected"])
          .lt("due_date", today())
          .order("due_date", { ascending: true })
          .limit(10),
      ) as OverdueFindingRow[];
      return rows.map(toOverdueItem);
    },
  });

/** The most recently touched reports across the organisation, project-based
 * and quick alike — the dashboard's "recent reports" list. */
export const recentReportsQuery = (organisationIds: string[]) =>
  queryOptions({
    queryKey: ["reports", "recent", [...organisationIds].sort()],
    enabled: organisationIds.length > 0,
    queryFn: async (): Promise<RecentReport[]> => {
      const rows = unwrap(
        await from("reports")
          .select("id, title, reference, status, updated_at, project_id, is_quick")
          .in("organisation_id", organisationIds)
          .order("updated_at", { ascending: false })
          .limit(8),
      ) as Array<{
        id: string;
        title: string;
        reference: string | null;
        status: string;
        updated_at: string;
        project_id: string | null;
        is_quick: boolean | null;
      }>;
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        reference: row.reference ?? "No reference",
        status: coerceReportStatus(row.status),
        updated: dateFormatter.format(new Date(row.updated_at)),
        projectId: row.project_id,
        isQuick: row.is_quick === true,
      }));
    },
  });

/** Every report the signed-in account can see, newest first — the "All
 * reports" page. Quick reports with no project belong here too. */
export const allReportsQuery = (organisationIds: string[]) =>
  queryOptions({
    queryKey: ["reports", "all", [...organisationIds].sort()],
    enabled: organisationIds.length > 0,
    queryFn: async (): Promise<RecentReport[]> => {
      const rows = unwrap(
        await from("reports")
          .select("id, title, reference, status, updated_at, project_id, is_quick")
          .in("organisation_id", organisationIds)
          .order("updated_at", { ascending: false }),
      ) as Array<{
        id: string;
        title: string;
        reference: string | null;
        status: string;
        updated_at: string;
        project_id: string | null;
        is_quick: boolean | null;
      }>;
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        reference: row.reference ?? "No reference",
        status: coerceReportStatus(row.status),
        updated: dateFormatter.format(new Date(row.updated_at)),
        projectId: row.project_id,
        isQuick: row.is_quick === true,
      }));
    },
  });




/* ------------------------------------------------------------------ */
/* Directory                                                            */
/* ------------------------------------------------------------------ */

export const directoryQuery = (organisationIds: string[]) =>
  queryOptions({
    queryKey: ["directory", [...organisationIds].sort()],
    enabled: organisationIds.length > 0,
    queryFn: async (): Promise<DirectoryEntry[]> => {
      const rows = unwrap(
        await from("project_directory")
          .select("id, trade, company_name, is_active, projects!inner(organisation_id)")
          .in("projects.organisation_id", organisationIds)
          .order("trade", { ascending: true }),
      ) as Array<{ id: string; trade: string; company_name: string }>;
      if (rows.length === 0) return [];

      const contacts = unwrap(
        await from("directory_contacts")
          .select("id, directory_id, name, email, phone, is_primary")
          .in(
            "directory_id",
            rows.map((row) => row.id),
          ),
      ) as Array<{
        directory_id: string;
        name: string;
        email: string | null;
        phone: string | null;
        is_primary: boolean;
      }>;

      return rows.map((row) => {
        const forEntry = contacts.filter((contact) => contact.directory_id === row.id);
        const primary = forEntry.find((contact) => contact.is_primary) ?? forEntry[0];
        return {
          id: row.id,
          trade: row.trade,
          company: row.company_name,
          contact: primary?.name ?? "No contact recorded",
          email: primary?.email ?? "",
          phone: primary?.phone ?? "",
        };
      });
    },
  });
