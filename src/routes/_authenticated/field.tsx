import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Camera, Loader2, Monitor, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { InstallBar } from "@/components/field/install-bar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ReportStatusPill } from "@/components/status-pill";
import { recentReportsQuery } from "@/lib/data";
import { sendReportToDashboard } from "@/lib/field/handoff";
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
  const queryClient = useQueryClient();
  const { organisationIds } = useOrganisations();
  const reports = useQuery(recentReportsQuery(organisationIds));
  const [sending, setSending] = useState<{ id: string; title: string } | null>(null);

  const open = (reports.data ?? []).filter((report) => report.status !== "issued").slice(0, 4);

  const send = useMutation({
    mutationFn: (reportId: string) => sendReportToDashboard(reportId),
    onSuccess: async () => {
      setSending(null);
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Sent to the dashboard", {
        description: "It is in the site queue. Anything still unresolved is listed there.",
      });
    },
    onError: (error) =>
      toast.error("It could not be sent", {
        description:
          error instanceof Error
            ? error.message
            : "Check your signal and try again — nothing has been lost.",
      }),
  });

  return (
    <AppShell surface="light">
      <InstallBar />

      <h1 className="editorial-title text-2xl font-semibold">On site</h1>
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

                <Button
                  type="button"
                  variant="quiet"
                  className="mt-3 min-h-11 w-full"
                  onClick={() => setSending({ id: report.id, title: report.title })}
                >
                  <Send aria-hidden="true" className="mr-1.5 size-4" />
                  Send to the dashboard
                </Button>
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

      <Dialog open={sending !== null} onOpenChange={(next) => (next ? null : setSending(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this to the dashboard?</DialogTitle>
            <DialogDescription>
              {sending?.title} goes into the site queue for review. Nothing is emailed to anyone,
              and nothing is issued — a person still confirms every finding before the report
              leaves the office.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Photographs still uploading will finish on their own. You can keep adding to the report
            afterwards.
          </p>
          <DialogFooter>
            <Button variant="quiet" className="min-h-11" onClick={() => setSending(null)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              className="min-h-11"
              disabled={send.isPending}
              onClick={() => sending && send.mutate(sending.id)}
            >
              {send.isPending ? (
                <Loader2 aria-hidden="true" className="mr-1.5 size-4 animate-spin" />
              ) : null}
              Send to the dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
