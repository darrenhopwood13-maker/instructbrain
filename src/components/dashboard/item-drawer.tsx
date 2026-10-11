import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { X } from "lucide-react";

import { STATE_LABEL, stateOf, type DashboardItem } from "@/lib/analytics/item-map";
import { dueLine } from "@/lib/analytics/ledger";

/**
 * The record behind one square.
 *
 * Every action here is real: the report link navigates, nothing is a placeholder.
 * A drawer with a button that does nothing is worse than a drawer with no button.
 */
export function ItemDrawer({
  item,
  today,
  onClose,
}: {
  item: DashboardItem | null;
  today: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!item) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [item, onClose]);

  if (!item) return null;

  const state = STATE_LABEL[stateOf(item, today)];

  return (
    <>
      <button
        type="button"
        aria-label="Close the item"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Item ${item.ref ?? ""}`}
        className="fixed inset-y-0 right-0 z-50 flex w-[min(440px,92vw)] flex-col border-l border-border bg-surface-raised shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <span className="inline-block rounded border border-border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {state}
            </span>
            <h2 className="mt-2 text-lg font-semibold leading-snug">{item.title ?? "Untitled item"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <dl className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
            <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Reference</dt>
            <dd className="font-mono text-[13px]">{item.ref ?? "-"}</dd>

            <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Report</dt>
            <dd>{item.reportTitle ?? item.reportRef ?? "-"}</dd>

            <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Project</dt>
            <dd>{item.projectName ?? "No project"}</dd>

            <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Survey</dt>
            <dd>{item.surveyLabel ?? "Unclassified"}</dd>

            <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">State</dt>
            <dd>{state}</dd>

            <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Date</dt>
            <dd>{dueLine(item, today)}</dd>

            <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Trade</dt>
            <dd>{item.assignedTrade ?? "Not allocated"}</dd>

            <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Raised</dt>
            <dd className="font-mono text-[13px]">{item.reportDate ?? "-"}</dd>
          </dl>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          <Link
            to="/reports/$id"
            params={{ id: item.reportId }}
            search={{ tab: "review" }}
            className="min-h-11 flex-1 rounded-lg bg-brand-blue px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Open the report
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg border border-border px-4 py-3 text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
