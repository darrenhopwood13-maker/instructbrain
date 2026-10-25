import { ArrowRight, Camera, ClipboardCheck } from "lucide-react";

import type { ControlRoomTotals } from "@/lib/analytics/control-room";

/**
 * The dashboard's two ways in and its five figures, sitting on the map.
 *
 * The dashboard's whole job was "what do I do now, and how is it going" - both of which
 * belong where the work is, not on a separate page you have to remember to visit. Open
 * items and overdue carry tone because they are the two a site manager reads first; the
 * rest stay plain so nothing shouts at once.
 */
export function EstateStrip({
  totals,
  onStart,
  onCompliance,
  onOpenEstate,
  tuckedAway = false,
}: {
  totals: ControlRoomTotals | null;
  /** Omitted for someone who reviews the estate but does not start work on it. */
  onStart?: (() => void) | undefined;
  onCompliance?: (() => void) | undefined;
  onOpenEstate: () => void;
  /** True while a project card is open on a phone: one card at a time, and the card wins. */
  tuckedAway?: boolean;
}) {
  const figures: Array<{ label: string; value: number | null; tone: "brand" | "fail" | null }> = [
    { label: "Reports", value: totals?.reports ?? null, tone: null },
    { label: "Open items", value: totals?.openItems ?? null, tone: "brand" },
    { label: "Overdue", value: totals?.overdue ?? null, tone: totals && totals.overdue > 0 ? "fail" : null },
    { label: "Nobody has assessed", value: totals?.notAssessed ?? null, tone: null },
    { label: "No trade on them", value: totals?.unallocated ?? null, tone: null },
  ];

  return (
    <div
      data-estate-strip=""
      className={
        "pointer-events-none absolute inset-x-0 bottom-0 z-10 p-2 sm:p-3 " +
        (tuckedAway ? "hidden sm:block" : "")
      }
    >
      <div className="pointer-events-auto flex flex-col gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-lg backdrop-blur sm:flex-row sm:items-stretch sm:gap-2.5 sm:p-2.5">
        {onStart || onCompliance ? (
        <div className="flex gap-2">
          {onStart ? (
          <button
            type="button"
            onClick={onStart}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-accent-ink px-3 text-[13px] font-bold text-white transition-opacity hover:opacity-90 sm:flex-none"
          >
            <Camera aria-hidden="true" className="size-4" />
            Start a report
          </button>
          ) : null}
          {onCompliance ? (
          <button
            type="button"
            onClick={onCompliance}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] font-bold transition-colors hover:border-brand-accent sm:flex-none"
          >
            <ClipboardCheck aria-hidden="true" className="size-4" />
            Compliance
          </button>
          ) : null}
        </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <dl className="grid grid-cols-3 gap-x-2 gap-y-1 sm:grid-cols-5">
            {figures.map((figure) => (
              <div key={figure.label} className="min-w-0 px-1">
                <dd
                  className={
                    "text-base font-bold tabular-nums leading-tight " +
                    (figure.tone === "brand"
                      ? "text-brand-accent-ink"
                      : figure.tone === "fail"
                        ? "text-fail"
                        : "text-foreground")
                  }
                >
                  {figure.value === null ? "—" : figure.value}
                </dd>
                <dt className="mt-0.5 text-[9px] font-semibold uppercase leading-[1.2] tracking-[0.05em] text-muted-foreground">
                  {figure.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        <button
          type="button"
          onClick={onOpenEstate}
          className="flex min-h-11 items-center justify-center gap-1 rounded-lg border border-border px-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:border-brand-accent hover:text-foreground"
        >
          Estate
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
