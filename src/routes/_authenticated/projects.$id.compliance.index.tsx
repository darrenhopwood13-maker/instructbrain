import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, ChevronRight, Lock, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { projectQuery } from "@/lib/data";
import { useOrganisations } from "@/lib/use-organisations";
import { CHECK_TYPES, REGISTER_WINDOW_WEEKS, checkType } from "@/lib/compliance/checks";
import {
  complianceActionsQuery,
  complianceEntriesQuery,
  compliancePointsQuery,
  complianceRunsQuery,
  startRun,
  statusForEntry,
  windowRuns,
} from "@/lib/compliance/compliance-data";

export const Route = createFileRoute("/_authenticated/projects/$id/compliance/")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: typeof search["type"] === "string" ? search["type"] : "fire",
  }),
  head: () => {
    const title = "Weekly compliance register — instructBrain";
    const description =
      "The last six weeks of site checks, photo-evidenced and dated, with every open action and its close-out.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ComplianceRegister,
});

function ComplianceRegister() {
  const { id } = Route.useParams();
  const { type } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisationId, userId } = useOrganisations();

  const project = useQuery(projectQuery(id));
  const runs = useQuery(complianceRunsQuery(id, type));
  const points = useQuery(compliancePointsQuery(id, type));
  const actions = useQuery(complianceActionsQuery(id));

  const shown = useMemo(() => windowRuns(runs.data ?? []), [runs.data]);
  const entries = useQuery(complianceEntriesQuery(shown.map((run) => run.id)));

  const definition = checkType(type);
  const openActions = (actions.data ?? []).filter((action) => action.status !== "closed");

  const [open, setOpen] = useState(false);
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [performedBy, setPerformedBy] = useState("");
  const [competent, setCompetent] = useState("");
  const [reportNumber, setReportNumber] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!organisationId) throw new Error("You are not a member of an organisation yet.");
      return startRun({
        organisationId,
        projectId: id,
        checkType: type,
        checkDate,
        siteReference: project.data?.reference ?? null,
        reportNumber: reportNumber.trim() || null,
        performedByName: performedBy.trim() || null,
        competentPerson: definition.requiresCompetentPerson ? competent.trim() || null : null,
        authorId: userId,
      });
    },
    onSuccess: async (run) => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["compliance"] });
      navigate({
        to: "/projects/$id/compliance/$runId",
        params: { id, runId: run.id },
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (project.isPending || runs.isPending) return <LoadingState label="Loading the register" />;
  if (project.error)
    return <ErrorState title="Could not load the register" error={project.error} />;

  const pointById = new Map((points.data ?? []).map((point) => [point.id, point]));

  return (
    <AppShell>
      <nav aria-label="Breadcrumb" className="pb-4 text-sm">
        <Link to="/projects" className="font-medium text-muted-foreground hover:text-foreground">
          Projects
        </Link>
        <ChevronRight aria-hidden="true" className="mx-1 inline size-3.5 text-muted-foreground" />
        <Link
          to="/projects/$id"
          params={{ id }}
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          {project.data?.reference || project.data?.name}
        </Link>
        <ChevronRight aria-hidden="true" className="mx-1 inline size-3.5 text-muted-foreground" />
        <span className="text-foreground">Weekly compliance register</span>
      </nav>

      <header className="border-b border-border pb-6">
        <p className="eyebrow">Weekly compliance register</p>
        <h1 className="editorial-title mt-1.5 text-2xl font-semibold sm:text-3xl">
          {definition.label} checks
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The last {REGISTER_WINDOW_WEEKS} weeks on this site, each week photo-evidenced and dated,
          with every action carried until it is closed.
        </p>
      </header>

      <nav aria-label="Check type" className="mt-6 flex flex-wrap gap-2">
        {CHECK_TYPES.map((item) => (
          <Link
            key={item.id}
            to="/projects/$id/compliance"
            params={{ id }}
            search={{ type: item.id }}
            className={`min-h-11 rounded-md border px-3 py-2 text-sm font-medium ${
              item.id === type
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            aria-current={item.id === type ? "page" : undefined}
          >
            {item.label}
            {!item.live ? (
              <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                Not yet in use
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {!definition.live ? (
        <div className="mt-8">
          <EmptyState
            icon={CalendarCheck}
            title={`${definition.label} checks are named and reserved`}
            description={definition.blurb}
          />
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={() => setOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              Start this week&rsquo;s check
            </Button>
            <p className="text-sm text-muted-foreground">
              A new check starts from last week&rsquo;s points, so nothing is retyped.
            </p>
          </div>

          <section aria-labelledby="window-heading" className="mt-8">
            <h2 id="window-heading" className="text-lg font-semibold">
              Last {REGISTER_WINDOW_WEEKS} weeks
            </h2>
            {shown.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={CalendarCheck}
                  title="No checks recorded yet"
                  description="Start this week's check to begin the register. Each week you complete becomes part of the six-week window."
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {shown.map((run) => {
                  const runEntries = (entries.data ?? []).filter(
                    (entry) => entry.runId === run.id,
                  );
                  const failing = runEntries.filter(
                    (entry) =>
                      statusForEntry(type, pointById.get(entry.pointId), entry) === "non_compliant",
                  );
                  return (
                    <li key={run.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {new Date(run.checkDate).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {runEntries.length} point(s) checked · {failing.length} non-compliant ·{" "}
                            {run.performedByName || "not yet signed"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {run.lockedAt ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Lock aria-hidden="true" className="size-3.5" />
                              Completed
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">In progress</span>
                          )}
                          <Button asChild variant="outline">
                            <Link
                              to="/projects/$id/compliance/$runId"
                              params={{ id, runId: run.id }}
                            >
                              {run.lockedAt ? "View" : "Continue"}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="actions-heading" className="mt-10">
            <h2 id="actions-heading" className="text-lg font-semibold">
              Open actions on this site
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              An action belongs to the site, not to the week it was raised. It stays visible until
              someone closes it.
            </p>
            {openActions.length === 0 ? (
              <p className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Nothing open. Every action raised so far has been closed out.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {openActions.map((action) => (
                  <li
                    key={action.id}
                    className="rounded-lg border border-border bg-card p-4 text-sm"
                  >
                    <p className="font-medium">{action.description}</p>
                    <p className="mt-1 text-muted-foreground">
                      Owner: {action.owner || "unassigned"} · Opened {action.openedOn}
                      {action.targetDate ? ` · Due ${action.targetDate}` : ""} ·{" "}
                      {action.status === "in_progress" ? "In progress" : "Open"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start this week&rsquo;s {definition.label.toLowerCase()} check</DialogTitle>
            <DialogDescription>
              Last week&rsquo;s points are carried in automatically. Confirm or amend each one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="check-date">Check date</Label>
              <Input
                id="check-date"
                type="date"
                value={checkDate}
                onChange={(event) => setCheckDate(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="performed-by">Performed by</Label>
              <Input
                id="performed-by"
                value={performedBy}
                onChange={(event) => setPerformedBy(event.target.value)}
                placeholder="Full name"
              />
            </div>
            {definition.requiresCompetentPerson ? (
              <div>
                <Label htmlFor="competent">Competent person</Label>
                <Input
                  id="competent"
                  value={competent}
                  onChange={(event) => setCompetent(event.target.value)}
                />
              </div>
            ) : null}
            <div>
              <Label htmlFor="report-number">Report number</Label>
              <Input
                id="report-number"
                value={reportNumber}
                onChange={(event) => setReportNumber(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Starting…" : "Start check"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
