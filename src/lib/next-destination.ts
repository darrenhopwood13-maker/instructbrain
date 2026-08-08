/**
 * Where a visitor should land after signing up. Only a small allow-list of
 * internal screens is accepted, so the parameter can never bounce someone
 * off-site.
 */
export const NEXT_DESTINATIONS = ["/reports/new", "/reports/quick", "/projects"] as const;

export type NextDestination = (typeof NEXT_DESTINATIONS)[number];

export function safeNext(value: unknown): NextDestination | undefined {
  return typeof value === "string" && (NEXT_DESTINATIONS as readonly string[]).includes(value)
    ? (value as NextDestination)
    : undefined;
}
