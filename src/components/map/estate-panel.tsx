import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Send } from "lucide-react";

import { ErrorState, LoadingState } from "@/components/query-states";
import { siteQueueQuery } from "@/lib/field/handoff";
import {
  breakdownOf,
  overdueItems,
  type ControlRoomTotals,
  type RaisedWeek,
} from "@/lib/analytics/control-room";
import { daysLate, firstNonEmptyText, type DashboardItem } from "@/lib/analytics/item-map";

/**
 * The estate tab: the dashboard's analysis, folded into the rail that already existed.
 *
 * The dashboard and the map were both answering "how is the estate doing" - the same
 * figures, counted from the same items, twice. This is that answer living where the
 * pins are, so there is one place to read it and one place to fix it.
 *
 * Everything here comes from the control-room maths the dashboard used, so folding the
 * two screens together cannot quietly change a number.
 */
export function EstatePanel({
  totals,
  weeks,
  items,
  today,
  organisationIds,
  isPending,
  isError,
  error,
  onRetry,
}: {
  totals: ControlRoomTotals;
  weeks: RaisedWeek[];
  items: readonly DashboardItem[];
  today: string;
  organisationIds: string[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const queue = useQuery(siteQueueQuery(organisationIds));
  const late = overdueItems(items, today).slice(0, 5);
  const byProject = breakdownOf(items, "project", today).slice(0, 5);
  const peak = Math.max(1, ...weeks.map((week) => week.raised));
  const closedShare = totals.items > 0 ? Math.round((totals.closed / totals.items) * 100) : 0;

  if (isPending) return <LoadingState label="Adding it up…" />;
  if (isError) {
    return <ErrorState title="The figures could not be loaded" error={error} onRetry={onRetry} />;
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="estate-raised">
        <h3
          id="estate-raised"
          className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Items raised, last 12 weeks
        </h3>
        <div className="mt-2 flex h-24 items-end gap-1">
          {weeks.map((week) => (
            <div
              key={week.week}
              className="w-full flex-1 rounded-t-[3px] bg-brand-accent-ink"
              style={{ height: `${Math.max(2, Math.round((week.raised / peak) * 92))}px` }}
              title={`${week.label}: ${week.raised} raised`}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{weeks[0]?.label}</span>
          <span>{weeks[weeks.length - 1]?.label}</span>
        </div>
      </section>

      <section
        aria-labelledby="estate-closed"
        className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
      >
        <div
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(var(--brand-accent-ink) ${closedShare * 3.6}deg, var(--muted) 0)`,
          }}
        >
          <span className="grid size-10 place-items-center rounded-full bg-card text-[11px] font-bold">
            {closedShare}%
          </span>
        </div>
        <div className="min-w-0">
          <h3 id="estate-closed" className="text-sm font-bold">
            Closed out
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {totals.closed} of {totals.items} closed. {totals.openItems} still open across{" "}
            {totals.reports} report{totals.reports === 1 ? "" : "s"}.
          </p>
        </div>
      </section>

      <section aria-labelledby="estate-late">
        <h3 id="estate-late" className="text-[11px] font-bold uppercase tracking-[0.08em] text-fail">
          Past their date, {totals.overdue} in all
        </h3>
        {late.length === 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Nothing is past its date. That is the whole of it.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {late.map((item) => {
              const days = daysLate(item, today);
              return (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card px-2 py-1.5"
                >
                  <span className="min-w-0 text-[11px] leading-snug">
                    <span className="line-clamp-2 font-semibold">
                      {firstNonEmptyText(item.title, item.ref, "Untitled item")}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {item.projectName ?? "No project"}
                    </span>
                  </span>
                  {days === null ? null : (
                    <span className="shrink-0 text-[10px] font-bold text-fail">{days}d late</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="estate-projects">
        <h3
          id="estate-projects"
          className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Open items by project
        </h3>
        <ul className="mt-1.5 space-y-1">
          {byProject.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate">{row.label}</span>
              <span className="shrink-0 font-bold tabular-nums">{row.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="estate-queue">
        <h3
          id="estate-queue"
          className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Sent for review
        </h3>
        {(queue.data ?? []).length === 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">Nothing waiting from site.</p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {(queue.data ?? []).map((report) => (
              <li key={report.id}>
                <Link
                  to="/reports/$id"
                  params={{ id: report.id }}
                  search={{ tab: "review" }}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] hover:border-brand-blue/40"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Send aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate font-semibold">{report.title}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{report.sentAt}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Counted from the items on your account. Items with no trade or no severity are shown as they
        are, never filed under a guess.
      </p>
    </div>
  );
}
