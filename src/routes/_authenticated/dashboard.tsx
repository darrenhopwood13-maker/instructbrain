import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Camera, ClipboardCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ErrorState, LoadingState } from "@/components/query-states";
import { FieldAppCard } from "@/components/field/field-app-card";
import { SiteQueue } from "@/components/field/site-queue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { projectsQuery, recentReportsQuery } from "@/lib/data";
import { SiteConditions } from "@/components/dashboard/site-conditions";
import { ItemMapPanel } from "@/components/dashboard/item-map";
import { LedgerBand } from "@/components/dashboard/ledger-band";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { complianceProjectId } from "@/lib/compliance/destination";
import { useOrganisations } from "@/lib/use-organisations";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — instructBrain" },
      { name: "description", content: "Start a report, or pick up an open one." },
    ],
  }),
  component: Dashboard,
});

/**
 * The two things someone comes to this screen to do.
 *
 * These are the biggest thing on the page on purpose. They sat below the queue in
 * a 768px column, and once the item map arrived they read as decoration rather
 * than the way in — which is the wrong way round: every other panel here is
 * something you read, and these two are the things you do.
 */
function ActionTile({
  label,
  icon: Icon,
  obj,
  className,
  onSelect,
}: {
  label: string;
  icon: typeof ClipboardCheck;
  obj: string;
  className: string;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className={className}>
      <Icon aria-hidden="true" />
      {label}
      <span className="obj">
        <ArrowRight aria-hidden="true" />
        <img src={obj} alt="" />
      </span>
    </button>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { organisationIds } = useOrganisations();
  // Only used to work out which project the weekly checks should open on; the
  // list of recent reports itself now lives behind the Reports tab.
  const recent = useQuery(recentReportsQuery(organisationIds));
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

  return (
    <AppShell>
      {/* The way in, first. Nothing may come above these. */}
      <section aria-labelledby="mode-heading">
        <h2 id="mode-heading" className="sr-only">
          Choose what you are making
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              void navigate({ to: "/reports/quick", search: {} });
            }}
            className="ib-btn-3d dash-cta primary"
          >
            <Camera aria-hidden="true" />
            Start a report
            <span className="obj">
              <ArrowRight aria-hidden="true" />
              <img src="/3d/hard-hat-t.png" alt="" />
            </span>
          </button>
          <ActionTile
            label="Compliance reports"
            icon={ClipboardCheck}
            obj="/3d/clipboard-t.png"
            className="ib-btn-3d dash-cta"
            onSelect={openCompliance}
          />
        </div>
      </section>

      {/* What came in from site: the first thing to read, once you know where the
          two buttons are. */}
      <SiteQueue organisationIds={organisationIds} />

      {/* The map and the reading under it. The overdue list that used to sit here
          was removed on Dal's instruction - the map shows every late item as a red
          square, and the ledger below reports the count and lists them in order,
          so the section was a third copy of the same fact. */}
      <ItemMapPanel organisationIds={organisationIds} />
      <LedgerBand organisationIds={organisationIds} />

      {/* What has changed, directly under the state of things: the map says where
          the weight is, this says what has moved. */}
      <ActivityFeed organisationIds={organisationIds} />

      {/* Ambient, not daily work: the wind sits above the setup card. */}
      <SiteConditions organisationIds={organisationIds} />

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
      {/* Setup, not daily work: the QR card lives at the foot. */}
      <FieldAppCard />
    </AppShell>
  );
}
