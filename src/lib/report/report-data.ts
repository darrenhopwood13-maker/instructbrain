import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataError, coerceSnapshot } from "@/lib/data";
import { coerceReportStatus } from "@/lib/types";
import { PHOTO_BUCKET } from "@/lib/photos/storage-paths";
import type {
  DocFinding,
  DocFindingPhoto,
  DocPhoto,
  DocRegion,
  DocSynthesis,
  ReportDocument,
} from "@/lib/report/document";

/* Untyped escape hatch: generated types lag behind applied migrations. */
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

function region(value: unknown): DocRegion | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const nums = ["x", "y", "w", "h"].map((key) => Number(raw[key]));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return { x: nums[0]!, y: nums[1]!, w: nums[2]!, h: nums[3]! };
}

function fields(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string" && item.trim() !== "") out[key] = item;
  }
  return out;
}

function synthesis(value: unknown): DocSynthesis | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  return {
    executiveSummary: typeof raw["executiveSummary"] === "string" ? raw["executiveSummary"] : "",
    actions: Array.isArray(raw["actions"]) ? (raw["actions"] as DocSynthesis["actions"]) : [],
    patterns: Array.isArray(raw["patterns"]) ? (raw["patterns"] as DocSynthesis["patterns"]) : [],
    generatedAt: typeof raw["generatedAt"] === "string" ? raw["generatedAt"] : null,
  };
}

async function signedUrls(paths: string[], expiresIn = 3600): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter((path) => !!path))];
  if (unique.length === 0) return map;
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(unique, expiresIn);
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

/**
 * One read assembles the whole document: report, project, organisation,
 * findings, photographs and the links between them. Confidential findings are
 * filtered by RLS, not here.
 */
