import { projectCoverPath } from "@/lib/project-cover-path";
/**
 * Server-side assembly of the one document model.
 *
 * The browser builds the same shape in report-data.ts; this reads it through
 * whichever Supabase client it is handed (the caller's, so RLS still applies)
 * so the PDF the server produces cannot disagree with the screen.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTradeAllocation } from "@/lib/trade-switch";
import { coerceSnapshot } from "@/lib/report/snapshot";
import { ADVISORY_FOOTER_TEXT, coerceBrief } from "@/lib/report/brief";
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

type Db = SupabaseClient<any, any, any>;

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

async function signedUrls(db: Db, paths: string[], expiresIn = 900): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter((path): path is string => !!path))];
  if (unique.length === 0) return map;
  const { data } = await db.storage.from(PHOTO_BUCKET).createSignedUrls(unique, expiresIn);
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

export async function loadReportDocument(
  db: Db,
  reportId: string,
): Promise<ReportDocument | null> {
  const { data: reportRow } = await db
    .from("reports")
    .select(
      "id, organisation_id, project_id, title, subtitle, reference, report_date, status, issued_at, current_version, scope_text, methodology_text, executive_summary, synthesis, synthesis_confirmed, cover_photo_id, logo_path, output_language, survey_type_snapshot, brief, handover, trade_allocation_enabled",
    )
    .eq("id", reportId)
    .maybeSingle();
  const report = reportRow as Record<string, any> | null;
  if (!report) return null;

  const [projectResult, organisationResult, findingResult, photoResult, markupResult] = await Promise.all([
    report["project_id"]
      ? db
          .from("projects")
          .select("id, name, reference, client_name, address, principal_contractor")
          .eq("id", report["project_id"])
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("organisations")
      .select("id, name, brand_colour, logo_path, address, trade_allocation_enabled")
      .eq("id", report["organisation_id"])
      .maybeSingle(),
    db
      .from("findings")
      .select(
        "id, ref, sequence, status, severity, hazard_category, finding_text, remedial_text, capture_fields, assigned_trade, ai_suggested_trade, ai_trade_reasoning, ai_trade_confidence, condition_grade, ai_suggested_grade, ai_grade_confidence, due_date, lifecycle_state, is_confidential, confirmed_at, likely_cause, regulatory_reference, ai_abstain_reason, ai_region",
      )
      .eq("report_id", reportId)
      .order("sequence", { ascending: true }),
    db
      .from("photos")
      .select("id, sequence, original_filename, captured_at, storage_path, thumbnail_path, capture_fields")
      .eq("report_id", reportId)
      .order("sequence", { ascending: true }),
    db.from("photo_markups").select("photo_id, layers").eq("report_id", reportId),
  ]);

  const project = (projectResult as { data: any }).data ?? null;
  const organisation = (organisationResult as { data: any }).data ?? null;
  const findings = ((findingResult as { data: any[] | null }).data ?? []) as Array<Record<string, any>>;
  const photos = ((photoResult as { data: any[] | null }).data ?? []) as Array<Record<string, any>>;
  const markups = ((markupResult as { data: any[] | null }).data ?? []) as Array<Record<string, any>>;
  const markupByPhoto = new Map(markups.map((row) => [row["photo_id"], coerceMarkup(row["layers"])]));

  const links =
    findings.length === 0
      ? []
      : (((
          await db
            .from("finding_photos")
            .select("finding_id, photo_id, role, region")
            .in(
              "finding_id",
              findings.map((finding) => finding["id"]),
            )
        ).data ?? []) as Array<Record<string, any>>);

  // A per-report logo wins over the organisation's saved logo.
  const logoPath = resolveLogoPath(
    report["logo_path"] as string | null,
    organisation?.["logo_path"] as string | null,
  );
  const urls = await signedUrls(db, [
    ...photos.map((photo) => photo["storage_path"] as string),
    ...photos.map((photo) => photo["thumbnail_path"] as string),
    ...(logoPath ? [logoPath] : []),
    ...(project ? [projectCoverPath(report["organisation_id"], project["id"])] : []),
  ]);

  const docPhotos: DocPhoto[] = photos.map((photo) => ({
    id: photo["id"] as string,
    sequence: photo["sequence"] as number,
    filename: (photo["original_filename"] as string | null) ?? null,
    capturedAt: (photo["captured_at"] as string | null) ?? null,
    storagePath: (photo["storage_path"] as string | null) ?? null,
    thumbnailPath: (photo["thumbnail_path"] as string | null) ?? null,
    url: urls.get(photo["storage_path"] as string) ?? null,
    thumbUrl:
      (photo["thumbnail_path"] ? urls.get(photo["thumbnail_path"] as string) : null) ??
      urls.get(photo["storage_path"] as string) ??
      null,
    captureFields: fields(photo["capture_fields"]),
    layers: markupByPhoto.get(photo["id"]) ?? [],
  }));
  const photoById = new Map(docPhotos.map((photo) => [photo.id, photo]));

  const docFindings: DocFinding[] = sortByPhotoOrder(
    findings.map((row) => {
      const attached: DocFindingPhoto[] = links
        .filter((link) => link["finding_id"] === row["id"])
        .map((link) => {
          const photo = photoById.get(link["photo_id"] as string);
          if (!photo) return null;
          // The link's own region wins — a person may have moved the box. The AI's
          // region is the fallback, and it is where the data actually sits.
          return {
            photo,
            role: (link["role"] as string) ?? "primary",
            region: region(link["region"]) ?? region(row["ai_region"]),
          };
        })
        .filter((entry): entry is DocFindingPhoto => entry !== null)
        .sort((a, b) => (a.role === "primary" ? -1 : b.role === "primary" ? 1 : 0));

      return {
        id: row["id"] as string,
        ref: row["ref"] as string,
        sequence: row["sequence"] as number,
        statusId: (row["status"] as string) ?? "",
        severityId: (row["severity"] as string | null) ?? null,
        categoryId: (row["hazard_category"] as string | null) ?? null,
        findingText: (row["finding_text"] as string) ?? "",
        snagTitle: (row["snag_title"] as string | null) ?? null,
        remedialText: (row["remedial_text"] as string) ?? "",
        rectificationAlt: (row["rectification_alt"] as string | null) ?? null,
        tradesmanHack: (row["tradesman_hack"] as string | null) ?? null,
        hsNotes: (row["hs_notes"] as string | null) ?? null,
        captureFields: fields(row["capture_fields"]),
        assignedTrade: (row["assigned_trade"] as string | null) ?? null,
        suggestedTrade: (row["ai_suggested_trade"] as string | null) ?? null,
        tradeReasoning: (row["ai_trade_reasoning"] as string | null) ?? null,
        tradeConfidence: (row["ai_trade_confidence"] as number | null) ?? null,
        conditionGrade: (row["condition_grade"] as string | null) ?? null,
        suggestedGrade: (row["ai_suggested_grade"] as string | null) ?? null,
        gradeConfidence: (row["ai_grade_confidence"] as number | null) ?? null,
        dueDate: (row["due_date"] as string | null) ?? null,
        lifecycleState: (row["lifecycle_state"] as string) ?? "open",
        isConfidential: row["is_confidential"] === true,
        confirmedAt: (row["confirmed_at"] as string | null) ?? null,
        likelyCause: (row["likely_cause"] as string | null) ?? null,
        regulatoryReference: (row["regulatory_reference"] as string | null) ?? null,
        abstainReason: (row["ai_abstain_reason"] as string | null) ?? null,
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
      id: report["id"] as string,
      title: report["title"] as string,
      subtitle: (report["subtitle"] as string | null) ?? null,
      reference: (report["reference"] as string | null) ?? null,
      reportDate: report["report_date"] as string,
      status: coerceReportStatus(report["status"]),
      issuedAt: (report["issued_at"] as string | null) ?? null,
      currentVersion: (report["current_version"] as number) ?? 0,
      scopeText: (report["scope_text"] as string | null) ?? null,
      methodologyText: (report["methodology_text"] as string | null) ?? null,
      executiveSummary: (report["executive_summary"] as string | null) ?? null,
      synthesisConfirmed: report["synthesis_confirmed"] === true,
      coverPhotoId: (report["cover_photo_id"] as string | null) ?? null,
      outputLanguage: (report["output_language"] as string | null) ?? "en",
      draftSummary: coerceBrief(report["brief"])?.draftSummary ?? false,
      handover: report["handover"] ?? null,


    },
    project: project
      ? {
          id: project["id"],
          name: project["name"],
          reference: project["reference"] ?? null,
          clientName: project["client_name"] ?? null,
          address: project["address"] ?? null,
          principalContractor: project["principal_contractor"] ?? null,
          coverUrl:
            urls.get(projectCoverPath(report["organisation_id"], project["id"])) ?? null,
        }
      : null,
    organisation: organisation
      ? {
          id: organisation["id"],
          name: organisation["name"],
          brandColour: organisation["brand_colour"] ?? null,
          logoUrl: logoPath ? (urls.get(logoPath) ?? null) : null,
          address: organisation["address"] ?? null,
        }
      : null,
    snapshot: coerceSnapshot(report["survey_type_snapshot"]),
    // The same two switches the screen reads, resolved the same way, so a PDF can
    // never disagree with the screen about whether trades are in play.
    tradeEnabled: resolveTradeAllocation(
      (organisation as Record<string, unknown> | null)?.["trade_allocation_enabled"],
      report["trade_allocation_enabled"],
    ),
    tradeAllocation: {
      organisation: resolveTradeAllocation(
        (organisation as Record<string, unknown> | null)?.["trade_allocation_enabled"],
        null,
      ),
      report:
        typeof report["trade_allocation_enabled"] === "boolean"
          ? report["trade_allocation_enabled"]
          : null,
    },
    // A custom report may cover several survey types; the labels come from
    // the report's own brief, never from anything hardcoded here.
    surveyTypes: coerceBrief(report["brief"])?.surveyTypes ?? [],
    advisoryFooter: coerceBrief(report["brief"])?.advisoryFooter ? ADVISORY_FOOTER_TEXT : null,
    findings: docFindings,
    photos: docPhotos,
    synthesis: synthesis(report["synthesis"]),
    author: null,
  };
}
