import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { FileText, AlarmClock, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { StatusPill, ReportStatusPill } from "@/components/status-pill";
import { getProject, reportsForProject, overdueItems, prePlasterSnapshot } from "@/lib/mock-data";
import { resolveStatus } from "@/lib/survey-types";

export const Route = createFileRoute("/projects/$id")({
  loader: ({ params }) => {
    const project = getProject(params.id);
    if (!project) throw notFound();
    return { project };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.project.name} — Report Ready` : "Project — Report Ready";
    const description = loaderData
      ? `Reports and outstanding items for ${loaderData.project.name} (${loaderData.project.reference}).`
      : "Project dashboard.";
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
  const { project } = Route.useLoaderData();
  const list = reportsForProject(project.id);
  const overdue = project.overdueItems > 0 ? overdueItems : [];

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link to="/" className="font-medium text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        <ChevronRight aria-hidden="true" className="mx-1 inline size-3.5 text-muted-foreground" />
        <span className="text-foreground">{project.reference}</span>
      </nav>

      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-b border-border pb-6">
        <div className="min-w-0">
          <p className="eyebrow">{project.client}</p>
          <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">
            {project.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{project.address}</p>
        </div>
        <Button variant="brand" className="shrink-0">
          <Plus aria-hidden="true" />
          <span className="hidden sm:inline">New report</span>
          <span className="sr-only sm:hidden">New report</span>
        </Button>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="reports-heading">
          <h2 id="reports-heading" className="editorial-title text-lg font-semibold">
            Reports
          </h2>
          {list.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={FileText}
                eyebrow="No reports"
                title="This project has no reports yet"
                description="Start a report, choose a survey type, and upload the photographs taken on site."
                action={<Button variant="brand">Start a report</Button>}
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-raised">
              {list.map((report) => (
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
                        {report.surveyType} · {report.photoCount} photos · {report.findingCount}{" "}
                        findings · {report.updated}
                      </span>
                    </span>
                    <ReportStatusPill status={report.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="overdue-heading">
          <h2 id="overdue-heading" className="editorial-title text-lg font-semibold">
            Overdue open items
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Placeholder panel — tracking of close-out evidence arrives in a later release.
          </p>
          {overdue.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={AlarmClock}
                title="Nothing overdue"
                description="Every open item on this project is within its agreed close-out window."
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {overdue.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-border bg-surface-raised p-4 shadow-raised"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="eyebrow">{item.ref}</p>
                    <StatusPill status={resolveStatus(prePlasterSnapshot, item.status)} />
                  </div>
                  <p className="mt-1.5 text-sm font-semibold leading-snug">{item.title}</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {item.trade} · {item.due}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
