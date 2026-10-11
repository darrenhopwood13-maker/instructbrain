import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ErrorState, LoadingState } from "@/components/query-states";
import { ItemDrawer } from "@/components/dashboard/item-drawer";
import { STATE_LABEL, stateOf, type DashboardItem } from "@/lib/analytics/item-map";
import {
  PERIODS,
  PERIOD_LABEL,
  PERIOD_SENTENCE,
  dueLine,
  buildLedger,
  type LedgerPeriod,
} from "@/lib/analytics/ledger";
import { orgDashboardQuery } from "@/lib/data";

/**
 * The ledger band: the reading a director takes, under the map.
 *
 * It deliberately does NOT rescale its headline when you change the date window.
 * "Items still open" is a standing position - tapping "7 days" cannot close an
 * item, so a dashboard that moves that number is inventing it. The window drives
 * the activity line only, and the two are labelled separately so nobody has to
 * guess which is which.
 */
export function LedgerBand({ organisationIds }: { organisationIds: string[] }) {
  const query = useQuery(orgDashboardQuery(organisationIds));
  const [period, setPeriod] = useState<LedgerPeriod>("all");
  const [openItem, setOpenItem] = useState<DashboardItem | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Stable identities, so the ledger is not rebuilt on every unrelated render.
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const reports = useMemo(() => query.data?.reports ?? [], [query.data]);
  const ledger = useMemo(
    () => buildLedger({ items, reports, period, today }),
    [items, reports, period, today],
  );

  if (organisationIds.length === 0) return null;

  return (
    <section aria-labelledby="ledger-heading" className="mt-6">
      <h2 id="ledger-heading" className="editorial-title text-base font-semibold">
        Where that leaves you
      </h2>

      <div className="mt-3">
        {query.isPending ? (
          <LoadingState label="Adding it up…" />
        ) : query.isError ? (
          <ErrorState
            title="The summary could not be loaded"
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Items still open
                </div>
                <div className="editorial-title mt-1 text-5xl font-semibold leading-none tracking-tight">
                  {ledger.standing.openItems}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {ledger.standing.overdueItems > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-fail-soft px-2.5 py-1 font-semibold text-fail">
                      {ledger.standing.overdueItems} past their date
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Nothing past its date</span>
                  )}
                  {ledger.standing.notAssessed > 0 ? (
                    <span className="text-muted-foreground">
                      {ledger.standing.notAssessed} nobody has assessed
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Activity
                </span>
                <div className="mt-1 inline-flex overflow-hidden rounded-lg border border-border">
                  {PERIODS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPeriod(option)}
                      aria-pressed={period === option}
                      className={`min-h-9 border-r border-border px-3 text-xs font-semibold last:border-r-0 ${
                        period === option
                          ? "bg-brand-blue text-white"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {PERIOD_LABEL[option]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {ledger.activity.reports} report{ledger.activity.reports === 1 ? "" : "s"} and{" "}
                  {ledger.activity.items} item{ledger.activity.items === 1 ? "" : "s"} raised{" "}
                  {PERIOD_SENTENCE[period]}
                  {ledger.activity.projects > 0
                    ? `, across ${ledger.activity.projects} project${ledger.activity.projects === 1 ? "" : "s"}`
                    : ""}
                  .
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Figure label="Reports" value={ledger.standing.reports} hint="on the account" />
              <Figure label="Closed out" value={ledger.standing.closedOut} hint="signed off" />
              <Figure
                label="Projects"
                value={ledger.standing.projects}
                hint="with reports on them"
              />
            </div>

            {ledger.attention.length > 0 ? (
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold">Needs attention now</h3>
                  <span className="text-xs text-muted-foreground">
                    {ledger.attentionTotal > ledger.attention.length
                      ? `the ${ledger.attention.length} most urgent of ${ledger.attentionTotal}`
                      : "whatever is past its date, then anything nobody has assessed"}
                  </span>
                </div>
                <ul className="mt-2 overflow-hidden rounded-xl border border-border">
                  {ledger.attention.map((item) => {
                    const state = stateOf(item, today);
                    return (
                      <li key={item.id} className="border-b border-border last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setOpenItem(item)}
                          className="flex w-full min-h-11 items-center gap-3 px-3 py-2 text-left hover:bg-surface"
                        >
                          <span className="w-[86px] shrink-0 font-mono text-[11px] text-muted-foreground">
                            {item.ref ?? "-"}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {item.title ?? "Untitled item"}
                          </span>
                          <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                            {item.projectName ?? "No project"}
                          </span>
                          <span
                            className={`shrink-0 text-xs font-semibold ${
                              state === "overdue" ? "text-fail" : "text-muted-foreground"
                            }`}
                          >
                            {state === "overdue" ? dueLine(item, today) : STATE_LABEL[state]}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <ItemDrawer item={openItem} today={today} onClose={() => setOpenItem(null)} />
    </section>
  );
}

function Figure({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div className="editorial-title mt-1 text-2xl font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}
