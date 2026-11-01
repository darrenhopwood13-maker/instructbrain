import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Always-visible, non-dismissible upload state for the field cockpit.
 *
 * It only DISPLAYS state handed to it - it does not queue or retry anything itself; the
 * retry comes from the photo panel, which still holds the files. Four states, each said in
 * words as well as colour:
 *
 *   Queued     waiting while the device reports no signal
 *   Uploading  in flight
 *   Synced     everything chosen has reached storage
 *   Failed     ran out of attempts - with a retry that re-pushes only those objects
 *
 * The failed state used to be invisible: a photograph that never arrived simply left the
 * counter one short, and the person on site had no way to know or to fix it.
 */
export function FieldSyncPill({
  uploaded,
  pending,
  failed = 0,
  onRetry,
}: {
  /** Photographs saved against the report. */
  uploaded: number;
  /** Uploads not yet finished (queued or in flight). */
  pending: number;
  /** Uploads that ran out of attempts. */
  failed?: number;
  /** Re-pushes the failed objects, and nothing else. */
  onRetry?: (() => void) | undefined;
}) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const queued = online ? 0 : pending;
  const uploading = online ? pending : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-2 text-base shadow-raised"
    >
      {failed > 0 ? (
        <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-destructive">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">
            {failed} photo{failed === 1 ? "" : "s"} did not upload
          </span>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-9 gap-1.5 px-2.5 text-sm"
              onClick={onRetry}
            >
              <RotateCw aria-hidden="true" className="size-3.5" />
              Retry
            </Button>
          ) : null}
        </span>
      ) : (
        <>
          {uploading > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
              Uploading {uploading}
            </span>
          ) : null}
          {queued > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-warn">
              <CloudOff aria-hidden="true" className="size-4 shrink-0" />
              {queued} queued — no signal
            </span>
          ) : null}
          {uploading === 0 && queued === 0 ? (
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-pass" />
              All synced
            </span>
          ) : null}
        </>
      )}
      <span className="text-muted-foreground">
        {uploaded} photo{uploaded === 1 ? "" : "s"} saved
      </span>
    </div>
  );
}
