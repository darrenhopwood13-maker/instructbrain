import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ClipboardList, Search, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ReportStatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { allReportsQuery, projectsQuery } from "@/lib/data";
import { reportStacks, stackSummary } from "@/lib/reports/report-stacks";
import {
  NO_FILTERS,
  countActiveFilters,
  filterReports,
  filtersAreActive,
  periodLabels,
  surveyOptions,
  type ReportFilters,
} from "@/lib/reports/filter";
import { reportStatusLabels, type ReportStatus } from "@/lib/types";
import { useOrganisations } from "@/lib/use-organisations";
import { bulkDeleteReports } from "@/lib/delete.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => {
    const title = "All reports — instructBrain";
    const description =
      "Every report on your account, project and quick alike, newest first, with its status and the date it was last worked on.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: AllReports,
});

function AllReports() {
  const { organisationIds } = useOrganisations();
  const reports = useQuery(allReportsQuery(organisationIds));
  const projects = useQuery(projectsQuery(organisationIds));
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>(NO_FILTERS);
  const list = reports.data ?? [];

  const projectNameById = useMemo(
    () => new Map((projects.data ?? []).map((project) => [project.id, project.name])),
    [projects.data],
  );

  /* Narrow first, group second: the stacks are a view of what is left, so a type with
     nothing in it disappears rather than sitting there as an empty heading. */
  const visible = useMemo(
    () => filterReports(list, filters, { projectNameById }),
    [list, filters, projectNameById],
  );
  const filtering = filtersAreActive(filters);
  const activeCount = countActiveFilters(filters);

  /* One stack per report type, newest type first, so the page reads as a few
     headings rather than one long wall of reports. */
  const stacks = useMemo(() => reportStacks(visible), [visible]);

  /* Which stacks are open. Null means nobody has touched them yet, in which case
     the newest type is already open - landing on a page of closed lids tells you
     nothing about what you have. While filtering, everything that matched is open:
     the point of a filter is to see the results, not to hunt for them behind lids. */
  const [openStacks, setOpenStacks] = useState<string[] | null>(null);
  const defaultOpenKeys = filtering ? stacks.map((stack) => stack.key) : stacks[0] ? [stacks[0].key] : [];
  const openKeys = openStacks === null ? defaultOpenKeys : openStacks.filter((key) => stacks.some((stack) => stack.key === key));
  const toggleStack = (key: string) =>
    setOpenStacks(() => {
      const base = new Set(openKeys);
      if (base.has(key)) {
        base.delete(key);
      } else {
        base.add(key);
      }
      return [...base];
    });
  const allOpen = stacks.length > 0 && stacks.every((stack) => openKeys.includes(stack.key));

  /* Any change to a filter re-opens the matching stacks and drops anything selected
     that is no longer on screen, so a delete can never reach a report the person
     cannot see. */
  const change = (next: Partial<ReportFilters>) => {
    setOpenStacks(null);
    setSelected((current) => {
      const shown = new Set(
        filterReports(list, { ...filters, ...next }, { projectNameById }).map((report) => report.id),
      );
      return new Set([...current].filter((id) => shown.has(id)));
    });
    setFilters((current) => ({ ...current, ...next }));
  };
  const resetFilters = () => {
    setOpenStacks(null);
    setFilters(NO_FILTERS);
  };

  const allSelected = visible.length > 0 && visible.every((report) => selected.has(report.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(visible.map((report) => report.id)));

  const bulk = useMutation({
    mutationFn: async () => bulkDeleteReports({ data: { reportIds: [...selected] } }),
    onSuccess: async (result) => {
      toast.success(`${result.deleted} ${result.deleted === 1 ? "report" : "reports"} deleted.`);
      setSelected(new Set());
      setConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error: Error) => toast.error(error.message || "The reports could not be deleted."),
  });

  return (
    <AppShell>
      <header className="border-b border-border pb-6">
        <div className="grid min-w-0 gap-4 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-start">
          <div className="min-w-0">
            <p className="eyebrow">Everything you have made</p>
            <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">All reports</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {reports.isSuccess
                ? filtering
                  ? `${visible.length} of ${list.length} report${list.length === 1 ? "" : "s"} match${visible.length === 1 ? "es" : ""} your filter${activeCount === 1 ? "" : "s"}. Clear ${activeCount === 1 ? "it" : "them"} to see everything again.`
                  : `${list.length} report${list.length === 1 ? "" : "s"} in ${stacks.length} report type${stacks.length === 1 ? "" : "s"}, newest type first. Open a stack to see what is in it, or select reports to delete.`
                : "Every report on your account, grouped by report type, newest type first."}
            </p>
          </div>
          {/* The list of reports is where a person looks for one; starting one
              belongs in the same place rather than back on the dashboard. */}
          <Button asChild variant="brand" className="shrink-0">
            <Link to="/reports/quick">New report</Link>
          </Button>
        </div>
      </header>

      {/* The filter bar sits where the eye lands after the count, and it stays visible:
          a person narrowing a list needs to see what is doing the narrowing and be able
          to undo it in one tap. Search first, then the four cross-cuts, then clear. */}
      <section
        aria-label="Filter reports"
        className="mt-6 rounded-xl border border-border bg-surface-raised p-3 shadow-raised sm:p-4"
      >
        <div className="grid min-w-0 gap-2 min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:items-center">
          <div className="relative min-w-0">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={filters.search}
              onChange={(event) => change({ search: event.target.value })}
              placeholder="Search title, reference, project or type"
              aria-label="Search reports"
              className="h-11 pl-9"
            />
          </div>
          <div className="flex min-w-0 items-center justify-between gap-2 min-[560px]:justify-end">
            <span aria-live="polite" className="text-xs font-semibold text-muted-foreground">
              {reports.isSuccess ? `${visible.length} shown` : "—"}
            </span>
            <Button
              variant="quiet"
              className="min-h-11"
              onClick={resetFilters}
              disabled={!filtering}
            >
              <X aria-hidden="true" className="size-4" />
              Clear{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
          </div>
        </div>

        <div className="mt-2 grid min-w-0 gap-2 min-[420px]:grid-cols-2 min-[820px]:grid-cols-4">
          <Select
            value={filters.status}
            onValueChange={(value) => change({ status: value as ReportStatus | "all" })}
          >
            <SelectTrigger className="h-11 w-full" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              {(Object.keys(reportStatusLabels) as ReportStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {reportStatusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.survey} onValueChange={(value) => change({ survey: value })}>
            <SelectTrigger className="h-11 w-full" aria-label="Filter by report type">
              <SelectValue placeholder="Report type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any report type</SelectItem>
              {surveyOptions(list).map((option) => (
                <SelectItem key={option.value || "__none"} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.project} onValueChange={(value) => change({ project: value })}>
            <SelectTrigger className="h-11 w-full" aria-label="Filter by project">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any project</SelectItem>
              <SelectItem value="none">Not on a project</SelectItem>
              {(projects.data ?? []).map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.period}
            onValueChange={(value) => change({ period: value as ReportFilters["period"] })}
          >
            <SelectTrigger className="h-11 w-full" aria-label="Filter by when it was last worked on">
              <SelectValue placeholder="Any time" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(periodLabels) as Array<ReportFilters["period"]>).map((period) => (
                <SelectItem key={period} value={period}>
                  {periodLabels[period]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {selected.size > 0 ? (
        <div className="sticky top-20 z-20 mt-6 grid min-w-0 gap-2 rounded-xl border border-border bg-surface-raised px-3 py-3 shadow-raised min-[360px]:grid-cols-[minmax(0,1fr)_auto] min-[360px]:items-center min-[360px]:gap-3 min-[360px]:px-4">
          <span className="min-w-0 text-sm font-semibold">
            {selected.size} {selected.size === 1 ? "report" : "reports"} selected
          </span>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="quiet"
                className="min-h-11 w-full justify-center text-fail hover:text-fail min-[360px]:w-auto"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Delete selected
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Delete {selected.size} {selected.size === 1 ? "report" : "reports"}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Each one is permanently deleted with every finding, photograph, published version
                  and share link. Any completed registers attached to them are archived as evidence
                  first. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-11">Keep them</AlertDialogCancel>
                <AlertDialogAction
                  className="min-h-11 bg-fail text-white hover:bg-fail/90"
                  onClick={() => bulk.mutate()}
                  disabled={bulk.isPending}
                >
                  {bulk.isPending ? "Deleting…" : "Delete permanently"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}

      <div className="mt-6">
        {reports.isPending ? (
          <LoadingState label="Loading your reports…" />
        ) : reports.isError ? (
          <ErrorState
            title="Your reports could not be loaded"
            error={reports.error}
            onRetry={() => void reports.refetch()}
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            eyebrow="Nothing here yet"
            title="No reports yet"
            description="Start one from the dashboard and it will appear here."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Search}
            eyebrow="Nothing matches"
            title="No reports match those filters"
            description="Try a broader search, a different report type, or clear the filters to see everything again."
            action={
              <Button variant="brand" className="min-h-11" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <label className="grid min-h-11 w-fit cursor-pointer grid-cols-[2.75rem_minmax(0,1fr)] items-center text-sm text-muted-foreground hover:text-foreground">
                <span className="grid size-11 place-items-center">
                  <input
                    type="checkbox"
                    aria-label="Select all reports"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="size-5 accent-brand-blue"
                  />
                </span>
                Select all {visible.length} report{visible.length === 1 ? "" : "s"}
              </label>
              <Button
                variant="quiet"
                className="min-h-11"
                onClick={() => setOpenStacks(allOpen ? [] : stacks.map((stack) => stack.key))}
              >
                {allOpen ? "Close every stack" : "Open every stack"}
              </Button>
            </div>
            <ul className="grid gap-3">
              {stacks.map((stack) => {
                const open = openKeys.includes(stack.key);
                return (
                  <li
                    key={stack.key}
                    className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface-raised shadow-raised"
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => toggleStack(stack.key)}
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-surface"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{stack.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {stackSummary(stack)}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-semibold">
                        {open ? "Hide" : "Open"}
                      </span>
                    </button>
                    {open ? (
                      <ul className="grid gap-2 border-t border-border p-2 sm:grid-cols-2 sm:p-3">
                        {stack.reports.map((report) => (
                          <li key={report.id} className="min-w-0">
                            <div className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-surface-raised p-2 shadow-raised transition-colors hover:border-brand-blue/40 sm:p-3">
                              <label className="grid size-11 cursor-pointer place-items-center self-start">
                                <span className="sr-only">Select {report.title}</span>
                                <input
                                  type="checkbox"
                                  aria-label={`Select ${report.title}`}
                                  checked={selected.has(report.id)}
                                  onChange={() => toggle(report.id)}
                                  className="size-5 accent-brand-blue"
                                />
                              </label>
                              <Link
                                to="/reports/$id"
                                params={{ id: report.id }}
                                className="flex min-w-0 flex-col gap-2 px-1 py-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-accent/70"
                              >
                                <div className="grid min-w-0 gap-2 min-[420px]:grid-cols-[minmax(0,1fr)_auto] min-[420px]:items-start">
                                  <span className="line-clamp-2 min-w-0 break-words font-semibold leading-snug">
                                    {report.title}
                                  </span>
                                  <span className="w-fit shrink-0">
                                    <ReportStatusPill status={report.status} />
                                  </span>
                                </div>
                                <span className="flex min-w-0 flex-col gap-0.5 break-words text-xs leading-relaxed text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-1">
                                  <span>
                                    {report.projectId
                                      ? (projectNameById.get(report.projectId) ?? "Project report")
                                      : report.isQuick
                                        ? "Custom report"
                                        : "Not on a project"}
                                  </span>
                                  {/* Only where the account spans more than one organisation:
                                      that is the only case where the same reference can
                                      appear twice, and the name is what explains it. */}
                                  {organisationIds.length > 1 && report.organisationName ? (
                                    <>
                                      <span className="hidden sm:inline" aria-hidden="true">
                                        ·
                                      </span>
                                      <span>{report.organisationName}</span>
                                    </>
                                  ) : null}
                                  <span className="hidden sm:inline" aria-hidden="true">
                                    ·
                                  </span>
                                  <span>
                                    <span className="font-medium text-foreground/80">
                                      Reference:
                                    </span>{" "}
                                    {report.reference || "None"}
                                  </span>
                                  <span className="hidden sm:inline" aria-hidden="true">
                                    ·
                                  </span>
                                  <span>
                                    <span className="font-medium text-foreground/80">Updated:</span>{" "}
                                    {report.updated}
                                  </span>
                                </span>
                              </Link>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  );
}
