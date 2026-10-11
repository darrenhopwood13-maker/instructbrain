import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { ClipboardList, Copy, X } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { ErrorState, LoadingState } from "@/components/query-states";
import { ItemDrawer } from "@/components/dashboard/item-drawer";
import {
  OUTLINE_STATES,
  STATE_FILL,
  STATE_LABEL,
  STATE_ORDER,
  buildItemMap,
  groupSummary,
  stateOf,
  type DashboardItem,
  type GroupBy,
  type ItemState,
} from "@/lib/analytics/item-map";
import { orgDashboardQuery } from "@/lib/data";

/**
 * The item map: the dashboard's hero.
 *
 * One cell is one item. Hover reads it, click opens it, drag across a block to
 * pull out a set. Regroup the whole map by project, survey or report without
 * leaving the page - the data is fetched once and regrouped in memory, which is
 * what makes the switch feel instant rather than like a page load.
 *
 * Accessibility note: the cells are real buttons with labels and keyboard focus,
 * and every cell's meaning is also available in the drawer and the summary line,
 * so nothing here depends on being able to see a colour.
 */

const GROUP_BY: GroupBy[] = ["project", "survey", "report"];

/** Outline states are drawn as a dashed border with no fill. */
const isOutline = (state: ItemState) => OUTLINE_STATES.includes(state);

