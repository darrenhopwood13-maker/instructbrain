import { projectCoverUrl } from "@/lib/project-cover";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataError, coerceSnapshot } from "@/lib/data";
import { resolveTradeAllocation } from "@/lib/trade-switch";
import { coerceReportStatus } from "@/lib/types";
import { PHOTO_BUCKET } from "@/lib/photos/storage-paths";
import { resolveLogoPath } from "@/lib/report/logo";
import { sortByPhotoOrder } from "@/lib/report/finding-order";
import type {
  DocFinding,
  DocFindingPhoto,
  DocPhoto,
  DocRegion,
  DocSynthesis,
  ReportDocument,
} from "@/lib/report/document";
import { coerceMarkup } from "@/lib/photos/markup";

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
            "id, organisation_id, project_id, title, subtitle, reference, report_date, status, issued_at, current_version, scope_text, methodology_text, executive_summary, synthesis, synthesis_confirmed, cover_photo_id, logo_path, output_language, survey_type_snapshot, author_id, trade_allocation_enabled",
          )
          .eq("id", reportId)
          .limit(1),
      ) as any[];
      const report = reports[0];
      if (!report) return null;

      const [projects, organisations, findingRows, photoRows, markupRows] = await Promise.all([
        report.project_id
          ? from("projects")
              .select("id, name, reference, client_name, address, principal_contractor")
              .eq("id", report.project_id)
              .limit(1)
          : Promise.resolve({ data: [], error: null }),

        from("organisations")
          .select("id, name, brand_colour, logo_path, address, trade_allocation_enabled")
          .eq("id", report.organisation_id)
          .limit(1),
        from("findings")
          .select(
            "id, ref, sequence, status, severity, hazard_category, finding_text, remedial_text, capture_fields, assigned_trade, ai_suggested_trade, ai_trade_reasoning, ai_trade_confidence, condition_grade, ai_suggested_grade, ai_grade_confidence, due_date, lifecycle_state, is_confidential, confirmed_at, likely_cause, regulatory_reference, ai_abstain_reason, ai_region",
          )
          .eq("report_id", reportId)
          .order("sequence", { ascending: true }),
        from("photos")
          .select(
            "id, sequence, original_filename, captured_at, storage_path, thumbnail_path, print_path, capture_fields",
          )
          .eq("report_id", reportId)
          .order("sequence", { ascending: true }),
        from("photo_markups").select("photo_id, layers").eq("report_id", reportId),
      ]);

      const project = (unwrap(projects) as any[])[0] ?? null;
      const organisation = (unwrap(organisations) as any[])[0] ?? null;
      const findings = unwrap(findingRows) as any[];
      const photos = unwrap(photoRows) as any[];
      const markups = unwrap(markupRows) as any[];
      const markupByPhoto = new Map(markups.map((row) => [row.photo_id, coerceMarkup(row.layers)]));

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

      // A per-report logo wins over the organisation's saved logo.
      const logoPath = resolveLogoPath(report.logo_path, organisation?.logo_path);
      const urls = await signedUrls([
        ...photos.map((photo) => photo.storage_path),
        ...photos.map((photo) => photo.thumbnail_path).filter(Boolean),
        ...photos.map((photo) => photo.print_path).filter(Boolean),
        ...(logoPath ? [logoPath] : []),
      ]);

      const docPhotos: DocPhoto[] = photos.map((photo) => ({
        id: photo.id,
        sequence: photo.sequence,
        filename: photo.original_filename ?? null,
        capturedAt: photo.captured_at ?? null,
        storagePath: photo.storage_path ?? null,
        thumbnailPath: photo.thumbnail_path ?? null,
        url: urls.get(photo.storage_path) ?? null,
        thumbUrl:
          (photo.thumbnail_path ? urls.get(photo.thumbnail_path) : null) ??
          urls.get(photo.storage_path) ??
          null,
        printUrl: (photo.print_path ? urls.get(photo.print_path) : null) ?? null,
        captureFields: fields(photo.capture_fields),
        layers: markupByPhoto.get(photo.id) ?? [],
      }));
      const photoById = new Map(docPhotos.map((photo) => [photo.id, photo]));

      const docFindings: DocFinding[] = sortByPhotoOrder(
        findings.map((row) => {
        const attached: DocFindingPhoto[] = links
          .filter((link) => link.finding_id === row.id)
          .map((link) => {
            const photo = photoById.get(link.photo_id);
            if (!photo) return null;
            // The link's own region wins — a person may have moved the box. The
            // AI's region is the fallback, and it is where the data actually sits.
            return {
              photo,
              role: link.role ?? "primary",
              region: region(link.region) ?? region(row.ai_region),
            };
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
          snagTitle: row.snag_title ?? null,
          remedialText: row.remedial_text ?? "",
          rectificationAlt: row.rectification_alt ?? null,
          tradesmanHack: row.tradesman_hack ?? null,
          hsNotes: row.hs_notes ?? null,
          captureFields: fields(row.capture_fields),
          assignedTrade: row.assigned_trade ?? null,
          suggestedTrade: row.ai_suggested_trade ?? null,
          tradeReasoning: row.ai_trade_reasoning ?? null,
          tradeConfidence: row.ai_trade_confidence ?? null,
          conditionGrade: row.condition_grade ?? null,
          suggestedGrade: row.ai_suggested_grade ?? null,
          gradeConfidence: row.ai_grade_confidence ?? null,
          dueDate: row.due_date ?? null,
          lifecycleState: row.lifecycle_state ?? "open",
          isConfidential: !!row.is_confidential,
          confirmedAt: row.confirmed_at ?? null,
          likelyCause: row.likely_cause ?? null,
          regulatoryReference: row.regulatory_reference ?? null,
          abstainReason: row.ai_abstain_reason ?? null,
          photos: attached,
        };
        }),
        // Upload order wins over the order the AI happened to finish in.
        (finding) => ({
          photoSequence: finding.photos[0]?.photo.sequence ?? null,
          sequence: finding.sequence,
        }),
      );

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
          outputLanguage: report.output_language ?? "en",
        },
        project: project
          ? {
              id: project.id,
              name: project.name,
              reference: project.reference ?? null,
              clientName: project.client_name ?? null,
              address: project.address ?? null,
              principalContractor: project.principal_contractor ?? null,
              coverUrl: await projectCoverUrl(report.organisation_id, project.id),
            }
          : null,
        organisation: organisation
          ? {
              id: organisation.id,
              name: organisation.name,
              brandColour: organisation.brand_colour ?? null,
              logoUrl: logoPath ? (urls.get(logoPath) ?? null) : null,
              address: organisation.address ?? null,
            }
          : null,
        snapshot: coerceSnapshot(report.survey_type_snapshot),
        // Two switches, resolved in one place. Off means no trade column, no
        // trade gate and no per-trade extracts for this report.
        tradeEnabled: resolveTradeAllocation(
          organisation?.trade_allocation_enabled,
          report.trade_allocation_enabled,
        ),
        tradeAllocation: {
          organisation: resolveTradeAllocation(organisation?.trade_allocation_enabled, null),
          report:
            typeof report.trade_allocation_enabled === "boolean"
              ? report.trade_allocation_enabled
              : null,
        },
        findings: docFindings,
        photos: docPhotos,
        synthesis: synthesis(report.synthesis),
        // A report records WHO authored it as an id, never their name, so there
        // is no name to print. The document shows no author row rather than a
        // placeholder: "Author: Recorded author" and "Author: Not recorded" are
        // both absences dressed as values on a client's own report.
        author: null,
      };
    },
  });

