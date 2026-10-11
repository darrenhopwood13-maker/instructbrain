import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Camera, CheckCircle2, Undo2 } from "lucide-react";

import { ErrorState, LoadingState } from "@/components/query-states";
import { orgActivityQuery } from "@/lib/data";
import { activityFrom, type ActivityEvent } from "@/lib/analytics/activity";

/** "2 hours ago", "4 days ago". Coarse on purpose: this is a feed, not a log. */
function ago(at: string, now: number): string {
  const then = new Date(at).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * What someone did, and to what.
 *
 * The wording deliberately distinguishes a claim from a verification: a trade
 * reporting an item fixed is not the same fact as a surveyor closing it, and the
 * feed must never merge the two into "completed".
 */
function EventLine({ event, now }: { event: ActivityEvent; now: number }) {
  const { subject } = event;
  const who = event.actorName ?? "Someone";
  const what = subject.findingRef ?? subject.reportRef ?? "a report";
  const tone =
    event.kind === "closed_out"
      ? "text-brand-accent-ink"
      : event.kind === "rejected"
        ? "text-fail"
        : "text-foreground/75";

  return (
    <li className="flex min-w-0 flex-col gap-1 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm">
        {event.kind === "closed_out" ? (
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 self-center text-brand-accent-ink" />
        ) : event.kind === "rejected" ? (
          <Undo2 aria-hidden="true" className="size-4 shrink-0 self-center text-fail" />
        ) : event.kind === "reported_fixed" ? (
          <Camera aria-hidden="true" className="size-4 shrink-0 self-center text-muted-foreground" />
        ) : null}
        <span className="font-semibold">{who}</span>
        <span className={tone}>{event.verb}</span>
        <span className="font-medium">{what}</span>
        {subject.findingTitle ? (
          <span className="min-w-0 break-words text-muted-foreground">{subject.findingTitle}</span>
        ) : null}
        {subject.projectName ? (
          <span className="text-xs text-muted-foreground">· {subject.projectName}</span>
        ) : null}
        {/* Evidence is stated as a fact, never implied: an item marked fixed with
            no photograph says so, because that is the interesting part. */}
        {event.kind === "reported_fixed" ? (
          <span className="text-xs text-muted-foreground">
            {subject.evidencePath ? "· with a close-out photograph" : "· no photograph attached"}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 items-baseline gap-2 text-xs text-muted-foreground">
        {subject.reportId ? (
          <Link
            to="/reports/$id"
            params={{ id: subject.reportId }}
            className="min-h-6 font-medium underline-offset-4 hover:text-brand-accent-ink hover:underline"
          >
            Open report
          </Link>
        ) : null}
        <span>{ago(event.at, now)}</span>
      </span>
    </li>
  );
}

export function ActivityFeed({ organisationIds }: { organisationIds: string[] }) {
  const query = useQuery(orgActivityQuery(organisationIds));
  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);
  const feed = useMemo(() => activityFrom(rows), [rows]);
  // Captured once per render pass so every row in a list agrees about "now".
  const now = useMemo(() => Date.now(), []);

  return (
    <section aria-labelledby="activity-heading" className="mt-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="activity-heading" className="text-sm font-semibold">
          What&rsquo;s changed
        </h2>
        <span className="text-xs text-muted-foreground">
          {feed.closeOutTotal > 0
            ? `${feed.closeOutTotal} close-out ${feed.closeOutTotal === 1 ? "event" : "events"}, most recent first`
            : "every close-out on the account, as it happens"}
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface-raised">
        {query.isPending ? (
          <LoadingState label="Loading the activity…" />
        ) : query.isError ? (
          <ErrorState
            title="The activity could not be loaded"
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        ) : feed.events.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Nothing has been closed yet.</p>
            <p className="mt-1">
              When a trade reports an item fixed, or a surveyor closes one off, it appears
              here with who did it and the close-out photograph.
            </p>
          </div>
        ) : (
          <>
            <ul>
              {feed.events.map((event) => (
                <EventLine key={event.id} event={event} now={now} />
              ))}
            </ul>
            {feed.truncated ? (
              <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                Showing the {feed.events.length} most recent of {feed.total} events.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
