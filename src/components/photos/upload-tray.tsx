import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export type UploadItem = {
  id: string;
  name: string;
  sizeLabel: string;
  state: "queued" | "running" | "done" | "error" | "cancelled" | "skipped";
  progress: number;
  error?: string;
};

/**
 * Upload progress, kept to a thin bar and a count — 3/25, 4/25, 5/25.
 *
 * A photograph that fails to reach storage is not in the report, so a failure
 * is the one thing that still gets words and a retry. Everything else about a
 * healthy upload is noise on a phone held one-handed on site, so it is not
 * shown: no heading, no per-file list, no details to open.
 */
export function UploadTray({
  items,
  overall,
  onRetry,
  onRetryAll,
  onDismiss,
}: {
  items: UploadItem[];
  overall: number;
  onRetry: (id: string) => void;
  onRetryAll: () => void;
  onDismiss: () => void;
}) {
  if (items.length === 0) return null;

  const failed = items.filter((item) => item.state === "error");
  const stored = items.filter(
    (item) => item.state === "done" || item.state === "skipped",
  ).length;
  const settled = items.length - stored - failed.length === 0;
  const percent = Math.round(overall * 100);

  return (
    <section aria-label="Upload progress" className="space-y-2">
      <div className="flex items-center gap-3">
        <Progress
          value={percent}
          className="h-1.5 flex-1 [&>div]:bg-brand-accent"
          aria-label={`Overall upload progress: ${percent} percent`}
        />
        <span
          aria-live="polite"
          className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground"
        >
          {stored}/{items.length}
        </span>
        {settled ? (
          <Button variant="ghost" size="sm" className="min-h-11 shrink-0 px-2" onClick={onDismiss}>
            Clear
          </Button>
        ) : null}
      </div>

      {failed.length > 0 ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fail">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          <span>
            {failed.length} of {items.length} did not reach storage. They are not in the report
            until they go again.
          </span>
          <Button
            variant="brand"
            size="sm"
            onClick={() => (failed.length === 1 ? onRetry(failed[0]!.id) : onRetryAll())}
          >
            {failed.length === 1 ? "Retry it" : `Retry ${failed.length}`}
          </Button>
        </p>
      ) : null}
    </section>
  );
}
