import { createFileRoute } from "@tanstack/react-router";

/**
 * Read-only share link. No account is needed, so this endpoint does the work
 * that RLS would otherwise do: it validates the token, checks the expiry, and
 * NEVER returns a confidential finding.
 */
export const Route = createFileRoute("/api/public/shared-report/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = (params as { token?: string }).token ?? "";
        if (!/^[a-z0-9]{16,64}$/i.test(token)) {
          return Response.json({ error: "Invalid link." }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const { data: shares } = await admin
          .from("report_shares")
          .select("report_id, organisation_id, expires_at, revoked_at")
          .eq("token", token)
          .limit(1);
        const share = shares?.[0];
        if (!share || share.revoked_at || new Date(share.expires_at).getTime() < Date.now()) {
          return Response.json(
            { error: "This link has expired or been revoked." },
            { status: 404 },
          );
        }

        const [{ data: reports }, { data: findings }, { data: photos }] = await Promise.all([
          admin
            .from("reports")
            .select(
              "id, title, subtitle, reference, report_date, status, issued_at, current_version, scope_text, methodology_text, executive_summary, synthesis, synthesis_confirmed, cover_photo_id, survey_type_snapshot, project_id, organisation_id",
            )
            .eq("id", share.report_id)
            .limit(1),
          admin
            .from("findings")
            .select(
              "id, ref, sequence, status, severity, hazard_category, finding_text, remedial_text, capture_fields, assigned_trade, due_date, lifecycle_state, confirmed_at, likely_cause, regulatory_reference, ai_abstain_reason",
            )
            .eq("report_id", share.report_id)
            // Invariant 7: confidential findings are excluded from every
            // external distribution, including a share link.
            .eq("is_confidential", false)
            .order("sequence", { ascending: true }),
          admin
            .from("photos")
            .select("id, sequence, original_filename, captured_at, storage_path, thumbnail_path, capture_fields")
            .eq("report_id", share.report_id)
            .order("sequence", { ascending: true }),
        ]);

        const report = reports?.[0];
        if (!report) return Response.json({ error: "Report not found." }, { status: 404 });

        const [{ data: projects }, { data: organisations }] = await Promise.all([
          admin
            .from("projects")
            .select("id, name, reference, client_name, address, principal_contractor")
            .eq("id", report.project_id)
            .limit(1),
          admin
            .from("organisations")
            .select("id, name, brand_colour, logo_path, address")
            .eq("id", report.organisation_id)
            .limit(1),
        ]);

        const findingIds = (findings ?? []).map((finding: any) => finding.id);
        const { data: links } = findingIds.length
          ? await admin
              .from("finding_photos")
              .select("finding_id, photo_id, role, region")
              .in("finding_id", findingIds)
          : { data: [] as any[] };

        const paths = [
          ...(photos ?? []).map((photo: any) => photo.storage_path),
          ...(photos ?? []).map((photo: any) => photo.thumbnail_path),
          organisations?.[0]?.logo_path,
        ].filter(Boolean) as string[];

        const { data: signed } = await admin.storage
          .from("report-photos")
          .createSignedUrls([...new Set(paths)], 3600);
        const urls = new Map<string, string>(
          (signed ?? [])
            .filter((entry: any) => entry.path && entry.signedUrl)
            .map((entry: any) => [entry.path as string, entry.signedUrl as string]),
        );

        return Response.json(
          {
            report,
            project: projects?.[0] ?? null,
            organisation: organisations?.[0] ?? null,
            findings: findings ?? [],
            photos: (photos ?? []).map((photo: any) => ({
              ...photo,
              url: urls.get(photo.storage_path) ?? null,
              thumbUrl: photo.thumbnail_path ? (urls.get(photo.thumbnail_path) ?? null) : null,
            })),
            links: links ?? [],
            logoUrl: organisations?.[0]?.logo_path
              ? (urls.get(organisations[0].logo_path) ?? null)
              : null,
            expiresAt: share.expires_at,
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
