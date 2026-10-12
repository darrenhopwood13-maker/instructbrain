import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ErrorState, LoadingState } from "@/components/query-states";
import {
  BREAKDOWN_AXES,
  BREAKDOWN_LABEL,
  UNSET_LABEL,
  breakdownOf,
  controlRoomTotals,
  overdueItems,
  raisedByWeek,
  severityLabel,
  type BreakdownAxis,
} from "@/lib/analytics/control-room";
import { canCloseOut } from "@/lib/report/close-out";
import { CloseOutItem } from "@/components/dashboard/close-out-item";
import { daysLate, firstNonEmptyText, type DashboardItem } from "@/lib/analytics/item-map";
import { orgDashboardQuery } from "@/lib/data";

/**
 * The control room: the figures first, then the one box you can pull apart.
 *
 * Rebuilt to Dal's instruction of 12 Oct 2026 - "graphs and the total reports open
 * etc details. We don't need all the recent actions list below either" - so there is
 * no activity feed here. What there is: the totals, what has been raised week by
 * week, how much has been closed out, and one interactive box that breaks the open
 * items down by trade, severity, date raised or project and opens a row to show the
 * items in it.
 *
 * Every number is counted from the account and nothing is bucketed by guesswork: on
 * the live account most items carry no severity at all, and they are shown as
 * "Not set" rather than filed under something they did not earn.
 */
