import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth";
import { organisationQuery } from "@/lib/data";
import { useOrganisations } from "@/lib/use-organisations";
import type { DashboardItem } from "@/lib/analytics/item-map";
import {
  buildPortfolioReport,
  periodFor,
  type PeriodPreset,
  type ReportScope,
} from "@/lib/reporting/aggregate";

/**
 * The report builder, inside the map rather than at its own address.
 *
 * It lives here because the map is where the questions actually get asked - "what has gone past
 * its date, and where" - and a report is the same numbers in a document. Scope defaults to
 * whatever is selected on the map, so tapping a pin and then asking for its report is one move.
 */

const PERIODS: Array<{ id: PeriodPreset; label: string }> = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_quarter", label: "Quarter to date" },
  { id: "last_90", label: "Last 90 days" },
  { id: "year_to_date", label: "Year to date" },
];

type ReportPanelProps = {
  items: DashboardItem[];
  selectedProjectId: string | null;
  selectedProjectName: string | null;
  truncated: boolean;
};

export function ReportPanel({ items, selectedProjectId, selectedProjectName, truncated }: ReportPanelProps) {
  const { user } = useSession();
  const { organisationId } = useOrganisations();
  const organisation = useQuery(organisationQuery(organisationId));

  const [preset, setPreset] = useState<PeriodPreset>("this_month");
  const [scopeId, setScopeId] = useState<"all" | "selected">("all");
  const [building, setBuilding] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const period = useMemo(() => periodFor(preset, today), [preset, today]);

  const scope: ReportScope = useMemo(() => {
    if (scopeId === "selected" && selectedProjectId) {
      return {
        kind: "project",
        projectId: selectedProjectId,
        label: selectedProjectName?.trim() || "Selected project",
      };
    }
    return { kind: "organisation", projectId: null, label: "Whole estate" };
  }, [scopeId, selectedProjectId, selectedProjectName]);

  const report = useMemo(
    () => buildPortfolioReport({ items, scope, period, today, mode: "internal", truncated }),
    [items, scope, period, today, truncated],
  );

  async function download() {
    setBuilding(true);
    try {
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

  return (
    <div className="space-y-4">
      <div>
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Covers
          </span>
          <select
            value={scopeId}
            onChange={(event) => setScopeId(event.target.value as "all" | "selected")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
          >
            <option value="all">Whole estate</option>
            <option value="selected" disabled={!selectedProjectId}>
              {selectedProjectId ? (selectedProjectName ?? "Selected project") : "Select a pin first"}
            </option>
          </select>
        </label>

        <label className="mt-3 block">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Period
          </span>
          <select
            value={preset}
            onChange={(event) => setPreset(event.target.value as PeriodPreset)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
          >
            {PERIODS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <p className="mt-2 text-[11px] text-muted-foreground">
          {scope.label} · {period.from} to {period.to}
        </p>
      </div>

      {report.empty ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-[12px] text-muted-foreground">
          Nothing recorded in this scope for these dates.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Raised" value={report.headline.raised} />
            <Tile label="Signed off" value={report.headline.closed} />
            <Tile
              label="Past their date"
              value={report.headline.overdue}
              {...(report.headline.overdue > 0 ? { tone: "bad" as const } : {})}
            />
            <Tile
              label="Median days to close"
              value={report.headline.medianDaysToClose === null ? "not recorded" : report.headline.medianDaysToClose}
              small={report.headline.medianDaysToClose === null}
            />
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              Worst trades
            </p>
            <ul className="mt-2 space-y-1.5">
              {report.trades.slice(0, 5).map((line) => (
                <li key={line.trade} className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="min-w-0 truncate">{line.trade}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {line.open} open · <span className={line.overdue > 0 ? "font-semibold text-red-600" : ""}>{line.overdue} late</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            {report.caveats[0] ?? "Counted from the findings on this map."}
          </p>
        </>
      )}

      <Button onClick={download} disabled={building} className="w-full">
        <Download className="mr-2 size-4" />
        {building ? "Building…" : "Download report (PDF)"}
      </Button>

      <p className="border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
        Internal report. The same numbers the map is drawn from. A client version, with neutral
        wording and a sign-off step before it can be sent, is not built yet.
      </p>
    </div>
  );
}

function Tile({ label, value, tone, small }: { label: string; value: number | string; tone?: "bad"; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div
        className={`font-display font-bold leading-none tracking-tight ${small ? "text-[13px]" : "text-2xl"} ${
          tone === "bad" ? "text-red-600" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
    </div>
  );
}
