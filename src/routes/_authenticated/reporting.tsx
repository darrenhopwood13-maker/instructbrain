import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ErrorState, LoadingState } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth";
import { organisationQuery, orgDashboardQuery } from "@/lib/data";
import { useOrganisations } from "@/lib/use-organisations";
import {
  buildPortfolioReport,
  periodFor,
  type PeriodPreset,
  type ReportScope,
} from "@/lib/reporting/aggregate";

export const Route = createFileRoute("/_authenticated/reporting")({
  head: () => {
    const title = "Reporting — instructBrain";
    const description =
      "Build a report over a project or the whole account, for any period, counted from the findings you can open. Preview it, then download the PDF.";
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
  component: ReportingScreen,
});

const PERIODS: Array<{ id: PeriodPreset; label: string }> = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_quarter", label: "This quarter to date" },
  { id: "last_90", label: "Last 90 days" },
  { id: "year_to_date", label: "Year to date" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function ReportingScreen() {
  const { user } = useSession();
  const { organisationIds, organisationId, loading } = useOrganisations();
  const itemsQuery = useQuery(orgDashboardQuery(organisationIds));
  const organisation = useQuery(organisationQuery(organisationId));

  const [preset, setPreset] = useState<PeriodPreset>("this_month");
  const [scopeId, setScopeId] = useState<"all" | string>("all");
  const [building, setBuilding] = useState(false);

  const items = itemsQuery.data?.items ?? [];
  const day = today();

  /** Every project with work on it, taken from the items rather than a second query. */
  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      if (!item.projectId) continue;
      if (!seen.has(item.projectId)) seen.set(item.projectId, item.projectName?.trim() || "Unnamed project");
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const scope: ReportScope = useMemo(() => {
    if (scopeId === "all") {
      return { kind: "organisation", projectId: null, label: "Whole account" };
    }
    const name = projectOptions.find((project) => project.id === scopeId)?.name ?? "Project";
    return { kind: "project", projectId: scopeId, label: name };
  }, [projectOptions, scopeId]);

  const period = useMemo(() => periodFor(preset, day), [preset, day]);

  const report = useMemo(
    () =>
      buildPortfolioReport({
        items,
        scope,
        period,
        today: day,
        mode: "internal",
        truncated: itemsQuery.data?.truncated ?? false,
      }),
    [items, scope, period, day, itemsQuery.data?.truncated],
  );

  async function download() {
    setBuilding(true);
    try {
      // Loaded on demand: the PDF stack is only needed by the moment somebody actually wants one.
      const { renderPortfolioPdf } = await import("@/lib/reporting/pdf");
      const { bytes, filename } = await renderPortfolioPdf(report, {
        organisationName: organisation.data?.name ?? "Your organisation",
        generatedBy: user?.email ?? "your account",
      });
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The report could not be built");
    } finally {
      setBuilding(false);
    }
  }

  if (loading || itemsQuery.isPending) {
    return (
      <AppShell surface="light">
        <LoadingState label="Reading the findings" />
      </AppShell>
    );
  }
  if (itemsQuery.error) {
    return (
      <AppShell surface="light">
        <ErrorState title="The findings could not be read" error={itemsQuery.error} />
      </AppShell>
    );
  }

  const peak = Math.max(1, ...report.months.map((month) => Math.max(month.raised, month.closed)));

  return (
    <AppShell surface="light">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Reporting</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Build a report from the work
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Everything below is counted from the findings you can open on the dashboard and the map. Change the
            scope or the period and the preview updates before you download anything.
          </p>
        </header>

        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Scope
            </span>
            <select
              value={scopeId}
              onChange={(event) => setScopeId(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="all">Whole account</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex-1">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Period
            </span>
            <select
              value={preset}
              onChange={(event) => setPreset(event.target.value as PeriodPreset)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {PERIODS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <Button onClick={download} disabled={building} className="sm:w-48">
            <Download className="mr-2 size-4" />
            {building ? "Building…" : "Download PDF"}
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 font-semibold uppercase tracking-[0.06em]">
            <FileText className="size-3" /> Internal report
          </span>
          <span>
            {scope.label} · {period.label} · {period.from} to {period.to}
          </span>
          <span>Generated {report.generatedOn}</span>
        </div>

        {report.empty ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="font-semibold">Nothing in this scope and period</p>
            <p className="mt-1 text-sm text-muted-foreground">
              There are no findings recorded here for these dates. Widen the period, or pick the whole account.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "Raised", value: String(report.headline.raised) },
                { label: "Signed off", value: String(report.headline.closed) },
                { label: "Open today", value: String(report.headline.open) },
                {
                  label: "Past their date",
                  value: String(report.headline.overdue),
                  tone: report.headline.overdue > 0 ? "text-red-600" : undefined,
                },
                {
                  label: "Median days to close",
                  value:
                    report.headline.medianDaysToClose === null
                      ? "not recorded"
                      : String(report.headline.medianDaysToClose),
                },
                {
                  label: "Open work past date",
                  value: report.headline.lateShare === null ? "n/a" : `${report.headline.lateShare}%`,
                },
              ].map((tile) => (
                <div key={tile.label} className="rounded-lg border border-border bg-card px-3 py-2">
                  <div className={`font-display text-2xl font-bold leading-none tracking-tight ${tile.tone ?? ""}`}>
                    {tile.value}
                  </div>
                  <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    {tile.label}
                  </div>
                </div>
              ))}
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Raised against signed off
              </h2>
              <div className="mt-4 flex h-40 items-end gap-3">
                {report.months.map((month) => (
                  <div key={month.label} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-32 w-full items-end justify-center gap-1">
                      <div
                        className="w-1/3 rounded-t bg-[#24417b]"
                        style={{ height: `${Math.max((month.raised / peak) * 100, 1)}%` }}
                        title={`${month.raised} raised`}
                      />
                      <div
                        className="w-1/3 rounded-t bg-[#2e8a00]"
                        style={{ height: `${Math.max((month.closed / peak) * 100, 1)}%` }}
                        title={`${month.closed} signed off`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{month.label}</span>
                    <span className="text-[10px] font-semibold">
                      {month.raised} / {month.closed}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Navy is raised, green is signed off. Figures under each month are raised / signed off.
              </p>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Where the work sits, worst first
              </h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                      <th className="py-2 pr-3 font-bold">Trade</th>
                      <th className="px-2 py-2 text-right font-bold">Raised</th>
                      <th className="px-2 py-2 text-right font-bold">Open</th>
                      <th className="px-2 py-2 text-right font-bold">Past date</th>
                      <th className="px-2 py-2 text-right font-bold">Closed</th>
                      <th className="py-2 pl-2 text-right font-bold">Median days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.trades.slice(0, 12).map((line) => (
                      <tr key={line.trade} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3">{line.trade}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{line.raised}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{line.open}</td>
                        <td
                          className={`px-2 py-2 text-right tabular-nums ${line.overdue > 0 ? "font-semibold text-red-600" : ""}`}
                        >
                          {line.overdue}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{line.closed}</td>
                        <td className="py-2 pl-2 text-right tabular-nums">
                          {line.medianDaysToClose === null ? "-" : line.medianDaysToClose}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">By project</h2>
              <ul className="mt-3 space-y-2">
                {report.projects.slice(0, 12).map((line) => (
                  <li
                    key={line.projectId ?? line.name}
                    className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate font-medium">{line.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {line.raised} raised · {line.open} open ·{" "}
                      <span className={line.overdue > 0 ? "font-semibold text-red-600" : ""}>{line.overdue} past date</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Past their date, worst first
              </h2>
              {report.worst.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Nothing is past its date in this scope.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {report.worst.map((item) => (
                    <li key={`${item.ref}-${item.title}`} className="flex items-start justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.title}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {item.ref ?? "no reference"} · {item.projectName} · {item.trade}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-red-600">{item.daysLate}d late</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-border bg-muted/30 p-4">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                How to read these figures
              </h2>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                {report.caveats.map((caveat) => (
                  <li key={caveat}>- {caveat}</li>
                ))}
              </ul>
              <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                This is the internal report. A client-issue version, with neutral wording, confidentiality filtering and
                a sign-off step before it can be sent, is not built yet.
              </p>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
