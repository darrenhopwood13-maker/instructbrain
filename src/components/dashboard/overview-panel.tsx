import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ErrorState, LoadingState } from "@/components/query-states";
import type { Overview } from "@/lib/analytics/overview";
import { orgOverviewQuery } from "@/lib/data";

/**
 * The organisation overview: what the account holds, in numbers.
 *
 * Sits below the day-to-day sections, because "what came in from site?" is still
 * the first question on this screen and a chart must never push that down.
 *
 * Three deliberate choices:
 *
 * - **One source for every figure.** All of it comes from `orgOverviewQuery`,
 *   which reads the same tables the lists above read, so a total can never
 *   disagree with the list it sits over.
 * - **A project with no reports stays in the table.** Hiding it would hide the
 *   answer to "which job have we not surveyed yet?".
 * - **The caveats are on the panel, not in a chat message.** If a list hit its
 *   row cap, the panel says so; if the account holds demo data, the footer says
 *   that the figures count everything it can see.
 */

const STATUS_FILL: Record<string, string> = {
  draft: "var(--color-border-strong)",
  in_review: "var(--color-brand-blue)",
  issued: "var(--color-brand-accent)",
};

const AXIS = { stroke: "var(--color-muted-foreground)", fontSize: 11 };

function Stat({
  label,
  value,
  tone = "normal",
  hint,
}: {
  label: string;
  value: number;
  tone?: "normal" | "attention";
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`editorial-title mt-1 text-2xl font-semibold ${
          tone === "attention" && value > 0 ? "text-fail" : ""
        }`}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function OverviewPanel({ organisationIds }: { organisationIds: string[] }) {
  const query = useQuery(orgOverviewQuery(organisationIds));

  if (organisationIds.length === 0) return null;

  return (
    <section aria-labelledby="overview-heading" className="mt-6">
      <h2 id="overview-heading" className="editorial-title text-base font-semibold">
        Overview
      </h2>

      <div className="mt-3">
        {query.isPending ? (
          <LoadingState label="Counting your reports…" />
        ) : query.isError ? (
          <ErrorState
            title="The overview could not be loaded"
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : (
          <OverviewBody
            overview={query.data.overview}
            truncated={query.data.truncated}
          />
        )}
      </div>
    </section>
  );
}

function OverviewBody({ overview, truncated }: { overview: Overview; truncated: boolean }) {
  const { totals, byStatus, byProject, monthly } = overview;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Reports" value={totals.reports} hint={`${totals.projectReports} on projects`} />
        <Stat label="Issued" value={totals.issued} />
        <Stat label="Draft" value={totals.drafts} />
        <Stat label="Items" value={totals.items} hint={`${totals.openItems} still open`} />
        <Stat label="Overdue" value={totals.overdueItems} tone="attention" />
        <Stat label="Projects" value={totals.projects} hint={`${totals.withReports} with reports`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-raised p-3">
          <h3 className="text-sm font-semibold">Reports by status</h3>
          {byStatus.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No reports yet.</p>
          ) : (
            <div className="mt-2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byStatus} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => [value, "Reports"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {byStatus.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_FILL[entry.status] ?? "var(--color-brand-blue)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-surface-raised p-3">
          <h3 className="text-sm font-semibold">Reports created, last six months</h3>
          <div className="mt-2 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: number) => [value, "Reports"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="reports"
                  stroke="var(--color-brand-accent)"
                  fill="var(--color-brand-accent)"
                  fillOpacity={0.25}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-raised p-3">
        <h3 className="text-sm font-semibold">Projects</h3>
        {byProject.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No projects yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-3 font-semibold">Project</th>
                  <th scope="col" className="py-1.5 pr-3 font-semibold">Ref</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Reports</th>
                  <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Open items</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {byProject.map((project) => (
                  <tr key={project.id} className="border-t border-border">
                    <td className="py-2 pr-3">{project.name}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{project.reference ?? "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{project.reports}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{project.openItems}</td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        project.overdueItems > 0 ? "font-semibold text-fail" : ""
                      }`}
                    >
                      {project.overdueItems}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Every figure counts everything this account can see, including any demo or test data — none of
        it is filtered out. {totals.closedItems === 0 && totals.items > 0 ? "No item has been closed out yet, so \"open items\" currently matches the total. " : ""}
        {truncated
          ? "One of the underlying lists hit its row limit, so these figures understate the account. "
          : ""}
        An item counts as open until it reaches a verified or closed state; overdue means open with a
        due date that has passed.
      </p>
    </div>
  );
}
