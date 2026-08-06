import { cn } from "@/lib/utils";
import { reportStatusLabels, type ReportStatus } from "@/lib/mock-data";
import type { StatusDefinition, StatusTone } from "@/lib/survey-types";

const toneStyles: Record<StatusTone, string> = {
  pass: "bg-pass-soft text-pass border-pass/25",
  fail: "bg-fail-soft text-fail border-fail/25",
  warn: "bg-warn-soft text-warn border-warn/25",
  flag: "bg-flag-soft text-flag border-flag/40",
  neutral: "bg-surface-sunken text-muted-foreground border-border",
};

const toneGlyph: Record<StatusTone, string> = {
  pass: "✓",
  fail: "✕",
  warn: "!",
  flag: "?",
  neutral: "–",
};


/**
 * Status is never colour-only: every pill carries a glyph and the label from
 * the survey type definition. No status id is hardcoded here.
 */
export function StatusPill({
  status,
  className,
}: {
  status: StatusDefinition;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        toneStyles[status.tone] ?? toneStyles.neutral,
        className,
      )}
    >
      <span aria-hidden="true" className="text-[0.7em] leading-none">
        {toneGlyph[status.tone] ?? toneGlyph.neutral}
      </span>
      {status.label}
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
