import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { coerceReportStatus, type ReportStatus } from "@/lib/types";

/**
 * The site-to-desk hand-off.
 *
 * A report is already visible at the desk the moment it saves — this records
 * the moment a person on site said they were finished, so the desk has a queue
 * to work rather than a guess. It is only ever set by someone pressing the
 * button: nothing here runs on a timer or on upload completion.
 */

export type SiteQueueReport = {
  id: string;
  title: string;
  status: ReportStatus;
  sentAt: string;
  projectId: string | null;
};

const stamp = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Reports someone on site marked as finished, oldest first. */
export const siteQueueQuery = (organisationIds: string[]) =>
  queryOptions({
    queryKey: ["reports", "site-queue", [...organisationIds].sort()],
    enabled: organisationIds.length > 0,
    queryFn: async (): Promise<SiteQueueReport[]> => {
      const { data, error } = await (supabase.from("reports" as never) as any)
        .select("id, title, status, submitted_at, project_id")
        .in("organisation_id", organisationIds)
        .not("submitted_at", "is", null)
        .neq("status", "issued")
        .order("submitted_at", { ascending: true })
        .limit(12);
      if (error) throw new Error(error.message);
      return ((data ?? []) as Array<Record<string, string | null>>).map((row) => ({
        id: String(row["id"]),
        title: String(row["title"] ?? "Untitled report"),
        status: coerceReportStatus(String(row["status"] ?? "draft")),
        sentAt: row["submitted_at"] ? stamp.format(new Date(row["submitted_at"] as string)) : "—",
        projectId: (row["project_id"] as string | null) ?? null,
      }));
    },
  });

/** Whether a single report is already in the site queue. */
export const reportHandoffQuery = (reportId: string) =>
  queryOptions({
    queryKey: ["report-handoff", reportId],
    queryFn: async (): Promise<{ submittedAt: string | null }> => {
      const { data, error } = await (supabase.from("reports" as never) as any)
        .select("submitted_at")
        .eq("id", reportId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { submittedAt: (data?.submitted_at as string | null) ?? null };
    },
  });

/**
 * Records the hand-off. Called only from an explicit button press. Returns
 * the updated row so callers (the report screen's More menu) can hide the
 * action once a report is already in the queue.
 */
export async function sendReportToDashboard(
  reportId: string,
): Promise<{ submitted_at: string } | null> {
  const { data, error } = await (supabase.from("reports" as never) as any)
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", reportId)
    .select("submitted_at");
  if (error) throw new Error(error.message);
  return (data?.[0] as { submitted_at: string } | undefined) ?? null;
}
