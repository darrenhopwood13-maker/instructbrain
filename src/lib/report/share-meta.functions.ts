import { createServerFn } from "@tanstack/react-start";

export type ShareMeta = {
  title: string | null;
  reference: string | null;
  reportDate: string | null;
  issuedAt: string | null;
};

/**
 * Just enough of a shared report to title the page and its link preview:
 * title, reference and date. Never any finding text, and never anything
 * confidential.
 */
export const getSharedReportMeta = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => ({ token: String(data?.token ?? "") }))
  .handler(async ({ data }): Promise<ShareMeta> => {
    const empty: ShareMeta = { title: null, reference: null, reportDate: null, issuedAt: null };
    if (!/^[a-z0-9]{16,64}$/i.test(data.token)) return empty;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: shares } = await supabaseAdmin
        .from("report_shares")
        .select("report_id, expires_at, revoked_at")
        .eq("token", data.token)
        .limit(1);
      const share = shares?.[0];
      if (!share || share.revoked_at) return empty;
      if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) return empty;

      const { data: reports } = await supabaseAdmin
        .from("reports")
        .select("title, reference, report_date, issued_at")
        .eq("id", share.report_id)
        .limit(1);
      const report = reports?.[0];
      if (!report) return empty;
      return {
        title: report.title ?? null,
        reference: report.reference ?? null,
        reportDate: report.report_date ?? null,
        issuedAt: report.issued_at ?? null,
      };
    } catch {
      return empty;
    }
  });
