import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardList, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ReportStatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
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
import { allReportsQuery } from "@/lib/data";
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
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const list = reports.data ?? [];

  const allSelected = list.length > 0 && list.every((report) => selected.has(report.id));

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
    setSelected(allSelected ? new Set() : new Set(list.map((report) => report.id)));

  const bulk = useMutation({
    mutationFn: async () =>
      bulkDeleteReports({ data: { reportIds: [...selected] } }),
    onSuccess: async (result) => {
      toast.success(
        `${result.deleted} ${result.deleted === 1 ? "report" : "reports"} deleted.`,
      );
      setSelected(new Set());
      setConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error: Error) =>
      toast.error(error.message || "The reports could not be deleted."),
  });

  return (
    <AppShell>
      <header className="border-b border-border pb-6">
        <p className="eyebrow">Everything you have made</p>
        <h1 className="editorial-title mt-1 text-2xl font-semibold sm:text-3xl">All reports</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {reports.isSuccess
            ? `${list.length} report${list.length === 1 ? "" : "s"}, newest first. Select to delete several at once.`
            : "Every report on your account, newest first."}
        </p>
      </header>

      {selected.size > 0 ? (
        <div className="sticky top-20 z-20 mt-6 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 shadow-raised">
          <span className="text-sm font-semibold">
            {selected.size} {selected.size === 1 ? "report" : "reports"} selected
          </span>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="quiet" className="min-h-11 text-fail hover:text-fail">
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
                  Each one is permanently deleted with every finding, photograph, issued version
                  and share link. Any completed registers attached to them are archived as
                  evidence first. This cannot be undone.
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
        ) : (
          <>
            <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                aria-label="Select all reports"
                checked={allSelected}
                onChange={toggleAll}
                className="size-4 accent-brand-blue"
              />
              Select all on this page
            </label>
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((report) => (
                <li key={report.id}>
                  <Link
                    to="/reports/$id"
                    params={{ id: report.id }}
                    className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface-raised p-4 shadow-raised transition-colors hover:border-brand-blue/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${report.title}`}
                          checked={selected.has(report.id)}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onChange={() => toggle(report.id)}
                          className="size-4 shrink-0 accent-brand-blue"
                        />
                        <span className="truncate font-semibold">{report.title}</span>
                      </span>
                      <ReportStatusPill status={report.status} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {report.isQuick && !report.projectId ? "Custom report" : "Project report"} ·{" "}
                      {report.reference} · Updated {report.updated}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </AppShell>
  );
}
