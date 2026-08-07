/**
 * Close-out lifecycle.
 *
 * Applies only where the report's survey type definition sets
 * `requiresLifecycle: true`. A record showing a hazard identified and nothing
 * done is worse than no record, so the states are explicit and every
 * transition is written to the audit log by the caller.
 */

export type LifecycleState =
  | "open"
  | "assigned"
  | "in_progress"
  | "fixed"
  | "verified"
  | "rejected";

export const LIFECYCLE_STATES: LifecycleState[] = [
  "open",
  "assigned",
  "in_progress",
  "fixed",
  "verified",
  "rejected",
];

export const lifecycleLabels: Record<LifecycleState, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In progress",
  fixed: "Marked fixed",
  verified: "Verified closed",
  rejected: "Rejected — reopened",
};

export const lifecycleDescriptions: Record<LifecycleState, string> = {
  open: "Raised and awaiting a trade assignment.",
  assigned: "Assigned to a trade and awaiting a start.",
  in_progress: "The trade has started the remedial work.",
  fixed: "The trade says the work is complete and is awaiting verification.",
  verified: "Checked on site and closed.",
  rejected: "Checked and not accepted. The item is open again.",
};

/** Unknown persisted values resolve to `open`, never to a closed state. */
export function coerceLifecycleState(value: unknown): LifecycleState {
  return typeof value === "string" && LIFECYCLE_STATES.includes(value as LifecycleState)
    ? (value as LifecycleState)
    : "open";
}

/** True once the item needs no further action. */
export function isClosed(state: unknown): boolean {
  return coerceLifecycleState(state) === "verified";
}

/** Transitions a subcontractor may make from their token-scoped link. */
const SUBCONTRACTOR_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  open: ["in_progress", "fixed"],
  assigned: ["in_progress", "fixed"],
  in_progress: ["fixed"],
  fixed: ["in_progress"],
  verified: [],
  rejected: ["in_progress", "fixed"],
};

/** Transitions a surveyor or site manager may make from inside the app. */
const REVIEWER_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  open: ["assigned", "in_progress", "fixed", "verified", "rejected"],
  assigned: ["open", "in_progress", "fixed", "verified", "rejected"],
  in_progress: ["open", "fixed", "verified", "rejected"],
  fixed: ["verified", "rejected", "in_progress"],
  verified: ["rejected"],
  rejected: ["open", "assigned", "in_progress", "fixed"],
};

export type Actor = "subcontractor" | "reviewer";

export function allowedTransitions(from: unknown, actor: Actor): LifecycleState[] {
  const state = coerceLifecycleState(from);
  return (actor === "subcontractor" ? SUBCONTRACTOR_TRANSITIONS : REVIEWER_TRANSITIONS)[state];
}

export function canTransition(from: unknown, to: unknown, actor: Actor): boolean {
  return allowedTransitions(from, actor).includes(coerceLifecycleState(to));
}

export class LifecycleTransitionError extends Error {
  constructor(from: LifecycleState, to: LifecycleState, actor: Actor) {
    super(
      `An item that is "${lifecycleLabels[from]}" cannot be moved to "${lifecycleLabels[to]}" ` +
        `${actor === "subcontractor" ? "from a trade link" : "by a reviewer"}.`,
    );
    this.name = "LifecycleTransitionError";
  }
}

export function assertTransition(from: unknown, to: unknown, actor: Actor): LifecycleState {
  const previous = coerceLifecycleState(from);
  const next = coerceLifecycleState(to);
  if (!canTransition(previous, next, actor)) {
    throw new LifecycleTransitionError(previous, next, actor);
  }
  return next;
}

/** Rejection must carry a reason: an unexplained rejection helps nobody. */
export function requiresReason(to: unknown): boolean {
  return coerceLifecycleState(to) === "rejected";
}

/** Assignment moves an untouched item forward without disturbing later states. */
export function stateAfterAssignment(current: unknown): LifecycleState {
  const state = coerceLifecycleState(current);
  return state === "open" ? "assigned" : state;
}
