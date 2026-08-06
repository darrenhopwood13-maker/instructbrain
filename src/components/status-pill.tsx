import { cn } from "@/lib/utils";
import {
  statusLabels,
  reportStatusLabels,
  type FindingStatus,
  type ReportStatus,
} from "@/lib/mock-data";

const findingStyles: Record<FindingStatus, string> = {
  pass: "bg-pass-soft text-pass border-pass/25",
  fail: "bg-fail-soft text-fail border-fail/25",
  warn: "bg-warn-soft text-warn border-warn/25",
  flag: "bg-flag-soft text-flag border-flag/25",
};

const findingGlyph: Record<FindingStatus, string> = {
  pass: "✓",
  fail: "✕",
  warn: "!",
  flag: "◆",
};

/** Status is never colour-only: every pill carries a glyph and a text label. */
export function StatusPill({
  status,
  className,
}: {
  status: FindingStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        findingStyles[status],
        className,
      )}
    >
      <span aria-hidden="true" className="text-[0.7em] leading-none">
        {findingGlyph[status]}
      </span>
      {statusLabels[status]}
    </span>
  );
}

const reportStyles: Record<ReportStatus, string> = {
  draft: "bg-surface-sunken text-muted-foreground border-border",
  in_review: "bg-brand-purple-soft text-brand-purple-ink border-brand-purple/25",
  issued: "bg-brand-blue-soft text-brand-blue-ink border-brand-blue/25",
};

export function ReportStatusPill({ status }: { status: ReportStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        reportStyles[status],
      )}
    >
      {reportStatusLabels[status]}
    </span>
  );
}
