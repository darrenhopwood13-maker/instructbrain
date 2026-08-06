import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, AlarmClock, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ReportStatusPill } from "@/components/status-pill";
import { overdueItemsQuery, projectQuery, projectReportsQuery } from "@/lib/data";
import { definitionLabel } from "@/lib/survey-types";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => {
    const title = "Project — Report Ready";
    const description = "Reports, photographs and overdue open items for this project.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ProjectDashboard,
});

function ProjectDashboard() {
  const { id } = Route.useParams();
  const project = useQuery(projectQuery(id));
  const reports = useQuery(projectReportsQuery(id));
  const overdue = useQuery(overdueItemsQuery(id));

  if (project.isPending) {
    return (
      <AppShell>
        <LoadingState label="Loading this project…" />
      </AppShell>
    );
  }

  if (project.isError) {
    return (
      <AppShell>
        <ErrorState
          title="This project could not be loaded"
          error={project.error}
          onRetry={() => void project.refetch()}
        />
      </AppShell>
    );
  }

  if (!project.data) {
    return (
      <AppShell>
        <EmptyState
          icon={FileText}
          eyebrow="Not found"
          title="No project with that address"
          description="It may have been removed, or it belongs to an organisation you are not a member of."
          action={
            <Button variant="quiet" asChild>
              <Link to="/">Back to projects</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  const current = project.data;
  const reportList = reports.data ?? [];
  const overdueList = overdue.data ?? [];

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link to="/" className="font-medium text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        <ChevronRight aria-hidden="true" className="mx-1 inline size-3.5 text-muted-foreground" />
        <span className="text-foreground">{current.reference}</span>
      </nav>

      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-b border-border pb-6">
        <div className="min-w-0">
          <p className="eyebrow">{current.client}</p>
          <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">
            {current.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{current.address}</p>
        </div>
        <Button variant="brand" className="shrink-0" asChild>
          <Link to="/reports/new" search={{ project: current.id }}>
            <Plus aria-hidden="true" />
            <span className="hidden sm:inline">New report</span>
            <span className="sr-only sm:hidden">New report</span>
          </Link>
        </Button>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="reports-heading">
          <h2 id="reports-heading" className="editorial-title text-lg font-semibold">
            Reports
          </h2>
          <div className="mt-4">
            {reports.isPending ? (
              <LoadingState label="Loading reports…" />
            ) : reports.isError ? (
              <ErrorState
                title="Reports could not be loaded"
                error={reports.error}
                onRetry={() => void reports.refetch()}
              />
            ) : reportList.length === 0 ? (
              <EmptyState
                icon={FileText}
                eyebrow="No reports"
                title="This project has no reports yet"
                description="Start a report, choose a survey type, and upload the photographs taken on site."
                action={
                  <Button variant="brand" asChild>
                    <Link to="/reports/new" search={{ project: current.id }}>
                      Start a report
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-raised">
                {reportList.map((report) => (
                  <li key={report.id}>
                    <Link
                      to="/reports/$id"
                      params={{ id: report.id }}
                      className="flex min-h-16 flex-col gap-2 p-4 transition-colors hover:bg-surface-sunken sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="min-w-0">
                        <span className="eyebrow">{report.reference}</span>
                        <span className="mt-0.5 block truncate font-semibold">{report.title}</span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {definitionLabel(report.surveyTypeSnapshot)} · {report.photoCount} photos
                          · {report.findingCount} findings · updated {report.updated}
                        </span>
                      </span>
                      <ReportStatusPill status={report.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="overdue-heading">
          <h2 id="overdue-heading" className="editorial-title text-lg font-semibold">
            Overdue open items
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open findings whose agreed close-out date has passed.
          </p>
          <div className="mt-4">
            {overdue.isPending ? (
              <LoadingState label="Checking close-out dates…" />
            ) : overdue.isError ? (
              <ErrorState
                title="Overdue items could not be loaded"
                error={overdue.error}
                onRetry={() => void overdue.refetch()}
              />
            ) : overdueList.length === 0 ? (
              <EmptyState
                icon={AlarmClock}
                title="Nothing overdue"
                description="Every open item on this project is within its agreed close-out window."
              />
            ) : (
              <ul className="space-y-3">
                {overdueList.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border bg-surface-raised p-4 shadow-raised"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="eyebrow">{item.ref}</p>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-fail/25 bg-fail-soft px-2.5 py-0.5 text-xs font-semibold text-fail">
                        <span aria-hidden="true" className="text-[0.7em] leading-none">
                          !
                        </span>
                        Overdue
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold leading-snug">{item.title}</p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {item.trade} · {item.due}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
