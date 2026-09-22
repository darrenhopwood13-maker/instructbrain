/**
 * A dropped site signal surfaces as a bare browser "Failed to fetch". That
 * tells someone on a roof nothing, and the work they just did must not be
 * thrown away because of a two-second dead spot.
 */

const NETWORK_PATTERNS =
  /failed to fetch|networkerror|network request failed|load failed|connection lost|fetch failed|timed out|timeout/i;

export function isNetworkFailure(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name ?? "";
  const code = (error as { code?: string } | null)?.code ?? "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (name === "TypeError" && /fetch/i.test(message)) return true;
  if (code === "network_error") return true;
  return NETWORK_PATTERNS.test(`${name} ${code} ${message}`);
}

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export const OFFLINE_MESSAGE =
  "Your phone has no connection right now. Your photographs are still held — press Try again once you have signal.";

export const NETWORK_MESSAGE =
  "We could not reach the service. Your photographs are still held — press Try again.";

/** Plain English for a failure while starting a report. */
export function describeStartFailure(error: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkFailure(error)) return NETWORK_MESSAGE;
  return error instanceof Error && error.message.trim() !== ""
    ? error.message
    : "That did not work. Please try again.";
}

/**
 * Retries only connection failures. A plan limit, a permission refusal or any
 * other answer from the server is returned to the caller untouched.
 */
export async function withNetworkRetry<T>(
  run: () => Promise<T>,
  options: { retries?: number; delayMs?: number; wait?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const delayMs = options.delayMs ?? 400;
  const wait =
    options.wait ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let attempt = 0;
  for (;;) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= retries || !isNetworkFailure(error) || isOffline()) throw error;
      attempt += 1;
      await wait(delayMs * attempt);
    }
  }
}
