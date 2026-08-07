import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataError } from "@/lib/data";
import {
  buildExtractDocument,
  groupForDistribution,
  resolveGrouping,
  UNASSIGNED_GROUP,
  type ExtractDocument,
  type GroupableFinding,
  type GroupingKey,
} from "@/lib/distribution";
import { earliestTargetDate, severityBreakdown } from "@/lib/email/templates";
import { distributionGrouping, type SurveyTypeSnapshot } from "@/lib/survey-types";

/**
 * The distribution plan is what a human reads BEFORE anything is sent. It
 * pairs each group of findings with the recipient who would receive it, and
 * shows what has already gone out.
 *
 * Nothing in this module sends. Sending happens only from the server function
 * a person triggers with a button.
 */

function table(name: string) {
  return supabase.from(name as never) as any;
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

export type DeliveryState = {
  distributionId: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  error: string | null;
  recipientEmail: string | null;
};

export type PlanRow = {
  key: string;
  label: string;
  /** True for the group nobody has been assigned to yet. */
  unassigned: boolean;
  itemCount: number;
  severities: Array<{ label: string; count: number }>;
  earliestTarget: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  directoryId: string | null;
  /** Why this row cannot be sent, in plain words. Null when it can. */
  blockedReason: string | null;
  document: ExtractDocument;
  latestDelivery: DeliveryState | null;
  history: DeliveryState[];
};

export type DistributionPlan = {
  reportId: string;
  projectId: string;
  organisationId: string;
  reportTitle: string;
  reportReference: string | null;
  reportStatus: string;
  grouping: GroupingKey;
  snapshot: SurveyTypeSnapshot | null;
  fallback: { name: string | null; email: string | null };
  rows: PlanRow[];
  /** Confidential findings, counted only. They are never distributed. */
  withheldCount: number;
};

function toDelivery(row: Record<string, any>): DeliveryState {
  const snapshot = (row["recipient_snapshot"] ?? {}) as Record<string, unknown>;
  return {
    distributionId: row["id"] as string,
    status: (row["status"] as string) ?? "unknown",
    sentAt: (row["sent_at"] as string | null) ?? null,
    openedAt: (row["opened_at"] as string | null) ?? null,
    error: (row["error"] as string | null) ?? null,
    recipientEmail: typeof snapshot["email"] === "string" ? (snapshot["email"] as string) : null,
  };
}

export const distributionPlanQuery = (reportId: string) =>
  queryOptions({
    queryKey: ["distribution-plan", reportId],
    queryFn: async (): Promise<DistributionPlan> => {
      const reportRows = unwrap(
        await table("reports")
          .select(
            "id, title, reference, report_date, status, organisation_id, project_id, survey_type_snapshot, projects(name, address, fallback_recipient_name, fallback_recipient_email), organisations(name)",
          )
          .eq("id", reportId)
          .limit(1),
      ) as Array<Record<string, any>>;
      const report = reportRows[0];
      if (!report) throw new DataError("That report could not be found.");

      const snapshot = (report["survey_type_snapshot"] ?? null) as SurveyTypeSnapshot | null;
      const grouping = resolveGrouping(distributionGrouping(snapshot));
      const project = (report["projects"] ?? {}) as Record<string, any>;

      const findingRows = unwrap(
        await table("findings")
          .select(
            "id, ref, sequence, assigned_trade, severity, capture_fields, is_confidential, finding_text, remedial_text, due_date",
          )
          .eq("report_id", reportId)
          .order("sequence", { ascending: true }),
      ) as Array<Record<string, any>>;

      const findings: GroupableFinding[] = findingRows.map((row) => ({
        id: row["id"] as string,
        ref: row["ref"] as string,
        sequence: (row["sequence"] as number) ?? 0,
        assignedTrade: (row["assigned_trade"] as string | null) ?? null,
        severityId: (row["severity"] as string | null) ?? null,
        captureFields: (row["capture_fields"] ?? {}) as Record<string, string>,
        isConfidential: row["is_confidential"] === true,
        findingText: (row["finding_text"] as string) ?? "",
        remedialText: (row["remedial_text"] as string) ?? "",
        dueDate: (row["due_date"] as string | null) ?? null,
      }));

      const directoryRows = unwrap(
        await table("project_directory")
          .select("id, trade, company_name, is_active, directory_contacts(name, email, is_primary)")
          .eq("project_id", report["project_id"])
          .eq("is_active", true),
      ) as Array<Record<string, any>>;

      const distributionRows = unwrap(
        await table("distributions")
          .select("id, trade, status, sent_at, opened_at, error, recipient_snapshot, created_at")
          .eq("report_id", reportId)
          .order("created_at", { ascending: false }),
      ) as Array<Record<string, any>>;

      const fallback = {
        name: (project["fallback_recipient_name"] as string | null) ?? null,
        email: (project["fallback_recipient_email"] as string | null) ?? null,
      };

      const source = {
        projectName: (project["name"] as string) ?? "This project",
        projectAddress: (project["address"] as string | null) ?? null,
        reportTitle: (report["title"] as string) ?? "Report",
        reportReference: (report["reference"] as string | null) ?? null,
        reportDate: (report["report_date"] as string) ?? "",
        organisationName:
          ((report["organisations"] ?? {}) as Record<string, any>)["name"] ?? null,
      };

      const rows: PlanRow[] = groupForDistribution(findings, grouping, snapshot).map((group) => {
        const unassigned = group.key === UNASSIGNED_GROUP;
        const entry = directoryRows.find(
          (candidate) => !unassigned && candidate["trade"] === group.key,
        );
        const contacts = ((entry?.["directory_contacts"] ?? []) as Array<Record<string, any>>) ?? [];
        const primary = contacts.find((contact) => contact["is_primary"] === true) ?? contacts[0];

        const recipientName = unassigned
          ? (fallback.name ?? "Fallback recipient")
          : ((primary?.["name"] as string | null) ??
            (entry?.["company_name"] as string | null) ??
            null);
        const recipientEmail = unassigned
          ? fallback.email
          : ((primary?.["email"] as string | null) ?? null);

        const history = distributionRows
          .filter((candidate) =>
            unassigned ? candidate["trade"] === null : candidate["trade"] === group.key,
          )
          .map(toDelivery);

        const blockedReason = recipientEmail
          ? null
          : unassigned
            ? "No fallback recipient is set for this project. Set one on the project directory before sending."
            : `${group.label} has no contact with an email address in the project directory.`;

        return {
          key: group.key,
          label: unassigned && grouping === "trade" ? "No trade assigned" : group.label,
          unassigned,
          itemCount: group.items.length,
          severities: severityBreakdown(group.items),
          earliestTarget: earliestTargetDate(group.items),
          recipientName,
          recipientEmail,
          directoryId: (entry?.["id"] as string | null) ?? null,
          blockedReason,
          document: buildExtractDocument(group, grouping, source),
          latestDelivery: history[0] ?? null,
          history,
        };
      });

      return {
        reportId,
        projectId: report["project_id"] as string,
        organisationId: report["organisation_id"] as string,
        reportTitle: source.reportTitle,
        reportReference: source.reportReference,
        reportStatus: (report["status"] as string) ?? "draft",
        grouping,
        snapshot,
        fallback,
        rows,
        withheldCount: findings.filter((finding) => finding.isConfidential).length,
      };
    },
  });

export function findPlanRow(plan: DistributionPlan | undefined, key: string): PlanRow | null {
  return plan?.rows.find((row) => row.key === key) ?? null;
}