export const reportDocumentQuery = (reportId: string) =>
  queryOptions({
    queryKey: ["report-document", reportId],
    queryFn: async (): Promise<ReportDocument | null> => {
      const reports = unwrap(
        await from("reports")
          .select(
            "id, organisation_id, project_id, title, subtitle, reference, report_date, status, issued_at, current_version, scope_text, methodology_text, executive_summary, synthesis, synthesis_confirmed, cover_photo_id, survey_type_snapshot, author_id",
          )
          .eq("id", reportId)
          .limit(1),
      ) as any[];
      const report = reports[0];
      if (!report) return null;

      const [projects, organisations, findingRows, photoRows] = await Promise.all([
        from("projects")
          .select("id, name, reference, client_name, address, principal_contractor")
          .eq("id", report.project_id)
          .limit(1),
        from("organisations")
          .select("id, name, brand_colour, logo_path, address")
          .eq("id", report.organisation_id)
          .limit(1),
        from("findings")
          .select(
            "id, ref, sequence, status, severity, hazard_category, finding_text, remedial_text, capture_fields, assigned_trade, ai_suggested_trade, ai_trade_reasoning, ai_trade_confidence, due_date, lifecycle_state, is_confidential, confirmed_at, likely_cause, regulatory_reference, ai_abstain_reason",
          )
          .eq("report_id", reportId)
          .order("sequence", { ascending: true }),
        from("photos")
          .select(
            "id, sequence, original_filename, captured_at, storage_path, thumbnail_path, capture_fields",
          )
          .eq("report_id", reportId)
          .order("sequence", { ascending: true }),
      ]);

      const project = (unwrap(projects) as any[])[0] ?? null;
      const organisation = (unwrap(organisations) as any[])[0] ?? null;
      const findings = unwrap(findingRows) as any[];
      const photos = unwrap(photoRows) as any[];

      const links =
        findings.length === 0
          ? []
          : ((unwrap(
              await from("finding_photos")
                .select("finding_id, photo_id, role, region")
                .in(
                  "finding_id",
                  findings.map((finding) => finding.id),
                ),
            ) as any[]) ?? []);

      const urls = await signedUrls([
        ...photos.map((photo) => photo.storage_path),
        ...photos.map((photo) => photo.thumbnail_path).filter(Boolean),
        ...(organisation?.logo_path ? [organisation.logo_path] : []),
      ]);

      const docPhotos: DocPhoto[] = photos.map((photo) => ({
        id: photo.id,
        sequence: photo.sequence,
        filename: photo.original_filename ?? null,
        capturedAt: photo.captured_at ?? null,
        url: urls.get(photo.storage_path) ?? null,
        thumbUrl:
          (photo.thumbnail_path ? urls.get(photo.thumbnail_path) : null) ??
          urls.get(photo.storage_path) ??
          null,
        captureFields: fields(photo.capture_fields),
      }));
      const photoById = new Map(docPhotos.map((photo) => [photo.id, photo]));

      const docFindings: DocFinding[] = findings.map((row) => {
        const attached: DocFindingPhoto[] = links
          .filter((link) => link.finding_id === row.id)
          .map((link) => {
            const photo = photoById.get(link.photo_id);
            return photo
              ? { photo, role: link.role ?? "primary", region: region(link.region) }
              : null;
          })
          .filter((entry): entry is DocFindingPhoto => entry !== null)
          .sort((a, b) => (a.role === "primary" ? -1 : b.role === "primary" ? 1 : 0));

        return {
          id: row.id,
          ref: row.ref,
          sequence: row.sequence,
          statusId: row.status ?? "",
          severityId: row.severity ?? null,
          categoryId: row.hazard_category ?? null,
          findingText: row.finding_text ?? "",
          remedialText: row.remedial_text ?? "",
          captureFields: fields(row.capture_fields),
          assignedTrade: row.assigned_trade ?? null,
          suggestedTrade: row.ai_suggested_trade ?? null,
          tradeReasoning: row.ai_trade_reasoning ?? null,
          tradeConfidence: row.ai_trade_confidence ?? null,
          dueDate: row.due_date ?? null,
          lifecycleState: row.lifecycle_state ?? "open",
          isConfidential: !!row.is_confidential,
          confirmedAt: row.confirmed_at ?? null,
          likelyCause: row.likely_cause ?? null,
          regulatoryReference: row.regulatory_reference ?? null,
          abstainReason: row.ai_abstain_reason ?? null,
          photos: attached,
        };
      });

      return {
        report: {
          id: report.id,
          title: report.title,
          subtitle: report.subtitle ?? null,
          reference: report.reference ?? null,
          reportDate: report.report_date,
          status: coerceReportStatus(report.status),
          issuedAt: report.issued_at ?? null,
          currentVersion: report.current_version ?? 0,
          scopeText: report.scope_text ?? null,
          methodologyText: report.methodology_text ?? null,
          executiveSummary: report.executive_summary ?? null,
          synthesisConfirmed: !!report.synthesis_confirmed,
          coverPhotoId: report.cover_photo_id ?? null,
        },
        project: project
          ? {
              id: project.id,
              name: project.name,
              reference: project.reference ?? null,
              clientName: project.client_name ?? null,
              address: project.address ?? null,
              principalContractor: project.principal_contractor ?? null,
            }
          : null,
        organisation: organisation
          ? {
              id: organisation.id,
              name: organisation.name,
              brandColour: organisation.brand_colour ?? null,
              logoUrl: organisation.logo_path
                ? (urls.get(organisation.logo_path) ?? null)
                : null,
              address: organisation.address ?? null,
            }
          : null,
        snapshot: coerceSnapshot(report.survey_type_snapshot),
        findings: docFindings,
        photos: docPhotos,
        synthesis: synthesis(report.synthesis),
        author: report.author_id ? "Recorded author" : null,
      };
    },
  });

/* ------------------------------------------------------------------ */
/* Audit trail                                                          */
/* ------------------------------------------------------------------ */

async function writeAudit(entry: {
  reportId: string;
  findingId?: string | null;
  action: string;
  before: unknown;
  after: unknown;
}): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const actorId = data.user?.id ?? null;
  if (!actorId) return;
  await from("audit_log").insert({
    report_id: entry.reportId,
    finding_id: entry.findingId ?? null,
    actor_id: actorId,
    action: entry.action,
    before: entry.before === undefined ? null : (entry.before as never),
    after: entry.after === undefined ? null : (entry.after as never),
  });
}

/* ------------------------------------------------------------------ */
/* Edits                                                                */
/* ------------------------------------------------------------------ */

export type ReportPatch = Partial<{
  title: string;
  subtitle: string | null;
  reference: string | null;
  report_date: string;
  scope_text: string | null;
  methodology_text: string | null;
  executive_summary: string | null;
  synthesis_confirmed: boolean;
  cover_photo_id: string | null;
}>;

export async function updateReportFields(
  reportId: string,
  patch: ReportPatch,
  before: Record<string, unknown>,
): Promise<void> {
  const { error } = await from("reports").update(patch).eq("id", reportId);
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);
  await writeAudit({ reportId, action: "report.update", before, after: patch });
}

export type FindingPatch = Partial<{
  finding_text: string;
  remedial_text: string;
  status: string;
  severity: string | null;
  assigned_trade: string | null;
  due_date: string | null;
  likely_cause: string | null;
  regulatory_reference: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  human_edited: boolean;
  lifecycle_state: string;
}>;

