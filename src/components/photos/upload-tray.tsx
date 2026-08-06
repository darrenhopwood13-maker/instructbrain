import { AlertTriangle, Check, Clock, ImageOff, RefreshCw, X } from "lucide-react";
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

const stateLabels: Record<UploadItem["state"], string> = {
  queued: "Waiting",
  running: "Uploading",
  done: "Uploaded",
  error: "Failed",
  cancelled: "Cancelled",
  skipped: "Already uploaded",
};

function StateIcon({ state }: { state: UploadItem["state"] }) {
  if (state === "done" || state === "skipped")
    return <Check aria-hidden="true" className="size-4 text-pass" />;
  if (state === "error") return <X aria-hidden="true" className="size-4 text-fail" />;
  if (state === "cancelled")
    return <ImageOff aria-hidden="true" className="size-4 text-muted-foreground" />;
  return <Clock aria-hidden="true" className="size-4 text-muted-foreground" />;
}

/**
 * Per-file and overall upload state. A failure is always visible and always
 * has a retry — a silent failed upload is how a photograph goes missing.
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
  const finished = items.filter((item) => item.state === "done" || item.state === "skipped");
  const active = items.length - finished.length - failed.length;

  return (
    <section
      aria-label="Upload progress"
      className="rounded-xl border border-border bg-surface-raised p-4 shadow-raised"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h3 className="editorial-title truncate text-base font-semibold">
            {active > 0 ? "Uploading photographs" : "Upload complete"}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {finished.length} of {items.length} stored
            {failed.length > 0 ? ` · ${failed.length} failed` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {failed.length > 0 ? (
            <Button variant="brand" size="sm" onClick={onRetryAll}>
              <RefreshCw aria-hidden="true" />
              Retry {failed.length}
            </Button>
          ) : null}
          {active === 0 ? (
            <Button variant="quiet" size="sm" onClick={onDismiss}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <Progress
        value={Math.round(overall * 100)}
        className="mt-3"
        aria-label={`Overall upload progress: ${Math.round(overall * 100)} percent`}
      />

      {failed.length > 0 ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-fail bg-fail-soft p-2.5 text-sm text-fail">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {failed.length} photograph{failed.length === 1 ? "" : "s"} did not reach storage. They
            are not in the report until they are retried successfully.
          </span>
        </p>
      ) : null}

      <ul className="mt-3 max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {items.map((item) => (
          <li key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-2.5">
            <StateIcon state={item.state} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {stateLabels[item.state]} · {item.sizeLabel}
                {item.state === "running" ? ` · ${Math.round(item.progress * 100)}%` : ""}
                {item.error ? ` · ${item.error}` : ""}
              </p>
            </div>
            {item.state === "error" ? (
              <Button variant="quiet" size="sm" onClick={() => onRetry(item.id)}>
                Retry
              </Button>
            ) : (
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(item.progress * 100)}%
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
