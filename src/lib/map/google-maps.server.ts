/**
 * The Google side of the map: rooftop geocoding, and street-level imagery where the free
 * crowd-sourced coverage runs out.
 *
 * Both calls are server-only. The key lives in server configuration as
 * GOOGLE_MAPS_API_KEY; a `VITE_` prefixed copy would be inlined into the public bundle by
 * Vite and anyone could spend the quota. The key is never logged and never returned to a
 * caller - the street view image travels as bytes we fetched ourselves, not as a URL with
 * a key in it.
 *
 * Both APIs are billed per call on top of a monthly free allowance, so the shape here is
 * deliberately one user action at a time: a geocode when the map is built, and a single
 * panorama when someone opens a project - never a preload of the whole estate.
 */

import { distanceBetween } from "@/lib/map/geo";

const GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json";
const STREET_METADATA = "https://maps.googleapis.com/maps/api/streetview/metadata";
const STREET_IMAGE = "https://maps.googleapis.com/maps/api/streetview";
const TIMEOUT_MS = 6000;

/** 600x400 is the largest sensible frame the static API will return below its 640 cap. */
const IMAGE_WIDTH = 600;
const IMAGE_HEIGHT = 400;
const FIELD_OF_VIEW = 80;

/** The key, trimmed, or undefined. Never logged, never returned to a caller. */
export function googleMapsKey(): string | undefined {
  if (typeof process === "undefined") return undefined;
  const raw = process.env?.["GOOGLE_MAPS_API_KEY"];
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function googleConfigured(): boolean {
  return googleMapsKey() !== undefined;
}

type JsonResponse = { status: number; body: unknown };
type FetchJson = (url: string) => Promise<JsonResponse>;
type BinaryResponse = { status: number; contentType: string; bytes: Uint8Array };
type FetchBinary = (url: string) => Promise<BinaryResponse>;

async function jsonFetch(url: string): Promise<JsonResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    const body = await response.json().catch(() => null);
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function binaryFetch(url: string): Promise<BinaryResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const buffer = await response.arrayBuffer();
    return {
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      bytes: new Uint8Array(buffer),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Runtime-agnostic base64: this app also builds for edge runtimes, where Buffer is absent. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

export type GooglePlacement = {
  latitude: number;
  longitude: number;
  /** What Google resolved, shown back as "Placed on". */
  label: string;
  /** ROOFTOP and RANGE_INTERPOLATED are the building; the rest is an area. */
  precision: "rooftop" | "postcode";
};

type GeocodeBody = {
  status?: string;
  error_message?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number }; location_type?: string };
  }>;
};

const ROOFTOP_TYPES = new Set(["ROOFTOP", "RANGE_INTERPOLATED"]);

/**
 * A building-level placement for a UK address, or null.
 *
 * Null is not an error here: the caller falls back to postcodes.io, so a Google quota
 * problem or a rural address Google cannot place still leaves the estate on the map.
 */
export async function geocodeWithGoogle(
  address: string,
  fetchJsonImpl: FetchJson = jsonFetch,
  key: string | null | undefined = googleMapsKey(),
): Promise<GooglePlacement | null> {
  if (!key) return null;
  const trimmed = address.trim();
  if (!trimmed) return null;

  const url =
    `${GEOCODE}?address=${encodeURIComponent(trimmed)}` +
    `&components=${encodeURIComponent("country:GB")}&region=uk&key=${encodeURIComponent(key)}`;

  let response: JsonResponse;
  try {
    response = await fetchJsonImpl(url);
  } catch {
    return null;
  }
  if (response.status < 200 || response.status >= 300) return null;

  const body = response.body as GeocodeBody | null;
  if (body?.status !== "OK") return null;

  const first = body.results?.[0];
  const lat = first?.geometry?.location?.lat;
  const lng = first?.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  return {
    latitude: lat,
    longitude: lng,
    label: first?.formatted_address?.trim() || trimmed,
    precision: ROOFTOP_TYPES.has(first?.geometry?.location_type ?? "") ? "rooftop" : "postcode",
  };
}

// ---------------------------------------------------------------------------
// Street level
// ---------------------------------------------------------------------------

