/**
 * A dead key on the second-opinion provider is worth discovering once, not once per
 * photograph.
 *
 * Escalation is the optional tier. When its key is rejected, every escalated
 * photograph pays a round trip to learn the same thing, and the failure is recorded
 * against that photograph only - so the report silently loses its second opinion and
 * nothing anywhere says why. This remembers the rejection for a short window so the
 * rest of the run skips the attempt.
 *
 * Serverless instances are short-lived, so the window is measured in minutes and the
 * state is per-instance: it cannot go stale in a way that matters.
 */
export const ESCALATION_AUTH_COOLDOWN_MS = 10 * 60 * 1000;

let failedAt = 0;

/** A rejected credential, as opposed to a rate limit, a timeout or a bad request. */
export function isAuthFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return /\b401\b|unauthori[sz]ed|invalid_api_key|incorrect api key|authentication/i.test(message);
}

export function noteEscalationAuthFailure(
  error: string | null | undefined,
  now: number = Date.now(),
): void {
  if (isAuthFailure(error)) failedAt = now;
}

export function escalationSkippedBecauseAuth(now: number = Date.now()): boolean {
  return failedAt > 0 && now - failedAt < ESCALATION_AUTH_COOLDOWN_MS;
}

/** For tests only. */
export function resetEscalationGuard(): void {
  failedAt = 0;
}
