import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataError } from "@/lib/data";

/** Loading is stated, not implied by a blank area. */
export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-5 py-8 text-sm text-muted-foreground"
    >
      <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-brand-blue" />
      {label}
    </div>
  );
}

/**
 * A failed read explains itself. The Postgres message — including an RLS
 * rejection — is shown verbatim rather than replaced with a generic apology.
 */
export function ErrorState({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry?: () => void;
}) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error.";
  const hint = error instanceof DataError ? error.hint : undefined;
  const code = error instanceof DataError ? error.code : undefined;

  return (
    <div
      role="alert"
      className="rounded-xl border border-fail/30 bg-fail-soft px-5 py-5 text-sm text-foreground"
    >
      <p className="flex items-center gap-2 font-semibold text-fail">
        <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
        {title}
      </p>
      <p className="mt-2 break-words font-mono text-xs leading-relaxed text-foreground/80">
        {message}
        {code ? ` (${code})` : ""}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      {onRetry ? (
        <Button variant="quiet" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
