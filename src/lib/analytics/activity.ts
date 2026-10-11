/**
 * The activity feed: what has actually happened to the account's items.
 *
 * Built on `audit_log`, which already records every lifecycle transition with its
 * actor. None of this is derived from anything the dashboard guesses: if a row is
 * here, something happened, and if nothing has happened the feed is empty rather
 * than filled with a placeholder.
 *
 * Two subjects matter to a site manager above all others, and the feed leads with
 * them:
 *
 * - **reported_fixed** - the trade says the work is done and uploads a close-out
 *   photograph. Not yet closed; it is waiting on a surveyor to look.
 * - **closed_out** - a surveyor checked it on site and closed it.
 *
 * The distinction is the whole point of the lifecycle, so the feed never blurs
 * them into "completed": one is a claim, the other is a verification.
 */

export type ActivityKind =
  | "reported_fixed"
  | "closed_out"
  | "rejected"
  | "progress"
  | "report_event"
  | "item_edit"
  | "other";

/** The joined facts about what an event is about. Resolved by the query, not here. */
export type ActivitySubject = {
  findingRef: string | null;
  findingTitle: string | null;
  reportId: string | null;
  reportRef: string | null;
  reportTitle: string | null;
  projectName: string | null;
  /** Storage path of a close-out photograph, when the event carried one. */
  evidencePath: string | null;
};

export type ActivityRow = {
  id: string;
  action: string;
  at: string;
  actorName: string | null;
  before: unknown;
  after: unknown;
  subject: ActivitySubject;
};

export type ActivityEvent = ActivityRow & {
  kind: ActivityKind;
  /** The thing the person did, phrased to follow their name: "Dal closed out…" */
  verb: string;
  /** The lifecycle state they moved it to, as a label, when it was a transition. */
  toState: string | null;
  /** True for the two events a close-out feed exists for. */
  isCloseOut: boolean;
};

const LIFECYCLE_LABELS: Record<string, string> = {
  open: "open",
  assigned: "allocated",
  in_progress: "in progress",
  fixed: "marked fixed",
  verified: "closed out",
  rejected: "rejected",
};

/** The lifecycle state a transition landed on, read out of the `after` payload. */
export function toLifecycleState(after: unknown): string | null {
  if (!after || typeof after !== "object") return null;
  const value = (after as Record<string, unknown>)["lifecycle_state"];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * What kind of event this is.
 *
 * Reads the *landing* state rather than the action name alone, because the same
 * action carries every transition.
 */
export function kindOf(action: string, after: unknown): ActivityKind {
  if (action === "lifecycle.transition") {
    switch (toLifecycleState(after)) {
      case "fixed":
        return "reported_fixed";
      case "verified":
        return "closed_out";
      case "rejected":
        return "rejected";
      default:
        return "progress";
    }
  }
  if (action.startsWith("report.")) return "report_event";
  if (action === "finding.update") return "item_edit";
  return "other";
}

/** How the actor's name is followed in the feed. */
export function verbFor(action: string, after: unknown): string {
  if (action === "lifecycle.transition") {
    const state = toLifecycleState(after);
    switch (state) {
      case "fixed":
        return "reported fixed";
      case "verified":
        return "closed out";
      case "rejected":
        return "sent back";
      case "in_progress":
        return "started work on";
      case "assigned":
        return "allocated";
      case "open":
        return "reopened";
      default:
        return "updated";
    }
  }
  if (action === "report.issue") return "issued";
  if (action === "report.reopen") return "reopened";
  if (action === "report.share_created") return "shared";
  if (action === "finding.update") return "edited";
  if (action === "finding.photo_region") return "marked up a photograph for";
  if (action === "finding.allocate") return "allocated";
  // An action nobody has taught this file about still renders as something,
  // rather than an empty row: show the last segment, humanised.
  return action.split(".").pop()?.replace(/[_-]+/g, " ") ?? "updated";
}

/** The lifecycle label for a state, so the feed does not invent its own wording. */
export function lifecycleLabel(state: string | null): string | null {
  return state ? (LIFECYCLE_LABELS[state] ?? state) : null;
}

export type ActivityFeed = {
  events: ActivityEvent[];
  /** Every close-out event found, before the display cap. */
  closeOutTotal: number;
  /** How many rows were read, so the caller can tell a cap from a quiet account. */
  total: number;
  truncated: boolean;
};

/**
 * Shape audit rows into feed events.
 *
 * Newest first, capped for display, and capped honestly: `closeOutTotal` counts
 * every close-out found, so the panel can say "showing 20 of 34" instead of
 * implying the account is quieter than it is.
 */
export function activityFrom(
  rows: ActivityRow[],
  options: { limit?: number } = {},
): ActivityFeed {
  const limit = options.limit ?? 20;
  const all = rows
    .map((row) => {
      const kind = kindOf(row.action, row.after);
      return {
        ...row,
        kind,
        verb: verbFor(row.action, row.after),
        toState: lifecycleLabel(toLifecycleState(row.after)),
        isCloseOut: kind === "reported_fixed" || kind === "closed_out",
      };
    })
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const closeOutTotal = all.filter((event) => event.isCloseOut).length;
  // Close-outs lead: an account with one closure and 40 edits should open on the
  // closure, not on whichever edit happened to be newest.
  const ordered = [
    ...all.filter((event) => event.isCloseOut),
    ...all.filter((event) => !event.isCloseOut),
  ];

  return {
    events: ordered.slice(0, limit),
    closeOutTotal,
    total: all.length,
    truncated: ordered.length > limit,
  };
}