export type GoogleStreetView =
  | { state: "not_configured" }
  | { state: "none" }
  | { state: "unavailable"; reason: string }
  | {
      state: "ok";
      panoId: string;
      /** A data URL: the image bytes we fetched, so no key reaches the browser. */
      dataUrl: string;
      capturedAt: string | null;
      credit: string;
      /** How far the panorama sits from the point asked for, in metres, when Google says. */
      distanceMetres: number | null;
    };

type MetadataBody = {
  status?: string;
  error_message?: string;
  copyright?: string;
  date?: string;
  pano_id?: string;
  location?: { lat?: number; lng?: number };
};

/** Bearing from the camera to the site, so the panorama faces the building, not away. */
export function bearingBetween(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const fromLat = toRad(from.latitude);
  const toLat = toRad(to.latitude);
  const deltaLng = toRad(to.longitude - from.longitude);
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  const degrees = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((degrees + 360) % 360);
}

/**
 * The nearest Google panorama for a point, or an honest reason there is not one.
 *
 * Two calls, in order: metadata first, because it answers "is there coverage here" for a
 * tenth of the price of an image and gives the capture date and copyright line that the
 * pane has to show. The image is only fetched once coverage is confirmed.
 */
export async function lookupGoogleStreetView(
  latitude: number,
  longitude: number,
  fetchJsonImpl: FetchJson = jsonFetch,
  fetchBinaryImpl: FetchBinary = binaryFetch,
  key: string | null | undefined = googleMapsKey(),
): Promise<GoogleStreetView> {
  if (!key) return { state: "not_configured" };

  const location = `${latitude},${longitude}`;
  const metadataUrl =
    `${STREET_METADATA}?location=${encodeURIComponent(location)}&source=outdoor` +
    `&key=${encodeURIComponent(key)}`;

  let metadata: JsonResponse;
  try {
    metadata = await fetchJsonImpl(metadataUrl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { state: "unavailable", reason: `Street View could not be reached: ${reason}` };
  }

  const body = metadata.body as MetadataBody | null;

  if (body?.status === "ZERO_RESULTS") return { state: "none" };
  if (metadata.status === 401 || metadata.status === 403 || body?.status === "REQUEST_DENIED") {
    // Key problem, not a coverage problem. Say which, or someone goes hunting on the map.
    const detail = body?.error_message?.trim();
    return {
      state: "unavailable",
      reason: detail
        ? `Street View refused the request: ${detail}`
        : "Street View refused the request. Check the key is enabled for the Street View Static API.",
    };
  }
  if (body?.status === "OVER_QUERY_LIMIT" || metadata.status === 429) {
    return { state: "unavailable", reason: "Street View is over its quota. Try again shortly." };
  }
  if (metadata.status < 200 || metadata.status >= 300 || body?.status !== "OK") {
    return { state: "unavailable", reason: `Street View answered ${metadata.status}.` };
  }

  const panoLat = body.location?.lat;
  const panoLng = body.location?.lng;
  const heading =
    typeof panoLat === "number" && typeof panoLng === "number"
      ? bearingBetween({ latitude: panoLat, longitude: panoLng }, { latitude, longitude })
      : 0;

  const imageUrl =
    `${STREET_IMAGE}?size=${IMAGE_WIDTH}x${IMAGE_HEIGHT}&location=${encodeURIComponent(location)}` +
    `&fov=${FIELD_OF_VIEW}&pitch=0&heading=${heading}&source=outdoor&key=${encodeURIComponent(key)}`;

  let image: BinaryResponse;
  try {
    image = await fetchBinaryImpl(imageUrl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { state: "unavailable", reason: `Street View image could not be fetched: ${reason}` };
  }
  if (image.status < 200 || image.status >= 300 || image.bytes.length === 0) {
    return { state: "unavailable", reason: `Street View image answered ${image.status}.` };
  }

  const contentType = image.contentType.split(";")[0]?.trim() || "image/jpeg";

  return {
    state: "ok",
    panoId: body.pano_id ?? `${latitude},${longitude}`,
    dataUrl: `data:${contentType};base64,${toBase64(image.bytes)}`,
    // Google reports yyyy-mm; the pane prints a month and year rather than inventing a day.
    capturedAt: body.date?.trim() ? `${body.date.trim()}-01` : null,
    credit: body.copyright?.trim() || "© Google",
    distanceMetres:
      typeof panoLat === "number" && typeof panoLng === "number"
        ? distanceBetween(
            { latitude: panoLat, longitude: panoLng },
            { latitude, longitude },
          )
        : null,
  };
}