export function ItemMapPanel({ organisationIds }: { organisationIds: string[] }) {
  const query = useQuery(orgDashboardQuery(organisationIds));
  const [groupBy, setGroupBy] = useState<GroupBy>("project");
  const [stateFilter, setStateFilter] = useState<ItemState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [openItem, setOpenItem] = useState<DashboardItem | null>(null);
  const [hover, setHover] = useState<{ item: DashboardItem; x: number; y: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // One "today" for the whole render pass, so a cell cannot be judged overdue by
  // one part of the screen and in-date by another.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Memoised so the derived arrays keep a stable identity between renders -
  // otherwise `?? []` hands the useMemo below a fresh array every time and the
  // grouping is recomputed on every keystroke anywhere on the page.
  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const map = useMemo(() => buildItemMap(items, { groupBy, today }), [items, groupBy, today]);

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const selectedItems = useMemo(
    () => selected.map((id) => byId.get(id)).filter((item): item is DashboardItem => Boolean(item)),
    [selected, byId],
  );
  const selectedReports = useMemo(() => uniqueReports(selectedItems), [selectedItems]);
  // Narrowed once here, rather than indexing the array inside the markup.
  const singleSelectedReport = selectedReports.length === 1 ? selectedReports[0] : null;

  // Drag-select: pointerdown on a cell starts a set, entering further cells adds
  // to it, and a pointerup that never left the first cell is treated as a click
  // and opens the record instead.
  const dragging = useRef(false);
  const dragMoved = useRef(false);

  const startDrag = useCallback((id: string) => {
    dragging.current = true;
    dragMoved.current = false;
    setSelected([id]);
  }, []);

  const extendDrag = useCallback((id: string) => {
    if (!dragging.current) return;
    dragMoved.current = true;
    setSelected((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  const endDrag = useCallback(
    (id: string) => {
      dragging.current = false;
      if (!dragMoved.current) {
        const item = byId.get(id);
        if (item) setOpenItem(item);
      }
      dragMoved.current = false;
    },
    [byId],
  );

  const clearSelection = () => {
    setSelected([]);
    setCopied(null);
  };

  const copyReferences = () => {
    const refs = selectedItems.map((item) => item.ref ?? item.id).join(", ");
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(refs);
      setCopied(`Copied ${selectedItems.length} reference${selectedItems.length === 1 ? "" : "s"}`);
    } else {
      setCopied("Copying is not available in this browser");
    }
  };

  if (organisationIds.length === 0) return null;

  return (
    <section aria-labelledby="item-map-heading" className="mt-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="item-map-heading" className="editorial-title text-base font-semibold">
          Every item, on one map
        </h2>
        <span className="text-xs text-muted-foreground">
          one square is one item - hover to read it, click to open it, drag to select a set
        </span>
      </div>

      <div className="mt-3">
        {query.isPending ? (
          <LoadingState label="Reading your items…" />
        ) : query.isError ? (
          <ErrorState
            title="The item map could not be loaded"
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : map.totals.items === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nothing to map yet"
            description="Once a report has items on it, every one of them appears here as a square."
          />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface-raised px-3 py-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Group by
              </span>
              <div className="inline-flex overflow-hidden rounded-lg border border-border">
                {GROUP_BY.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setGroupBy(option);
                      clearSelection();
                    }}
                    aria-pressed={groupBy === option}
                    className={`min-h-9 border-r border-border px-3 text-xs font-semibold capitalize last:border-r-0 ${
                      groupBy === option
                        ? "bg-brand-blue text-white"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
                {STATE_ORDER.map((state) => {
                  const count = map.totals.byState[state];
                  if (count === 0 && state !== "overdue") return null;
                  return (
                    <button
                      key={state}
                      type="button"
                      onClick={() => setStateFilter(stateFilter === state ? null : state)}
                      aria-pressed={stateFilter === state}
                      title={`Show only: ${STATE_LABEL[state]}`}
                      className={`inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs ${
                        stateFilter === state ? "bg-surface text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="inline-block size-2.5 rounded-sm border border-border"
                        style={{
                          background: STATE_FILL[state],
                          borderStyle: isOutline(state) ? "dashed" : "solid",
                        }}
                      />
                      {STATE_LABEL[state]} {count}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-surface-raised">
              {map.groups.map((group) => {
                const summary = groupSummary(group.items, today);
                return (
                  <div key={group.key} className="border-b border-border last:border-b-0">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-3">
                      <span className="min-w-0 truncate text-sm font-semibold">{group.label}</span>
                      {group.sublabel ? (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {group.sublabel}
                        </span>
                      ) : null}
                      <span className="text-[11px] text-muted-foreground">
                        {group.items.length} item{group.items.length === 1 ? "" : "s"}
                        {summary.late > 0 ? `, ${summary.late} overdue` : ""}
                        {summary.unassessed > 0 ? `, ${summary.unassessed} not assessed` : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 px-4 pb-3 pt-2">
                      {group.items.map((item) => {
                        const state = stateOf(item, today);
                        const dim = stateFilter !== null && stateFilter !== state;
                        const isSelected = selected.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-label={`${item.ref ?? "Item"}: ${item.title ?? ""} - ${STATE_LABEL[state]}`}
                            aria-pressed={isSelected}
                            onPointerDown={() => startDrag(item.id)}
                            onPointerEnter={() => extendDrag(item.id)}
                            onPointerUp={() => endDrag(item.id)}
                            onFocus={() => setHover(null)}
                            onMouseEnter={(event) =>
                              setHover({ item, x: event.clientX, y: event.clientY })
                            }
                            onMouseLeave={() => setHover(null)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setOpenItem(item);
                              }
                            }}
                            className="size-[15px] shrink-0 rounded-[3px] border transition-transform hover:scale-[1.45] focus-visible:scale-[1.45] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent"
                            style={{
                              background: STATE_FILL[state],
                              borderStyle: isOutline(state) ? "dashed" : "solid",
                              borderColor: isSelected ? "var(--foreground)" : "var(--border)",
                              boxShadow: isSelected ? "0 0 0 2px var(--foreground)" : undefined,
                              opacity: dim ? 0.2 : 1,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {map.omittedGroups > 0 ? (
              <p className="text-xs text-muted-foreground">
                Showing the {map.groups.length} busiest of {map.totalGroups} groups as {groupBy}s.{" "}
                {map.omittedItems} items are in the {map.omittedGroups} groups not drawn here - the
                counts above still include them.
              </p>
            ) : null}

            {selectedItems.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-foreground/40 bg-surface p-3">
                <span className="text-sm font-semibold">
                  {selectedItems.length} item{selectedItems.length === 1 ? "" : "s"} selected
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {selectedItems
                    .slice(0, 6)
                    .map((item) => item.ref ?? item.id)
                    .join(", ")}
                  {selectedItems.length > 6 ? ` +${selectedItems.length - 6} more` : ""}
                </span>
                <span className="ml-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyReferences}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold"
                  >
                    <Copy aria-hidden="true" className="size-3.5" />
                    Copy references
                  </button>
                  {singleSelectedReport ? (
                    <Link
                      to="/reports/$id"
                      params={{ id: singleSelectedReport }}
                      search={{ tab: "review" }}
                      className="inline-flex min-h-9 items-center rounded-lg bg-brand-blue px-3 text-xs font-semibold text-white"
                    >
                      Open the report
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                    Clear
                  </button>
                </span>
                {copied ? (
                  <span role="status" className="w-full text-xs text-muted-foreground">
                    {copied}
                  </span>
                ) : null}
              </div>
            ) : null}

            <p className="text-xs leading-relaxed text-muted-foreground">
              Every square is a real item on the account, including demo data - nothing is filtered
              out. An item is open until it reaches a verified or closed state, and counts as overdue
              from the day after its date. A dashed square is an item nobody has assessed.
              {query.data?.truncated
                ? " One of the underlying reads hit its row limit, so these figures understate the account."
                : ""}
            </p>
          </div>
        )}
      </div>

      {hover ? (
        <div
          role="status"
          className="pointer-events-none fixed z-50 max-w-[280px] rounded-lg bg-foreground px-3 py-2 text-xs text-surface-raised shadow-xl"
          style={{
            // Below the pointer, not above it: above, the card covers the group
            // label the cell belongs to, which is the one thing you need to read.
            left: Math.min(hover.x + 14, Math.max(16, window.innerWidth - 300)),
            top: Math.min(hover.y + 22, Math.max(16, window.innerHeight - 84)),
          }}
        >
          {hover.item.title ?? "Untitled item"}
          <span className="mt-0.5 block text-[11px] opacity-70">
            {hover.item.ref ?? "-"} | {STATE_LABEL[stateOf(hover.item, today)]}
            {hover.item.projectName ? ` | ${hover.item.projectName}` : ""}
          </span>
        </div>
      ) : null}

      <ItemDrawer item={openItem} today={today} onClose={() => setOpenItem(null)} />
    </section>
  );
}

function uniqueReports(items: DashboardItem[]): string[] {
  return Array.from(new Set(items.map((item) => item.reportId)));
}
