/**
 * The single source of truth for the application's public base URL.
 *
 * Every absolute URL the app generates — canonical tags, og:url, JSON-LD and
 * share links — is built from here. Override with VITE_SITE_URL when the app
 * is served from another host.
 */
const DEFAULT_SITE_URL = "https://instructbrain.com";

function readEnv(): string | undefined {
  try {
    return (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[
      "VITE_SITE_URL"
    ];
  } catch {
    return undefined;
  }
}

export const SITE_URL: string = (readEnv() || DEFAULT_SITE_URL).replace(/\/+$/, "");

/** Absolute URL for a path within the site, e.g. absoluteUrl("/shared/abc"). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
