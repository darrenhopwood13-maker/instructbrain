import { coerceSnapshot } from "@/lib/report/snapshot";
import { coerceReportStatus } from "@/lib/types";
import type { DocFindingPhoto, DocPhoto, ReportDocument } from "@/lib/report/document";

/** Maps the public share endpoint payload into the one document model. */
export function sharedDocument(payload: any): ReportDocument {
  const photos: DocPhoto[] = (payload.photos ?? []).map((photo: any) => ({
    id: photo.id,
    sequence: photo.sequence,
    filename: photo.original_filename ?? null,
    capturedAt: photo.captured_at ?? null,
    url: photo.url ?? null,
    thumbUrl: photo.thumbUrl ?? photo.url ?? null,
    captureFields: photo.capture_fields ?? {},
  }));
  const photoById = new Map(photos.map((photo) => [photo.id, photo]));

  return {
    report: {
      id: payload.report.id,
      title: payload.report.title,
      subtitle: payload.report.subtitle ?? null,
      reference: payload.report.reference ?? null,
      reportDate: payload.report.report_date,
      status: coerceReportStatus(payload.report.status),
      issuedAt: payload.report.issued_at ?? null,
      currentVersion: payload.report.current_version ?? 0,
      scopeText: payload.report.scope_text ?? null,
      methodologyText: payload.report.methodology_text ?? null,
      executiveSummary: payload.report.executive_summary ?? null,
      synthesisConfirmed: !!payload.report.synthesis_confirmed,
      coverPhotoId: payload.report.cover_photo_id ?? null,
      outputLanguage: payload.report.output_language ?? "en",
    },
    project: payload.project
      ? {
          id: payload.project.id,
          name: payload.project.name,
          reference: payload.project.reference ?? null,
          clientName: payload.project.client_name ?? null,
          address: payload.project.address ?? null,
          principalContractor: payload.project.principal_contractor ?? null,
        }
      : null,
    organisation: payload.organisation
      ? {
          id: payload.organisation.id,
          name: payload.organisation.name,
          brandColour: payload.organisation.brand_colour ?? null,
          logoUrl: payload.logoUrl ?? null,
          address: payload.organisation.address ?? null,
        }
      : null,
    snapshot: coerceSnapshot(payload.report.survey_type_snapshot),
    findings: (payload.findings ?? []).map((row: any) => ({
      id: row.id,
      ref: row.ref,
      sequence: row.sequence,
      statusId: row.status ?? "",
      severityId: row.severity ?? null,
      categoryId: row.hazard_category ?? null,
      findingText: row.finding_text ?? "",
      remedialText: row.remedial_text ?? "",
      captureFields: row.capture_fields ?? {},
      assignedTrade: row.assigned_trade ?? null,
      suggestedTrade: null,
      tradeReasoning: null,
      tradeConfidence: null,
      dueDate: row.due_date ?? null,
      lifecycleState: row.lifecycle_state ?? "open",
      isConfidential: false,
      confirmedAt: row.confirmed_at ?? null,
      likelyCause: row.likely_cause ?? null,
      regulatoryReference: row.regulatory_reference ?? null,
      abstainReason: row.ai_abstain_reason ?? null,
      photos: (payload.links ?? [])
        .filter((link: any) => link.finding_id === row.id)
        .map((link: any): DocFindingPhoto | null => {
          const photo = photoById.get(link.photo_id);
          return photo ? { photo, role: link.role ?? "primary", region: link.region ?? null } : null;
        })
        .filter(Boolean),
    })),
    photos,
    synthesis: payload.report.synthesis ?? null,
    author: null,
  };
}
