import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderOpen, ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { projects } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Projects — Report Ready" },
      {
        name: "description",
        content:
          "Site photographs in, client-ready construction reports out. Manage every project, survey and issued report in one place.",
      },
      { property: "og:title", content: "Projects — Report Ready" },
      {
        property: "og:description",
        content:
          "Site photographs in, client-ready construction reports out. Manage every project, survey and issued report in one place.",
      },
    ],
  }),
  component: ProjectsIndex,
});

function ProjectsIndex() {
  return (
    <AppShell>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 pb-6">
        <div className="min-w-0">
          <p className="eyebrow">Portfolio</p>
          <h1 className="editorial-title mt-1 truncate text-2xl font-semibold sm:text-3xl">
            Projects
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {projects.length} active instructions. Open a project to review its reports and
            outstanding items.
          </p>
        </div>
        <Button variant="brand" className="shrink-0">
          <Plus aria-hidden="true" />
          <span className="hidden sm:inline">New project</span>
          <span className="sr-only sm:hidden">New project</span>
        </Button>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          eyebrow="Nothing here yet"
          title="No projects on your account"
          description="Create your first project to start uploading site photographs and issuing reports."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                to="/projects/$id"
                params={{ id: project.id }}
                className="group flex h-full flex-col rounded-xl border border-border bg-surface-raised p-5 shadow-raised transition-colors hover:border-brand-blue/40"
              >
                <p className="eyebrow">{project.reference}</p>
                <h2 className="editorial-title mt-1.5 text-lg font-semibold leading-snug">
                  {project.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{project.client}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{project.address}</p>

                <dl className="mt-5 grid grid-cols-2 gap-3 rule-top pt-4 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Open reports</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                      {project.openReports}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Overdue items</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                      {project.overdueItems}
                    </dd>
                  </div>
                </dl>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple-ink">
                  Open project
                  <ArrowRight aria-hidden="true" className="size-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
