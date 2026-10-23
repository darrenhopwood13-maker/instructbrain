/**
 * Street-level imagery, from Mapillary.
 *
 * Chosen for the licence as much as the price: captures are CC BY-SA, so a photograph
 * can be kept and printed inside a client report with attribution, which Google's terms
 * do not allow. The token is read here, on the server, and never reaches the browser -
 * a `VITE_` prefixed key is baked into the bundle and anyone could lift it and spend
 * the quota. This module is server-only for that reason.
 *
 * The lookup is deliberately narrow: the newest capture within a small box around the
 * project point. A street view that quietly shows a different street is worse than no
 * street view, so "nothing near here" is a first-class answer and is said out loud.
 */

const GRAPH = "https://graph.mapillary.com/images";

/** About 50m of longitude at UK latitudes, and a little less of latitude. */
const BOX_DEGREES_LNG = 0.00045;
const BOX_DEGREES_LAT = 0.0003;

const FIELDS = "id,thumb_1024_url,captured_at,compass_angle";

export type StreetLevelResult =
  | { state: "not_configured" }
  | { state: "none" }
  | { state: "unavailable"; reason: string }
  | {
      state: "ok";
      imageId: string;
      imageUrl: string;
      /** yyyy-mm-dd, or null when Mapillary did not say. */
      capturedAt: string | null;
    };

type FetchJson = (url: string) => Promise<{ status: number; body: unknown }>;

/** The token, trimmed, or undefined. Never logged, never returned to a caller. */
export function mapillaryToken(): string | undefined {
  if (typeof process === "undefined") return undefined;
  const raw = process.env?.["MAPILLARY_TOKEN"];
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function streetLevelConfigured(): boolean {
  return mapillaryToken() !== undefined;
}

async function graphFetch(url: string): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupStreetImage(
  latitude: number,
  longitude: number,
  fetchJson: FetchJson = graphFetch,
  token: string | undefined = mapillaryToken(),
): Promise<StreetLevelResult> {
  if (!token) return { state: "not_configured" };

  const bbox = [
    longitude - BOX_DEGREES_LNG,
    latitude - BOX_DEGREES_LAT,
    longitude + BOX_DEGREES_LNG,
    latitude + BOX_DEGREES_LAT,
  ].join(",");

  const url =
    `${GRAPH}?access_token=${encodeURIComponent(token)}` +
    `&fields=${FIELDS}&limit=1&bbox=${encodeURIComponent(bbox)}`;

  let response: { status: number; body: unknown };
  try {
    response = await fetchJson(url);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { state: "unavailable", reason: `Mapillary could not be reached: ${reason}` };
  }

  if (response.status === 401 || response.status === 403) {
    // The token is wrong, revoked or scoped for something else. Say which, because
    // "no imagery here" would send someone looking at the map instead of the key.
    return { state: "unavailable", reason: "Mapillary rejected the access token." };
  }
  if (response.status === 429) {
    return { state: "unavailable", reason: "Mapillary is rate limiting this token. Try again shortly." };
  }
  if (response.status < 200 || response.status >= 300) {
    return { state: "unavailable", reason: `Mapillary answered ${response.status}.` };
  }

  const parsed = response.body as {
    data?: Array<{ id?: string; thumb_1024_url?: string; captured_at?: number }>;
  } | null;
  const image = parsed?.data?.[0];
  if (!image?.id || !image.thumb_1024_url) return { state: "none" };

  const captured =
    typeof image.captured_at === "number" ? new Date(image.captured_at).toISOString().slice(0, 10) : null;

  return {
    state: "ok",
    imageId: image.id,
    imageUrl: image.thumb_1024_url,
    capturedAt: captured,
  };
}
