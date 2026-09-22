import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Camera, ChevronDown, ClipboardCheck, ClipboardList } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ReportStatusPill } from "@/components/status-pill";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orgOverdueItemsQuery, projectsQuery, recentReportsQuery } from "@/lib/data";
import { complianceProjectId } from "@/lib/compliance/destination";
import { useOrganisations } from "@/lib/use-organisations";
import { TemplateSelect } from "@/components/template-select";

type Mode = "project" | "quick";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — instructBrain" },
      { name: "description", content: "Start a report, or pick up an open one." },
    ],
  }),
  component: Dashboard,
});

function ActionTile({
  active,
  label,
  icon: Icon,
  obj,
  orange = false,
  onSelect,
}: {
  active: boolean;
  label: string;
  icon: typeof ClipboardList;
  obj: string;
  orange?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={orange ? "ib-btn-3d orange" : "ib-btn-3d"}
    >
      <Icon aria-hidden="true" />
      {label}
      <span className="obj">
        <ArrowRight aria-hidden="true" />
        <img src={obj} alt="" />
      </span>
    </button>
  );
}

/** A one-line section that opens to reveal its contents. */
function CollapsibleSection({
  id,
  title,
  count,
  tone,
  action,
  children,
}: {
  id: string;
  title: string;
  count?: number | undefined;
  tone?: "fail";
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
      <div className="flex items-center gap-3">
        <CollapsibleTrigger
          className={`flex min-h-11 flex-1 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/70 ${
            tone === "fail"
              ? "border-fail/30 bg-fail-soft hover:border-fail/50"
              : "border-border bg-surface-raised hover:border-brand-blue/40"
          }`}
        >
          <span id={id} className="editorial-title flex items-center gap-2 text-base font-semibold">
            {tone === "fail" ? (
              <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-fail" />
            ) : null}
            {title}
            {typeof count === "number" ? (
              <span className="text-sm font-normal text-muted-foreground">({count})</span>
            ) : null}
          </span>
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            {open ? "Hide" : "Show"}
            <ChevronDown
              aria-hidden="true"
              className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </span>
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent className="mt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { organisationIds } = useOrganisations();
  const recent = useQuery(recentReportsQuery(organisationIds));
  const overdue = useQuery(orgOverdueItemsQuery(organisationIds));
  const projects = useQuery(projectsQuery(organisationIds));
  const [pickProject, setPickProject] = useState(false);

  const openCompliance = () => {
    const projectId = complianceProjectId(recent.data ?? []);
    if (projectId) {
      void navigate({
        to: "/projects/$id/compliance",
        params: { id: projectId },
        search: { type: "fire" },
      });
      return;
    }
    setPickProject(true);
  };

  const overdueItems = overdue.data ?? [];

  return (
    <AppShell>
      <section aria-labelledby="mode-heading">
        <h2 id="mode-heading" className="sr-only">
          Choose what you are making
        </h2>
        <div className="mx-auto max-w-3xl">
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                void navigate({ to: "/reports/quick", search: {} });
              }}
              className="ib-btn-3d"
            >
              <Camera aria-hidden="true" />
              Start a report
              <span className="obj">
                <ArrowRight aria-hidden="true" />
                <img src="/3d/hard-hat-t.png" alt="" />
              </span>
            </button>
            <ActionTile
              active={false}
              label="Compliance reports"
              icon={ClipboardCheck}
              obj="/3d/clipboard-t.png"
              onSelect={openCompliance}
            />
          </div>
        </div>
      </section>

      {overdueItems.length > 0 ? (
        <CollapsibleSection
          id="overdue-heading"
          title="Overdue items"
          count={overdueItems.length}
          tone="fail"
        >
          <ul className="space-y-2">
            {overdueItems.slice(0, 5).map((item) => (
              <li key={item.id}>
                <Link
                  to="/reports/$id"
                  params={{ id: item.reportId ?? "" }}
                  search={{ tab: "review" }}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-fail/25 bg-fail-soft px-4 py-3 text-sm transition-colors hover:border-fail/50"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{item.ref}</span> — {item.title}
                  </span>
                  <span className="shrink-0 font-semibold text-fail">{item.due}</span>
                </Link>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        id="recent-heading"
        title="Recent reports"
        count={recent.data?.length}
        action={
          <Link
            to="/reports"
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-brand-accent-ink"
          >
            All reports
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        }
      >
        {recent.isPending ? (
          <LoadingState label="Loading your reports…" />
        ) : recent.isError ? (
          <ErrorState
            title="Your reports could not be loaded"
            error={recent.error}
            onRetry={() => void recent.refetch()}
          />
        ) : recent.data.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No reports yet"
            description="Choose what you're making above to start your first one."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recent.data.map((report) => (
              <li key={report.id}>
                <Link
                  to="/reports/$id"
                  params={{ id: report.id }}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-surface-raised p-4 shadow-raised transition-colors hover:border-brand-blue/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate font-semibold">{report.title}</span>
                    <ReportStatusPill status={report.status} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {report.isQuick && !report.projectId ? "Custom report" : "Project report"} ·
                    Updated {report.updated}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      <Dialog open={pickProject} onOpenChange={setPickProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Which project?</DialogTitle>
            <DialogDescription>
              Weekly checks belong to a project. Choose the one you are on site for.
            </DialogDescription>
          </DialogHeader>
          {projects.isPending ? (
            <LoadingState label="Loading your projects…" />
          ) : (projects.data ?? []).length === 0 ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>You have no projects yet. Create one and the weekly checks open with it.</p>
              <Link
                to="/projects"
                onClick={() => setPickProject(false)}
                className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand-accent-ink"
              >
                Go to projects
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {(projects.data ?? []).map((project) => (
                <li key={project.id}>
                  <Link
                    to="/projects/$id/compliance"
                    params={{ id: project.id }}
                    search={{ type: "fire" }}
                    onClick={() => setPickProject(false)}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm font-semibold transition-colors hover:border-brand-accent"
                  >
                    <span className="min-w-0 truncate">{project.name}</span>
                    <span className="shrink-0 text-xs font-normal text-muted-foreground">
                      {project.reference}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
