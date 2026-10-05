import { useEffect, useState } from "react";
import { CheckCircle2, CloudOff, Loader2 } from "lucide-react";

/**
 * Always-visible, non-dismissible upload state for the field cockpit.
 *
 * It only DISPLAYS state handed to it — it does not queue, retry or store
 * anything. "Queued" means uploads are waiting while the device reports no
 * signal; "uploading" means they are in flight; "uploaded" is what the
 * report actually holds. Three distinct states, each with text, never colour
 * alone.
 */
export function FieldSyncPill({
  uploaded,
  pending,
}: {
  /** Photographs saved against the report. */
  uploaded: number;
  /** Uploads not yet finished (queued or in flight). */
  pending: number;
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
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-pass" />
        {uploaded} uploaded
      </span>
      {uploading > 0 ? (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
          {uploading} uploading
        </span>
      ) : null}
      {queued > 0 ? (
        <span className="inline-flex items-center gap-1.5 font-semibold text-warn">
          <CloudOff aria-hidden="true" className="size-4 shrink-0" />
          {queued} queued — no signal
        </span>
      ) : null}
      {pending === 0 && !online ? (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CloudOff aria-hidden="true" className="size-4 shrink-0" />
          No signal
        </span>
      ) : null}
    </div>
  );
}
