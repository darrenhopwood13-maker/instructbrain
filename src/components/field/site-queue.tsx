import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Send } from "lucide-react";
import { ReportStatusPill } from "@/components/status-pill";
import { siteQueueQuery } from "@/lib/field/handoff";

/**
 * Desk-side queue of reports someone on site has finished with, oldest first.
 * Marking a report sent never issues or distributes anything — a person still
 * reviews every finding here.
 */
export function SiteQueue({ organisationIds }: { organisationIds: string[] }) {
  const queue = useQuery(siteQueueQuery(organisationIds));
  const rows = queue.data ?? [];
  if (rows.length === 0) return null;

  return (
    <section
      aria-labelledby="site-queue-heading"
      className="mt-6 rounded-xl border border-border bg-surface-raised p-4 shadow-raised"
    >
      <p className="eyebrow">From site</p>
      <h2 id="site-queue-heading" className="editorial-title text-base font-semibold">
        Sent for review
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {rows.length} waiting
        </span>
      </h2>
      <ul className="mt-3 space-y-2">
        {rows.map((report) => (
          <li key={report.id}>
            <Link
              to="/reports/$id"
              params={{ id: report.id }}
              search={{ tab: "review" }}
              className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-brand-blue/40"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Send aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate font-semibold">{report.title}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">Sent {report.sentAt}</span>
                <ReportStatusPill status={report.status} />
                <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
