import type { AnswerSheetGroup } from "@/lib/reporting/answer-pdf";

/**
 * The visual form of an answer: one bar per group, navy for open work, red for the part of it that
 * is past its date. Bars are scaled against the largest group, so "nineteen items, nine of them
 * late" reads as a shape before it reads as a number.
 *
 * Deliberately the same numbers as the cards above it and the PDF beside it - one comparison
 * object, three ways of reading it, never a fourth calculation.
 */
export function AnswerVisual({ groups }: { groups: AnswerSheetGroup[] }) {
  const peak = Math.max(1, ...groups.map((group) => group.items));

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Past their date, against the work
      </p>
      <div className="mt-2 space-y-2.5">
        {groups.map((group) => {
          const openWidth = Math.max((group.open / peak) * 100, group.open > 0 ? 2 : 0);
          const lateWidth = Math.max((group.overdue / peak) * 100, group.overdue > 0 ? 1.5 : 0);
          return (
            <div key={group.label}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[11.5px] font-semibold">{group.label}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {group.open} open · {group.overdue} late
                  {group.lateShare === null ? "" : ` (${group.lateShare}%)`}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-sm bg-muted">
                <div className="relative h-full" style={{ width: `${openWidth}%` }}>
                  <div className="absolute inset-0 bg-[#24417b]" />
                  <div className="absolute inset-y-0 left-0 bg-[#b82424]" style={{ width: `${(lateWidth / Math.max(openWidth, 0.001)) * 100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground">
        Navy is open work, red is the part of it past its date.
      </p>
    </div>
  );
}
