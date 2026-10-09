import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Camera, Lock, Monitor } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { InstallBar } from "@/components/field/install-bar";
import { FieldCockpitView } from "@/components/field/field-cockpit-view";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ReportStatusPill } from "@/components/status-pill";
import { TemplateSelect } from "@/components/template-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { createReport, projectsQuery, recentReportsQuery, reportQuery } from "@/lib/data";
import { useOrganisations } from "@/lib/use-organisations";
import { snapshotOf, systemDefinitions } from "@/lib/survey-definitions";
import { definitionLabel } from "@/lib/survey-types";
import { describeStartFailure, withNetworkRetry } from "@/lib/network-error";
import { DEFAULT_TONE_ID, type ReportBrief } from "@/lib/report/brief";

type FieldSearch = { report?: string | undefined };

// The path stays /field: it is the payload of the dashboard QR code.
export const Route = createFileRoute("/_authenticated/field")({
  validateSearch: (search: Record<string, unknown>): FieldSearch => ({
    report: typeof search["report"] === "string" ? search["report"] : undefined,
  }),
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      // The field app owns its own manifest AND its own home-screen icon. They
      // used to be declared in the root, which meant EVERY page advertised
      // start_url "/field" and the brain icon - so a home-screen icon made from
      // any other page opened the field cockpit. A document with two manifest
      // (or apple-touch-icon) links uses the first, so this could not be fixed
      // by adding a second one further down: the root had to stop declaring one.
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icons/instructbrain-512.png" },
    ],
  }),
  component: FieldCockpit,
});

const SESSION_KEY = "instructbrain.field-session";
const STANDALONE = "__standalone__";

function FieldCockpit() {
  const { report } = Route.useSearch();
  return (
    <AppShell surface="light" chrome="field">
      {report ? <CaptureScreen reportId={report} /> : <FieldHome />}
    </AppShell>
  );
}

function CaptureScreen({ reportId }: { reportId: string }) {
  const query = useQuery(reportQuery(reportId));
  if (query.isPending) return <LoadingState label="Opening the report…" />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="This report could not be opened"
        error={query.error ?? new Error("Report not found.")}
        onRetry={() => void query.refetch()}
      />
    );
  }
  const { report, project } = query.data;
  return (
    <FieldCockpitView
      report={{ id: report.id, title: report.title }}
      snapshot={report.surveyTypeSnapshot}
      projectName={project?.name ?? null}
    />
  );
}

function FieldHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organisationId, organisationIds, userId } = useOrganisations();
  const reports = useQuery(recentReportsQuery(organisationIds));
  const projects = useQuery(projectsQuery(organisationIds));
  const activeProjects = (projects.data ?? []).filter((item) => item.status === "active");

  // Project and template are chosen once and held for the session.
  const [projectId, setProjectId] = useState<string>(STANDALONE);
  const [templateId, setTemplateId] = useState<string>(systemDefinitions[0]?.id ?? "");
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { projectId?: string; templateId?: string };
      if (saved.templateId && systemDefinitions.some((item) => item.id === saved.templateId)) {
        setTemplateId(saved.templateId);
        setProjectId(saved.projectId ?? STANDALONE);
        setLocked(true);
      }
    } catch {
      // Storage unavailable: choose again.
    }
  }, []);
  const lock = () => {
    setLocked(true);
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ projectId, templateId }));
    } catch {
      // Held in memory only.
    }
  };
  const unlock = () => {
    setLocked(false);
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Nothing stored.
    }
  };

  const definition = systemDefinitions.find((item) => item.id === templateId) ?? null;
  const project = activeProjects.find((item) => item.id === projectId) ?? null;

  const open = useMemo(
    () => (reports.data ?? []).filter((item) => item.status !== "issued").slice(0, 4),
    [reports.data],
  );
  const openIds = open.map((item) => item.id);
  const counts = useQuery({
    queryKey: ["field-photo-counts", openIds],
    enabled: openIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("photos" as never) as any)
        .select("report_id")
        .in("report_id", openIds);
      if (error) throw new Error(error.message);
      const tally: Record<string, number> = {};
      for (const row of (data ?? []) as Array<{ report_id: string }>) {
        tally[row.report_id] = (tally[row.report_id] ?? 0) + 1;
      }
      return tally;
    },
  });

  const start = useMutation({
    mutationFn: async () => {
      if (!definition) throw new Error("Choose a report template first.");
      if (!organisationId) throw new Error("You are not a member of an organisation yet.");
      const frozen = snapshotOf(definition);
      const label = definitionLabel(frozen);
      const brief: ReportBrief = {
        presetId: null,
        tone: DEFAULT_TONE_ID,
        reportType: "assessment",
        includeFix: true,
        includeSeverity: true,
        advisoryFooter: false,
        specialRequest: "",
        findingsPerPhoto: "template",
        draftSummary: false,
        surveyTypes: [{ id: definition.id, label }],
      };
      const today = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date());
      return withNetworkRetry(() =>
        createReport({
          organisationId,
          projectId: project?.id ?? null,
          isQuick: !project,
          title: `${label} — ${project?.name ?? today}`,
          definition: frozen,
          authorId: userId,
          brief,
          surveyTypeIds: [definition.id],
        }),
      );
    },
    onSuccess: async (id) => {
      lock();
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
      void navigate({ to: "/field", search: { report: id } });
    },
    onError: (error: Error) => toast.error(describeStartFailure(error)),
  });

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col sm:min-h-0">
      <InstallBar />

      <h1 className="editorial-title text-2xl font-semibold sm:text-3xl">On site</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Photograph as you go. Everything saves as you work.
      </p>

      <section
        aria-labelledby="session-heading"
        className="mt-4 rounded-2xl border border-border bg-surface-raised p-4 shadow-raised"
      >
        <h2 id="session-heading" className="sr-only">
          This session
        </h2>
        {locked ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-base font-semibold">
                <Lock aria-hidden="true" className="size-4 shrink-0" />
                <span className="truncate">{project?.name ?? "Standalone report"}</span>
              </p>
              <p className="truncate text-base text-muted-foreground">
                {definition ? definitionLabel(snapshotOf(definition)) : "—"}
              </p>
            </div>
            <Button variant="quiet" className="min-h-12" onClick={unlock}>
              Change
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="field-project" className="text-base font-medium">
                Project
              </label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="field-project" className="mt-1.5 h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STANDALONE}>Standalone report</SelectItem>
                  {activeProjects.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <TemplateSelect id="field-template" value={templateId} onChange={setTemplateId} />
          </div>
        )}
      </section>

      <section aria-labelledby="open-heading" className="mt-5">
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
          <p className="mt-2 text-base text-muted-foreground">
            Nothing open. Start below and take your first photograph.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {open.map((item) => {
              const count = counts.data?.[item.id];
              return (
                <li key={item.id}>
                  <Link
                    to="/field"
                    search={{ report: item.id }}
                    className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-surface-raised px-3 py-2 shadow-raised"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold">{item.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {count === undefined ? "…" : `${count} photo${count === 1 ? "" : "s"}`} ·
                        Updated {item.updated}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <ReportStatusPill status={item.status} />
                      <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-5 hidden items-center gap-2 text-base text-muted-foreground sm:flex">
        <Monitor aria-hidden="true" className="size-4 shrink-0" />
        <Link to="/dashboard" className="font-semibold text-brand-accent-ink">
          Open the full dashboard
        </Link>
      </p>

      {/* Primary action in thumb reach on a phone; inline on desktop. */}
      <div className="fixed inset-x-0 bottom-0 z-20 space-y-2 border-t border-border bg-background/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0">
        <button
          type="button"
          disabled={start.isPending || !definition}
          onClick={() => start.mutate()}
          className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-brand-accent px-5 text-lg font-semibold text-primary-foreground shadow-raised transition-transform active:scale-[0.99] disabled:opacity-70"
        >
          <Camera aria-hidden="true" className="size-6" />
          {start.isPending ? "Starting…" : "Start site walk"}
        </button>
        <Link
          to="/dashboard"
          className="flex min-h-12 items-center justify-center gap-2 text-base font-semibold text-brand-accent-ink sm:hidden"
        >
          <Monitor aria-hidden="true" className="size-4" />
          Full dashboard
        </Link>
      </div>
    </div>
  );
}
