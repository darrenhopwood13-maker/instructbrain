import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Camera, ClipboardList } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import { PlanUsageMeter } from "@/components/plan-usage-meter";
import { ReportStatusPill } from "@/components/status-pill";
import { orgOverdueItemsQuery, recentReportsQuery } from "@/lib/data";
import { usePlanUsage } from "@/lib/plans";
import { useOrganisations } from "@/lib/use-organisations";
import { systemDefinitions } from "@/lib/survey-definitions";
import { definitionLabel } from "@/lib/survey-types";

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

function ModeTile({
  active,
  label,
  sub,
  icon: Icon,
  onSelect,
}: {
  active: boolean;
  label: string;
  sub: string;
  icon: typeof ClipboardList;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`flex flex-col items-center gap-2 rounded-2xl p-2 outline-none transition-shadow focus-visible:ring-4 focus-visible:ring-brand-accent/70 ${
        active ? "ring-4 ring-brand-accent/50" : ""
      }`}
    >
      <span className="orb-tile flex h-32 w-full items-center justify-center sm:h-40">
        <Icon
          aria-hidden="true"
          className="relative size-10 text-primary-foreground drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] sm:size-14"
        />
      </span>
      <span className="text-sm font-bold leading-tight tracking-wide text-foreground sm:text-base">
        {label}
      </span>
      <span className="sr-only">{sub}</span>
    </button>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { organisationIds, organisationId } = useOrganisations();
  const usage = usePlanUsage(organisationId);
  const recent = useQuery(recentReportsQuery(organisationIds));
  const overdue = useQuery(orgOverdueItemsQuery(organisationIds));
  const [mode, setMode] = useState<Mode | null>(null);

  const chooseMode = (next: Mode) => setMode((current) => (current === next ? null : next));

  const chooseType = (surveyTypeId: string) => {
    if (mode === "quick") {
      void navigate({ to: "/reports/quick", search: { type: surveyTypeId } });
    } else if (mode === "project") {
      void navigate({ to: "/reports/new", search: { type: surveyTypeId } });
    }
  };

  return (
    <AppShell>
      <header className="pb-6">
        <p className="eyebrow">Start here</p>
        <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">
          How are you working?
        </h1>
      </header>

      <PlanUsageMeter usage={usage} className="mb-8 max-w-xl" />

      <section aria-labelledby="mode-heading">
        <h2 id="mode-heading" className="sr-only">
          Choose how you're working
        </h2>
        <div className="mx-auto grid max-w-md grid-cols-2 gap-4 sm:gap-6">
          <ModeTile
            active={mode === "project"}
            label="Project report"
            sub="Belongs to a project, with a directory and close-out"
            icon={ClipboardList}
            onSelect={() => chooseMode("project")}
          />
          <ModeTile
            active={mode === "quick"}
            label="Quick report"
            sub="A standalone report, no project setup"
            icon={Camera}
            onSelect={() => chooseMode("quick")}
          />
        </div>

        {mode ? (
          <div className="mt-8" role="radiogroup" aria-label="Survey type">
            <p className="eyebrow text-center sm:text-left">Survey type</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {systemDefinitions.map((definition) => (
                <button
                  key={definition.id}
                  type="button"
                  role="radio"
                  aria-checked={false}
                  onClick={() => chooseType(definition.id)}
                  className="min-h-16 rounded-xl border border-border bg-surface-raised p-4 text-center text-sm font-semibold shadow-raised transition-colors hover:border-brand-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/70 sm:min-h-20 sm:text-base"
                >
                  {definitionLabel(definition)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {overdue.isSuccess && overdue.data.length > 0 ? (
        <section aria-labelledby="overdue-heading" className="mt-10">
          <h2 id="overdue-heading" className="editorial-title flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle aria-hidden="true" className="size-5 text-fail" />
            Overdue items
          </h2>
          <ul className="mt-3 space-y-2">
            {overdue.data.slice(0, 5).map((item) => (
              <li key={item.id}>
                <Link
                  to="/reports/$id"
                  params={{ id: item.reportId ?? "" }}
                  search={{ tab: "review" }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-fail/25 bg-fail-soft px-4 py-3 text-sm transition-colors hover:border-fail/50"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{item.ref}</span> — {item.title}
                  </span>
                  <span className="shrink-0 font-semibold text-fail">{item.due}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="recent-heading" className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 id="recent-heading" className="editorial-title text-lg font-semibold">
            Recent reports
          </h2>
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-accent-ink"
          >
            All projects
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        <div className="mt-4">
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
              description="Choose how you're working above to start your first one."
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
                      {report.isQuick && !report.projectId ? "Quick report" : "Project report"} ·
                      Updated {report.updated}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}
