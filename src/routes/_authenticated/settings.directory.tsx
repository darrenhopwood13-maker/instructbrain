import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Contact, FolderOpen } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import { projectsQuery } from "@/lib/data";
import { directoryCountsQuery } from "@/lib/directory/directory-data";
import { useOrganisations } from "@/lib/use-organisations";

export const Route = createFileRoute("/_authenticated/settings/directory")({
  head: () => ({
    meta: [
      { title: "Project directory — instructBrain" },
      {
        name: "description",
        content:
          "Trades, companies and contacts used to distribute per-trade report extracts to subcontractors.",
      },
      { property: "og:title", content: "Project directory — instructBrain" },
      {
        property: "og:description",
        content: "Trades, companies and contacts for per-trade report distribution.",
      },
    ],
  }),
  component: DirectorySettings,
});

/**
 * A directory belongs to a project — who is on that job. This page is the way
 * in: pick a project, then edit its directory. Nothing is editable here,
 * because a contact with no project has nowhere to be distributed from.
 */
function DirectorySettings() {
  const { organisationIds } = useOrganisations();
  const projects = useQuery(projectsQuery(organisationIds));
  const projectList = projects.data ?? [];
  const counts = useQuery(directoryCountsQuery(projectList.map((project) => project.id)));

  return (
    <AppShell>
      <header className="border-b border-border pb-6">
        <p className="eyebrow">Settings</p>
        <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">
          Project directory
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Each project keeps its own list of trades, companies and contacts. Open a project to add
          or edit them. Per-trade extracts are prepared for these contacts when a report is issued,
          and nothing is ever sent without a person approving it.
        </p>
      </header>

      {projects.isPending ? (
        <LoadingState label="Loading your projects…" />
      ) : projects.isError ? (
        <ErrorState
          title="Your projects could not be loaded"
          error={projects.error}
          onRetry={() => void projects.refetch()}
        />
      ) : projectList.length === 0 ? (
        <EmptyState
          icon={Contact}
          eyebrow="Nothing here yet"
          title="No projects to hold a directory"
          description="A directory belongs to a project. Create a project first, then record the subcontractors working on it."
          action={
            <Button variant="brand" asChild>
              <Link to="/projects">Go to projects</Link>
            </Button>
          }
        />
      ) : (
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-raised">
          {projectList.map((project) => {
            const count = counts.data?.[project.id];
            const summary = counts.isPending
              ? "Counting entries…"
              : !count || count.trades === 0
                ? "No trades recorded yet"
                : `${count.trades} ${count.trades === 1 ? "trade" : "trades"} · ${count.contacts} ${
                    count.contacts === 1 ? "contact" : "contacts"
                  }`;
            return (
              <li key={project.id}>
                <Link
                  to="/projects/$id/directory"
                  params={{ id: project.id }}
                  className="flex min-h-16 items-center justify-between gap-3 p-4 transition-colors hover:bg-surface-sunken"
                >
                  <span className="min-w-0">
                    <span className="eyebrow">{project.reference}</span>
                    <span className="mt-0.5 block truncate font-semibold">{project.name}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{summary}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand-blue-ink">
                    <FolderOpen aria-hidden="true" className="size-4" />
                    <span className="hidden sm:inline">Open directory</span>
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
