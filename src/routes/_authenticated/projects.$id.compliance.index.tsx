import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, ChevronDown, ChevronRight, Lock, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import { PackDownloadButton } from "@/components/compliance/pack-download";
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
} from "@/lib/compliance/compliance-data";
import {
  buildRegister,
  isActionOverdue,
  registerWeeks,
  type CellState,
} from "@/lib/compliance/register";

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

const cellClass: Record<CellState, string> = {
  compliant: "border-[hsl(var(--status-pass))] text-[hsl(var(--status-pass))]",
  non_compliant: "border-[hsl(var(--status-fail))] text-[hsl(var(--status-fail))]",
  not_applicable: "border-border text-muted-foreground",
  not_checked: "border-dashed border-border text-muted-foreground",
};

const shortLabel: Record<CellState, string> = {
  compliant: "Compliant",
  non_compliant: "Non-compliant",
  not_applicable: "N/A",
  not_checked: "Not checked",
};

function weekLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function fullDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

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

  const shown = useMemo(() => registerWeeks(runs.data ?? []), [runs.data]);
  const entries = useQuery(complianceEntriesQuery(shown.map((run) => run.id)));

  const definition = checkType(type);

  const model = useMemo(
    () =>
      buildRegister({
        checkTypeId: type,
        runs: runs.data ?? [],
        points: points.data ?? [],
        entries: entries.data ?? [],
        actions: actions.data ?? [],
      }),
    [type, runs.data, points.data, entries.data, actions.data],
  );

  const openActions = (actions.data ?? []).filter((action) => action.status !== "closed");

  const [actionsOpen, setActionsOpen] = useState(false);
  const [weeksOpen, setWeeksOpen] = useState(true);
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

  return (
    <AppShell surface="light">
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
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button className="w-full sm:w-auto" onClick={() => setOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              Start this week&rsquo;s check
            </Button>
            {shown.length > 0 ? (
              <PackDownloadButton
                projectId={id}
                checkType={type}
                label={`Download ${model.weeks.length}-week pack`}
                className="w-full sm:w-auto"
              />
            ) : null}
          </div>

          {/* Open items — one line until opened */}
          <section aria-labelledby="actions-heading" className="mt-6">
            <button
              type="button"
              onClick={() => setActionsOpen((value) => !value)}
              aria-expanded={actionsOpen}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left"
            >
              <span id="actions-heading" className="text-sm font-semibold">
                {model.actions.open} open action(s)
                {model.actions.overdue > 0 ? ` · ${model.actions.overdue} overdue` : ""}
                {model.actions.oldestOpenedOn
                  ? ` · oldest opened ${fullDate(model.actions.oldestOpenedOn)}`
                  : ""}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`size-4 shrink-0 transition-transform ${actionsOpen ? "rotate-180" : ""}`}
              />
            </button>
            {actionsOpen ? (
              openActions.length === 0 ? (
                <p className="mt-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                  Nothing open. Every action raised so far has been closed out.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {openActions.map((action) => (
                    <li
                      key={action.id}
                      className="rounded-lg border border-border bg-card p-4 text-sm"
                    >
                      <p className="font-medium">{action.description}</p>
                      <p className="mt-1 text-muted-foreground">
                        Owner: {action.owner || "unassigned"} · Opened {fullDate(action.openedOn)}
                        {action.targetDate ? ` · Due ${fullDate(action.targetDate)}` : ""} ·{" "}
                        {action.status === "in_progress" ? "In progress" : "Open"}
                        {isActionOverdue(action) ? (
                          <span className="ml-2 font-semibold text-[hsl(var(--status-fail))]">
                            Overdue
                          </span>
                        ) : null}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </section>

          {/* The register */}
          <section aria-labelledby="register-heading" className="mt-8">
            <h2 id="register-heading" className="text-lg font-semibold">
              The register — last {model.weeks.length || REGISTER_WINDOW_WEEKS} weeks
            </h2>
            {model.rows.length === 0 || model.weeks.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={CalendarCheck}
                  title="No checks recorded yet"
                  description="Start this week's check to begin the register. Each week you complete becomes part of the six-week window."
                />
              </div>
            ) : (
              <>
                {/* Wide screens: a real grid */}
                <div className="mt-4 hidden overflow-hidden rounded-lg border border-border lg:block">
                  <table className="w-full table-fixed text-left text-sm">
                    <caption className="sr-only">
                      Every point down the side, every week across the top.
                    </caption>
                    <thead className="bg-card">
                      <tr>
                        <th scope="col" className="w-56 p-3 font-semibold">
                          Point
                        </th>
                        {model.weeks.map((week) => (
                          <th key={week.run.id} scope="col" className="p-3 font-semibold">
                            {weekLabel(week.run.checkDate)}
                            <span className="mt-1 block text-xs font-normal text-muted-foreground">
                              {week.checked} checked · {week.nonCompliant} non-compliant
                              {week.photosMissing > 0
                                ? ` · ${week.photosMissing} photo(s) missing`
                                : ""}
                              <br />
                              {week.locked ? "Completed" : "In progress"}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {model.rows.map((row) => (
                        <tr key={row.point.id} className="border-t border-border align-top">
                          <th scope="row" className="p-3 font-medium">
                            {row.point.location}
                            <span className="block text-xs font-normal text-muted-foreground">
                              {row.point.unitRef}
                              {row.point.unitType ? ` · ${row.point.unitType}` : ""}
                              {row.point.state === "decommissioned" ? " · Decommissioned" : ""}
                            </span>
                          </th>
                          {row.cells.map((cell, index) => (
                            <td key={`${row.point.id}-${index}`} className="p-3">
                              <span
                                className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${cellClass[cell.state]}`}
                              >
                                {shortLabel[cell.state]}
                              </span>
                              {cell.photoMissing ? (
                                <span className="mt-1 block text-xs text-[hsl(var(--status-fail))]">
                                  Photograph missing
                                </span>
                              ) : null}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Phones: one card per point, its weeks inside */}
                <ul className="mt-4 space-y-3 lg:hidden">
                  {model.rows.map((row) => (
                    <li key={row.point.id} className="rounded-lg border border-border bg-card p-4">
                      <p className="font-medium">{row.point.location}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.point.unitRef}
                        {row.point.unitType ? ` · ${row.point.unitType}` : ""}
                        {row.point.state === "decommissioned" ? " · Decommissioned" : ""}
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {row.cells.map((cell, index) => (
                          <li
                            key={`${row.point.id}-m-${index}`}
                            className="flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="text-muted-foreground">
                              {weekLabel(model.weeks[index]?.run.checkDate ?? "")}
                            </span>
                            <span
                              className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${cellClass[cell.state]}`}
                            >
                              {shortLabel[cell.state]}
                              {cell.photoMissing ? " · no photo" : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Weeks, collapsible */}
          <section aria-labelledby="weeks-heading" className="mt-8">
            <button
              type="button"
              onClick={() => setWeeksOpen((value) => !value)}
              aria-expanded={weeksOpen}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left"
            >
              <span id="weeks-heading" className="text-sm font-semibold">
                The weeks themselves ({model.weeks.length})
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`size-4 shrink-0 transition-transform ${weeksOpen ? "rotate-180" : ""}`}
              />
            </button>
            {weeksOpen ? (
              <ul className="mt-2 space-y-3">
                {[...model.weeks].reverse().map((week) => (
                  <li key={week.run.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{fullDate(week.run.checkDate)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {week.checked} point(s) checked · {week.nonCompliant} non-compliant ·{" "}
                          {week.photosMissing} photograph(s) missing ·{" "}
                          {week.run.performedByName || "not yet signed"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {week.locked ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Lock aria-hidden="true" className="size-3.5" />
                            Completed
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">In progress</span>
                        )}
                        <PackDownloadButton
                          projectId={id}
                          checkType={type}
                          runId={week.run.id}
                          label="Download pack"
                        />
                        <Button asChild variant="outline">
                          <Link
                            to="/projects/$id/compliance/$runId"
                            params={{ id, runId: week.run.id }}
                          >
                            {week.locked ? "View" : "Continue"}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
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