export function ControlRoom({ organisationIds }: { organisationIds: string[] }) {
  const query = useQuery(orgDashboardQuery(organisationIds));
  const [axis, setAxis] = useState<BreakdownAxis>("trade");
  const [openRow, setOpenRow] = useState<string | null>(null);

  // One "today" for the whole render, so nothing can be overdue in one panel and
  // in date in another.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const reports = useMemo(() => query.data?.reports ?? [], [query.data]);

  const totals = useMemo(() => controlRoomTotals(items, reports, today), [items, reports, today]);
  const weeks = useMemo(() => raisedByWeek(items, 12, today), [items, today]);
  const rows = useMemo(() => breakdownOf(items, axis, today), [items, axis, today]);
  const late = useMemo(() => overdueItems(items, today).slice(0, 6), [items, today]);

  if (organisationIds.length === 0) return null;

  return (
    <section aria-labelledby="control-room-heading" className="mt-6">
      <h2 id="control-room-heading" className="editorial-title text-base font-semibold">
        Where things stand
      </h2>

      <div className="mt-3">
        {query.isPending ? (
          <LoadingState label="Adding it up…" />
        ) : query.isError ? (
          <ErrorState
            title="The figures could not be loaded"
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label="Reports" value={totals.reports} />
              <Stat label="Open items" value={totals.openItems} tone="brand" />
              <Stat label="Overdue" value={totals.overdue} tone={totals.overdue > 0 ? "fail" : "plain"} />
              <Stat label="Nobody has assessed" value={totals.notAssessed} />
              <Stat label="No trade on them" value={totals.unallocated} />
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <RaisedChart weeks={weeks} />
              <CloseOut closed={totals.closed} open={totals.openItems} items={totals.items} />
            </div>

            <div className="rounded-2xl border border-border bg-surface-raised p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">Open items, pulled apart</h3>
                <div role="group" aria-label="Break the open items down by" className="flex flex-wrap gap-1">
                  {BREAKDOWN_AXES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={axis === value}
                      onClick={() => {
                        setAxis(value);
                        setOpenRow(null);
                      }}
                      className={`min-h-9 rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                        axis === value
                          ? "bg-brand-accent-ink text-white"
                          : "border border-border bg-surface text-foreground hover:border-brand-accent"
                      }`}
                    >
                      {BREAKDOWN_LABEL[value]}
                    </button>
                  ))}
                </div>
              </div>

              {rows.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nothing is open. That is the whole of it.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {totals.openItems} open item{totals.openItems === 1 ? "" : "s"} in{" "}
                    {rows.length} {BREAKDOWN_LABEL[axis].toLowerCase()} group
                    {rows.length === 1 ? "" : "s"}. Tap one to see what is in it.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {rows.map((row) => {
                      const share = totals.openItems === 0 ? 0 : Math.round((row.count / totals.openItems) * 100);
                      const open = openRow === row.key;
                      return (
                        <li key={row.key}>
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setOpenRow(open ? null : row.key)}
                            className="w-full rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface"
                          >
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="min-w-0 truncate text-sm font-semibold">{row.label}</span>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {row.count}
                                {row.overdue > 0 ? ` · ${row.overdue} late` : ""}
                              </span>
                            </span>
                            <span
                              aria-hidden="true"
                              className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-sunken"
                            >
                              <span
                                className={row.overdue > 0 ? "block h-full bg-fail" : "block h-full bg-brand-accent-deep"}
                                style={{ width: `${share}%` }}
                              />
                            </span>
                          </button>
                          {open ? (
                            <ul className="mb-2 ml-2 space-y-1 border-l-2 border-border pl-2">
                              {row.items.slice(0, 12).map((item) => (
                                <li key={item.id} className="text-xs">
                                  <span className="font-medium">{firstNonEmptyText(item.title, item.ref)}</span>
                                  <span className="text-muted-foreground">
                                    {item.ref ? ` · ${item.ref}` : ""}
                                    {item.surveyLabel ? ` · ${item.surveyLabel}` : ""}
                                    {lateSuffix(item, today)}
                                  </span>
                                </li>
                              ))}
                              {row.items.length > 12 ? (
                                <li className="text-xs text-muted-foreground">
                                  and {row.items.length - 12} more
                                </li>
                              ) : null}
                            </ul>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {axis === "severity" ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Each template carries its own severity scale, so these are the words your
                      templates use. Anything nobody has set reads {UNSET_LABEL}.
                    </p>
                  ) : null}
                </>
              )}
            </div>

            {late.length > 0 ? (
              <div className="rounded-2xl border border-fail/40 bg-fail-soft/60 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold text-fail">Past their date</h3>
                  <span className="text-xs text-muted-foreground">
                    Close one out here, with a comment or a photograph
                  </span>
                </div>
                <ul className="mt-2 space-y-2">
                  {late.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2"
                    >
                      <span className="min-w-0 flex-1 text-xs">
                        <span className="block truncate font-medium">
                          {firstNonEmptyText(item.title, item.ref)}
                        </span>
                        <span className="block text-muted-foreground">
                          {item.ref ? `${item.ref} · ` : ""}
                          {item.surveyLabel ?? "No template"}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-fail">
                        {lateLabel(item, today)}
                      </span>
                      {canCloseOut(item.lifecycleState) ? (
                        <CloseOutItem item={item} today={today} />
                      ) : null}
                    </li>
                  ))}
                </ul>
                {totals.overdue > late.length ? (
                  <p className="mt-2 text-xs text-fail">
                    {totals.overdue - late.length} more past their date elsewhere.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function lateSuffix(item: DashboardItem, today: string): string {
  const days = daysLate(item, today);
  return days === null ? "" : ` · ${days} day${days === 1 ? "" : "s"} late`;
}

function lateLabel(item: DashboardItem, today: string): string {
  const days = daysLate(item, today);
  if (days === null) return "late";
  return `${days} day${days === 1 ? "" : "s"} late`;
}

function Stat({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: number;
  tone?: "plain" | "brand" | "fail";
}) {
  const valueTone =
    tone === "fail" ? "text-fail" : tone === "brand" ? "text-brand-accent-ink" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-surface-raised px-3 py-2.5">
      <div className={`text-2xl font-bold tabular-nums ${valueTone}`}>{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
    </div>
  );
}

function RaisedChart({ weeks }: { weeks: { label: string; raised: number }[] }) {
  const total = weeks.reduce((sum, week) => sum + week.raised, 0);
  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">Items raised, last 12 weeks</h3>
        <span className="text-xs text-muted-foreground">
          {total} in the window · {weeks.filter((week) => week.raised > 0).length} weeks with something on them
        </span>
      </div>
      <div className="mt-2 h-[168px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeks} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={1}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-sunken)" }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 12,
              }}
              labelFormatter={(label) => `Week beginning ${String(label)}`}
              formatter={(value: number) => [`${value} item${value === 1 ? "" : "s"}`, "Raised"]}
            />
            <Bar dataKey="raised" fill="var(--brand-accent-deep)" radius={[3, 3, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CloseOut({ closed, open, items }: { closed: number; open: number; items: number }) {
  const decided = closed + open;
  const percent = decided === 0 ? 0 : Math.round((closed / decided) * 100);
  return (
    <div className="rounded-2xl border border-border bg-surface-raised p-3">
      <h3 className="text-sm font-bold">Closed out</h3>
      <div className="mt-2 flex items-center gap-3">
        <div
          className="grid size-20 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(var(--brand-accent-deep) ${percent * 3.6}deg, var(--surface-sunken) 0deg)`,
          }}
          role="img"
          aria-label={`${percent}% of items with a lifecycle are closed out`}
        >
          <span className="grid size-14 place-items-center rounded-full bg-surface text-sm font-bold tabular-nums">
            {percent}%
          </span>
        </div>
        <div className="min-w-0 text-xs">
          <p className="font-semibold">
            {closed} of {decided} closed out
          </p>
          <p className="mt-1 text-muted-foreground">
            {open} still open. {items} item{items === 1 ? "" : "s"} raised in total, across every
            report in the account.
          </p>
        </div>
      </div>
    </div>
  );
}
