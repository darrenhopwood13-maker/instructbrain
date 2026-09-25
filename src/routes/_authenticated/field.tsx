import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Camera, Monitor } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { InstallBar } from "@/components/field/install-bar";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ReportStatusPill } from "@/components/status-pill";
import { recentReportsQuery } from "@/lib/data";
import { useOrganisations } from "@/lib/use-organisations";

export const Route = createFileRoute("/_authenticated/field")({
  head: () => ({
    meta: [
      { title: "Field app — instructBrain" },
      {
        name: "description",
        content: "Capture site photographs and send the finished report to the dashboard.",
      },
      { property: "og:title", content: "instructBrain field app" },
      {
        property: "og:description",
        content: "Photograph the site, then send the report to the dashboard.",
      },
    ],
  }),
  component: FieldCockpit,
});

function FieldCockpit() {
  const navigate = useNavigate();
  const { organisationIds } = useOrganisations();
  const reports = useQuery(recentReportsQuery(organisationIds));

  const open = (reports.data ?? []).filter((report) => report.status !== "issued").slice(0, 4);

  return (
    <AppShell surface="light">
      <InstallBar />

      <h1 className="editorial-title text-2xl font-semibold sm:text-3xl">On site</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Photograph as you go. Everything saves as you work.
      </p>

      <button
        type="button"
        onClick={() => void navigate({ to: "/reports/quick", search: {} })}
        className="mt-5 flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl bg-brand-accent px-5 text-lg font-semibold text-primary-foreground shadow-raised transition-transform active:scale-[0.99]"
      >
        <Camera aria-hidden="true" className="size-6" />
        Start a report
      </button>

      <section aria-labelledby="open-heading" className="mt-8">
        <h2 id="open-heading" className="eyebrow">
          Carry on where you left off
        </h2>

        {reports.isPending ? (
          <LoadingState label="Loading your reports…" />
        ) : reports.isError ? (
          <ErrorState
            title="Your reports could not be loaded"
            error={reports.error}
            onRetry={() => void reports.refetch()}
          />
        ) : open.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing open. Start a report above and take your first photograph.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {open.map((report) => (
              <li
                key={report.id}
                className="rounded-2xl border border-border bg-surface-raised p-4 shadow-raised"
              >
                <Link
                  to="/reports/$id"
                  params={{ id: report.id }}
                  className="flex min-h-11 items-start justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{report.title}</span>
                    <span className="text-xs text-muted-foreground">
                      Updated {report.updated}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <ReportStatusPill status={report.status} />
                    <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
                  </span>
                </Link>

              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Monitor aria-hidden="true" className="size-4 shrink-0" />
        <Link to="/dashboard" className="font-semibold text-brand-accent-ink">
          Open the full dashboard
        </Link>
      </p>
    </AppShell>
  );
}
