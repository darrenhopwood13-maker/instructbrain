/**
 * Street-level imagery for the map, in two providers and one answer.
 *
 * Google first: it covers nearly every street in the UK and its capture dates are recent,
 * which is what a site manager actually needs before a visit. Mapillary behind it, because
 * it is free and its captures are CC BY-SA, so a photograph can be kept and printed inside
 * a client report with attribution - Google's terms do not allow that. The free provider is
 * the safety net, not the headline, because its UK coverage outside cities is thin.
 *
 * Neither token reaches the browser: Mapillary's is read here from MAPILLARY_TOKEN, and the
 * Google image is fetched as bytes server-side and handed over as a data URL, so no key
 * appears in a URL a user could copy. A `VITE_` prefixed key would be baked into the bundle
 * and anyone could spend the quota. This module is server-only for that reason.
 *
 * The lookup is deliberately narrow: the nearest capture to the project point, and "nothing
 * near here" is a first-class answer, said out loud. A street view that quietly shows a
 * different street is worse than no street view.
 */

import { lookupGoogleStreetView, type GoogleStreetView } from "@/lib/map/google-maps.server";

const GRAPH = "https://graph.mapillary.com/images";

/**
 * About 120m either side of the point, which is a city block rather than a district.
 * The first version searched 50m and found nothing on a street in Mayfair with plenty
 * of coverage, because capture points sit where the camera vehicle drove, not on the
 * doorstep. 120m still answers "what does this site look like", and the pane says so.
 */
const BOX_DEGREES_LNG = 0.0017;
const BOX_DEGREES_LAT = 0.0011;

/** Ten candidates, newest kept. `limit=1` returns whichever the service feels like. */
const CANDIDATES = 10;

const FIELDS = "id,thumb_1024_url,captured_at,compass_angle";

export type MapillaryLookup =
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
): Promise<MapillaryLookup> {
  if (!token) return { state: "not_configured" };

  const bbox = [
    longitude - BOX_DEGREES_LNG,
    latitude - BOX_DEGREES_LAT,
    longitude + BOX_DEGREES_LNG,
    latitude + BOX_DEGREES_LAT,
  ].join(",");

  const url =
    `${GRAPH}?access_token=${encodeURIComponent(token)}` +
    `&fields=${FIELDS}&limit=${CANDIDATES}&bbox=${encodeURIComponent(bbox)}`;

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

  // Newest usable capture, not whichever the service happened to list first: the pane
  // says "captured <date>", and that date should be the most recent one there is.
  const image = (parsed?.data ?? [])
    .filter((candidate) => Boolean(candidate.id && candidate.thumb_1024_url))
    .sort((a, b) => (b.captured_at ?? 0) - (a.captured_at ?? 0))[0];
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

// ---------------------------------------------------------------------------
// One answer, two providers
// ---------------------------------------------------------------------------

/**
 * What the pane is allowed to show. `provider` is on the result rather than assumed,
 * because the credit line is a licence condition and "Mapillary" printed under a Google
 * photograph is both wrong and a compliance problem.
 */
export type StreetLevelResult =
  | { state: "not_configured" }
  | { state: "none" }
  | { state: "unavailable"; reason: string }
  | {
      state: "ok";
      provider: "Google" | "Mapillary";
      imageId: string;
      imageUrl: string;
      capturedAt: string | null;
      /** The attribution the provider's licence requires, verbatim. */
      credit: string;
      /** Link to the original capture, where the provider offers one. */
      linkUrl: string | null;
    };

export type StreetLevelDeps = {
  google?: (latitude: number, longitude: number) => Promise<GoogleStreetView>;
  mapillary?: (latitude: number, longitude: number) => Promise<MapillaryLookup>;
};

const MAPILLARY_CREDIT = "© Mapillary contributors, CC BY-SA 4.0";

/**
 * Google, then Mapillary, then the truth.
 *
 * A refusal is reported ahead of a coverage gap: "the key was rejected" is something we
 * can fix, whereas "no imagery here" beside a street Google definitely covers would send
 * someone looking in the wrong place.
 */
export async function lookupStreetLevel(
  latitude: number,
  longitude: number,
  deps: StreetLevelDeps = {},
): Promise<StreetLevelResult> {
  const google = await (deps.google ?? lookupGoogleStreetView)(latitude, longitude);
  if (google.state === "ok") {
    return {
      state: "ok",
      provider: "Google",
      imageId: google.panoId,
      imageUrl: google.dataUrl,
      capturedAt: google.capturedAt,
      credit: google.credit,
      linkUrl: null,
    };
  }

  const mapillary = await (deps.mapillary ?? lookupStreetImage)(latitude, longitude);
  if (mapillary.state === "ok") {
    return {
      state: "ok",
      provider: "Mapillary",
      imageId: mapillary.imageId,
      imageUrl: mapillary.imageUrl,
      capturedAt: mapillary.capturedAt,
      credit: MAPILLARY_CREDIT,
      linkUrl: `https://www.mapillary.com/map/im/${mapillary.imageId}`,
    };
  }

  if (google.state === "unavailable") return { state: "unavailable", reason: google.reason };
  if (mapillary.state === "unavailable") return { state: "unavailable", reason: mapillary.reason };

  if (google.state === "not_configured" && mapillary.state === "not_configured") {
    return { state: "not_configured" };
  }
  return { state: "none" };
}