/**
 * The per-report override. `null` clears it, and the report follows the
 * account setting again.
 */
export async function setReportTradeAllocation(
  reportId: string,
  enabled: boolean | null,
): Promise<void> {
  const { error } = await from("reports")
    .update({ trade_allocation_enabled: enabled })
    .eq("id", reportId);
  if (error) throw new DataError(error.message, error.code, error.hint, error.details);
}

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
  /** The language the report is issued in. English stays the record copy. */
  output_language: string;
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
  snag_title: string | null;
  remedial_text: string;
  rectification_alt: string | null;
  tradesman_hack: string | null;
  hs_notes: string | null;
  capture_fields: Record<string, string>;
  status: string;
  severity: string | null;
  assigned_trade: string | null;
  /** A person's condition-grade decision. The AI's ai_suggested_grade is never touched. */
  condition_grade: string | null;
  due_date: string | null;
  likely_cause: string | null;
  regulatory_reference: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  human_edited: boolean;
  lifecycle_state: string;
  due_date_overridden: boolean;
  lifecycle_note: string | null;
  lifecycle_updated_at: string | null;
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

/**
 * A person's correction of the area an item points at on a photograph.
 *
 * It is written to the finding↔photo LINK, which wins over the model's own
 * region when the document is read — that is why the AI's original estimate is
 * never overwritten: the correction sits beside it and the read order decides.
 * The update is scoped to the one link, so it can never touch another item's
 * area even if two items share the photograph.
 */
export async function updateFindingPhotoRegion(
  reportId: string,
  findingId: string,
  photoId: string,
  region: { x: number; y: number; w: number; h: number },
): Promise<void> {
  const { data, error } = await from("finding_photos")
    .update({ region })
    .eq("finding_id", findingId)
    .eq("photo_id", photoId)
    .select("photo_id");
  if (error) {
    throw new DataError(error.message, error.code, error.hint, error.details);
  }
  // No rows matched means the photograph is not linked to this item. Say so
  // rather than reporting a save that never happened.
  if (!data || data.length === 0) {
    throw new DataError("That photograph is not linked to this item, so nothing was saved.", null, null, null);
  }
  await writeAudit({
    reportId,
    findingId,
    action: "finding.photo_region",
    before: {},
    after: { photoId, region },
  });
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
 * Publishing freezes a copy of the assembled document as the next version and
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
