import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ReportStatusPill } from "@/components/status-pill";
import { allReportsQuery } from "@/lib/data";
import { useOrganisations } from "@/lib/use-organisations";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => {
    const title = "All reports — instructBrain";
    const description =
      "Every report on your account, project and quick alike, newest first, with its status and the date it was last worked on.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: AllReports,
});

function AllReports() {
  const { organisationIds } = useOrganisations();
  const reports = useQuery(allReportsQuery(organisationIds));
  const list = reports.data ?? [];

  return (
    <AppShell>
      <header className="border-b border-border pb-6">
        <p className="eyebrow">Everything you have made</p>
        <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">All reports</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {reports.isSuccess
            ? `${list.length} report${list.length === 1 ? "" : "s"}, newest first.`
            : "Every report on your account, newest first."}
        </p>
      </header>

      <div className="mt-6">
        {reports.isPending ? (
          <LoadingState label="Loading your reports…" />
        ) : reports.isError ? (
          <ErrorState
            title="Your reports could not be loaded"
            error={reports.error}
            onRetry={() => void reports.refetch()}
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            eyebrow="Nothing here yet"
            title="No reports yet"
            description="Start one from the dashboard and it will appear here."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.map((report) => (
              <li key={report.id}>
                <Link
                  to="/reports/$id"
                  params={{ id: report.id }}
                  className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface-raised p-4 shadow-raised transition-colors hover:border-brand-blue/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold">{report.title}</span>
                    <ReportStatusPill status={report.status} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {report.isQuick && !report.projectId ? "Quick report" : "Project report"} ·{" "}
                    {report.reference} · Updated {report.updated}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
