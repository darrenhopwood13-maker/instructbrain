import { createFileRoute } from "@tanstack/react-router";

/**
 * The PDF behind every share link. Serves the frozen published PDF — never a
 * review page, and never the live working copy — and only while the link is
 * live and the report is published.
 *
 * This used to accept manual photographic reports only, so a site condition or
 * project report's link could not produce a PDF at all: it fell back to the
 * inline viewer, which re-reads live rows and showed the client a draft.
 */
export const Route = createFileRoute("/api/public/shared-report-pdf/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const token = (params as { token?: string }).token ?? "";
        if (!/^[a-z0-9]{16,64}$/i.test(token)) {
          return new Response("Invalid link.", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;
        const { data: shares } = await admin
          .from("report_shares")
          .select("report_id, expires_at, revoked_at, version_id")
          .eq("token", token)
          .limit(1);
        const share = shares?.[0];
        if (!share || share.revoked_at) return new Response("Link not available.", { status: 404 });
        if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
          return new Response("This link has expired.", { status: 404 });
        }
        const { data: reports } = await admin
          .from("reports")
          .select("status, current_version")
          .eq("id", share.report_id)
          .limit(1);
        const report = reports?.[0];
        // One rule for every report type: a link serves a published report's
        // frozen copy, and nothing at all while it is unpublished.
        if (!report || report.status !== "issued") {
          return new Response("This report is not available as a PDF.", { status: 404 });
        }
        const { buildIssuedPdfBytes } = await import("@/lib/report/pdf-attachment.server");
        const built = await buildIssuedPdfBytes(
          admin,
          share.report_id,
          { variant: "full" },
          Number.POSITIVE_INFINITY,
          // A link keeps handing back the version it was made against, so the
          // client's copy cannot shift under them when the report is reissued.
          (share as { version_id?: string | null }).version_id ?? null,
        ).catch(() => null);
        if (!built) return new Response("The report PDF could not be built.", { status: 500 });
        const download = new URL(request.url).searchParams.get("download") === "1";
        const safe = built.filename.replace(/[^\w.\- ]/g, "_");
        return new Response(built.bytes as unknown as BodyInit, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safe}"`,
            "Cache-Control": "private, no-store",
          },
        });
      },
    },
  },
});
