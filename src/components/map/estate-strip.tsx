import { ArrowRight, Camera, ClipboardCheck } from "lucide-react";

import type { ControlRoomTotals } from "@/lib/analytics/control-room";

/**
 * The dashboard's two ways in and its five figures, sitting on the map.
 *
 * The dashboard's whole job was "what do I do now, and how is it going" - both of which
 * belong where the work is, not on a separate page you have to remember to visit. Open
 * items and overdue carry tone because they are the two a site manager reads first; the
 * rest stay plain so nothing shouts at once.
 *
 * On a phone this was eating 218px of a 539px map - forty per cent of the map hidden behind
 * a dashboard. It is now one band: the two actions on one row, the five figures on one row
 * beneath them, and no "Estate" button, because the ESTATE tab sits directly below it and
 * always did (Dal, 25 Oct 2026: "we need to optimize the map view on smart phone").
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
        "pointer-events-none absolute inset-x-0 bottom-0 z-10 p-1.5 sm:p-3 " +
        (tuckedAway ? "hidden sm:block" : "")
      }
    >
      <div className="pointer-events-auto flex flex-col gap-1.5 rounded-xl border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur sm:flex-row sm:items-stretch sm:gap-2.5 sm:p-2.5">
        {onStart || onCompliance ? (
        <div className="flex gap-1.5 sm:gap-2">
          {onStart ? (
          <button
            type="button"
            onClick={onStart}
            className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-accent-ink px-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90 sm:min-h-11 sm:flex-none sm:gap-2 sm:px-3 sm:text-[13px]"
          >
            <Camera aria-hidden="true" className="size-4" />
            Start a report
          </button>
          ) : null}
          {onCompliance ? (
          <button
            type="button"
            onClick={onCompliance}
            className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 text-[12px] font-bold transition-colors hover:border-brand-accent sm:min-h-11 sm:flex-none sm:gap-2 sm:px-3 sm:text-[13px]"
          >
            <ClipboardCheck aria-hidden="true" className="size-4" />
            Compliance
          </button>
          ) : null}
        </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <dl className="grid grid-cols-5 gap-x-1 gap-y-0 sm:gap-x-2">
            {figures.map((figure) => (
              <div key={figure.label} className="min-w-0 px-0.5 sm:px-1">
                <dd
                  className={
                    "text-sm font-bold tabular-nums leading-tight sm:text-base " +
                    (figure.tone === "brand"
                      ? "text-brand-accent-ink"
                      : figure.tone === "fail"
                        ? "text-fail"
                        : "text-foreground")
                  }
                >
                  {figure.value === null ? "—" : figure.value}
                </dd>
                <dt className="mt-0.5 text-[8px] font-semibold uppercase leading-[1.15] tracking-[0.03em] text-muted-foreground sm:text-[9px] sm:tracking-[0.05em]">
                  {figure.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>

        {/* On a phone the ESTATE tab is right underneath this card, so this button was a
            second door to the same room. It stays from the sm breakpoint, where the panel
            sits alongside the map instead. */}
        <button
          type="button"
          onClick={onOpenEstate}
          className="hidden min-h-11 items-center justify-center gap-1 rounded-lg border border-border px-2.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:border-brand-accent hover:text-foreground sm:flex"
        >
          Estate
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