export async function updateFinding(
  reportId: string,
  findingId: string,
  patch: FindingPatch,
  before: Record<string, unknown>,
): Promise<void> {
  const { error } = await from("findings")
    .update({ ...patch, human_edited: true })
    .eq("id", findingId);
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);
  await writeAudit({ reportId, findingId, action: "finding.update", before, after: patch });
}

/* ------------------------------------------------------------------ */
/* Issue and version                                                    */
/* ------------------------------------------------------------------ */

export const reportVersionsQuery = (reportId: string) =>
  queryOptions({
    queryKey: ["report-versions", reportId],
    queryFn: async (): Promise<
      Array<{ id: string; version: number; issued_at: string }>
    > =>
      unwrap(
        await from("report_versions")
          .select("id, version, issued_at")
          .eq("report_id", reportId)
          .order("version", { ascending: false }),
      ) as Array<{ id: string; version: number; issued_at: string }>,
  });

/**
 * Issuing freezes a copy of the assembled document as the next version and
 * stamps the report. A re-issue writes version n+1 and never touches n.
 */
export async function issueReport(document: ReportDocument): Promise<number> {
  const version = (document.report.currentVersion ?? 0) + 1;
  const { data } = await supabase.auth.getUser();

  const { error: versionError } = await from("report_versions").insert({
    report_id: document.report.id,
    organisation_id: document.organisation?.id ?? null,
    version,
    document: JSON.parse(JSON.stringify(document)),
    issued_by: data.user?.id ?? null,
  });
  if (versionError) {
    throw new DataError(
      versionError.message,
      versionError.code,
      versionError.hint,
      versionError.details,
    );
  }

  const issuedAt = new Date().toISOString();
  const { error } = await from("reports")
    .update({ status: "issued", issued_at: issuedAt, current_version: version })
    .eq("id", document.report.id);
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);

  await writeAudit({
    reportId: document.report.id,
    action: "report.issue",
    before: { status: document.report.status, version: document.report.currentVersion },
    after: { status: "issued", version, issued_at: issuedAt },
  });
  return version;
}

/** Reopening unlocks editing. The issued version stays exactly as issued. */
export async function reopenReport(reportId: string): Promise<void> {
  const { error } = await from("reports").update({ status: "in_review" }).eq("id", reportId);
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);
  await writeAudit({
    reportId,
    action: "report.reopen",
    before: { status: "issued" },
    after: { status: "in_review" },
  });
}

/* ------------------------------------------------------------------ */
/* Share links                                                          */
/* ------------------------------------------------------------------ */

export type ShareLink = {
  id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

export const reportSharesQuery = (reportId: string) =>
  queryOptions({
    queryKey: ["report-shares", reportId],
    queryFn: async (): Promise<ShareLink[]> =>
      unwrap(
        await from("report_shares")
          .select("id, token, label, expires_at, revoked_at")
          .eq("report_id", reportId)
          .order("created_at", { ascending: false }),
      ) as ShareLink[],
  });

function shareToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 40);
}

export async function createShareLink(input: {
  reportId: string;
  organisationId: string;
  /** Days until expiry, or null for a link that never expires. */
  days: number | null;
  label?: string;
}): Promise<ShareLink> {
  const { data: userData } = await supabase.auth.getUser();
  const expires =
    input.days === null ? null : new Date(Date.now() + input.days * 86_400_000).toISOString();
  const { data, error } = await from("report_shares")
    .insert({
      report_id: input.reportId,
      organisation_id: input.organisationId,
      token: shareToken(),
      label: input.label ?? null,
      expires_at: expires,
      created_by: userData.user?.id ?? null,
    })
    .select("id, token, label, expires_at, revoked_at")
    .single();
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);
  const share = data as ShareLink;
  await writeAudit({
    reportId: input.reportId,
    action: "report.share_created",
    before: null,
    after: { share_id: share.id, expires_at: expires },
  });
  return share;
}

/** Records that a link was handed to someone. Sending is always a human act. */
export async function logShareSent(reportId: string, shareId: string): Promise<void> {
  await writeAudit({
    reportId,
    action: "report.share_sent",
    before: null,
    after: { share_id: shareId },
  });
}

export async function revokeShareLink(reportId: string, shareId: string): Promise<void> {
  const { error } = await from("report_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId);
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);
  await writeAudit({
    reportId,
    action: "report.share_revoked",
    before: null,
    after: { share_id: shareId },
  });
}
