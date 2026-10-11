/**
 * Live conditions for a point on the map.
 *
 * Provider 1 - MET Norway Locationforecast (DEFAULT)
 *   Free, no API key, no account. Data under CC BY 4.0, which permits
 *   commercial use with attribution. Their terms require an identifying
 *   User-Agent, no unnecessary traffic, and a cache. This module does all
 *   three: one identifying UA, coordinates rounded to 4 decimals so repeat
 *   requests share their cache key, and an in-process cache with a 10 minute
 *   TTL. Their global model grid is about 9 km.
 *   No gust field: the global Locationforecast carries wind_speed,
 *   wind_from_direction, air_temperature, relative_humidity,
 *   cloud_area_fraction and air_pressure_at_sea_level, and nothing else.
 *
 * Provider 2 - Open-Meteo (optional, off unless WEATHER_PROVIDER=open-meteo)
 *   Adds wind gusts and a weather_code. Open-Meteo's free tier is licensed for
 *   NON-COMMERCIAL use only. Any product with subscriptions or advertising -
 *   instructBrain included - needs their commercial licence: 29 US dollars per
 *   month for 1,000,000 calls. Do not turn this on in production until that
 *   subscription is in place.
 */

import { msToMph } from "./units";
import { symbolLabel } from "./symbols";

export type ConditionProvider = "metno" | "open-meteo";

export type SiteConditions = {
  observedAt: string;
  windMph: number;
  windDirectionDeg: number | null;
  gustMph: number | null;
  temperatureC: number | null;
  humidityPercent: number | null;
  cloudPercent: number | null;
  /** Plain words, already run through the symbol table. */
  symbol: string | null;
  provider: ConditionProvider;
  providerName: string;
  providerUrl: string;
  /** Shown to the user: the model's resolution and what that means. */
  resolutionNote: string;
};

export type ConditionsResult =
  | { ok: true; conditions: SiteConditions }
  | { ok: false; reason: string };

const METNO_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

/**
 * MET Norway require an identifying User-Agent carrying the application and
 * either a contact address or a link to the site. No invented email address.
 */
const USER_AGENT = "instructbrain.com https://instructbrain.com";

const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 6000;

const cache = new Map<string, { at: number; result: ConditionsResult }>();

/** Coordinates to 4 decimals, which is also what MET Norway ask for. */
export function cacheKeyFor(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

export function selectedProvider(env: { WEATHER_PROVIDER?: string } = process.env): ConditionProvider {
  return env.WEATHER_PROVIDER?.trim().toLowerCase() === "open-meteo" ? "open-meteo" : "metno";
}

export type FetchInit = { headers?: Record<string, string>; signal?: AbortSignal };
export type FetchLike = (url: string, init?: FetchInit) => Promise<unknown>;

async function getJson(url: string, init: FetchInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      ...(init.headers ? { headers: init.headers } : {}),
    });
    if (!response.ok) throw new Error(`${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

type MetNoBody = {
  properties?: {
    timeseries?: Array<{
      time?: string;
      data?: {
        instant?: { details?: Record<string, number> };
        next_1_hours?: { summary?: { symbol_code?: string } };
        next_6_hours?: { summary?: { symbol_code?: string } };
      };
    }>;
  };
};

/** Turn a Locationforecast body into our shape. Exported for tests. */
export function normaliseMetNo(body: unknown): ConditionsResult {
  const timeseries = (body as MetNoBody | null)?.properties?.timeseries ?? [];
  const entry = timeseries[0];
  const details = entry?.data?.instant?.details;
  if (!entry || !details || typeof details["wind_speed"] !== "number") {
    return { ok: false, reason: "The forecast service did not return a reading." };
  }

  const symbolCode =
    entry.data?.next_1_hours?.summary?.symbol_code ?? entry.data?.next_6_hours?.summary?.symbol_code ?? null;

  return {
    ok: true,
    conditions: {
      observedAt: entry.time ?? new Date().toISOString(),
      windMph: msToMph(details["wind_speed"]!),
      windDirectionDeg: typeof details["wind_from_direction"] === "number" ? details["wind_from_direction"]! : null,
      gustMph: null,
      temperatureC: typeof details["air_temperature"] === "number" ? details["air_temperature"]! : null,
      humidityPercent: typeof details["relative_humidity"] === "number" ? details["relative_humidity"]! : null,
      cloudPercent: typeof details["cloud_area_fraction"] === "number" ? details["cloud_area_fraction"]! : null,
      symbol: symbolLabel(symbolCode),
      provider: "metno",
      providerName: "MET Norway",
      providerUrl: "https://www.met.no/en/free-meteorological-data",
      resolutionNote:
        "MET Norway's global model, about a 9 km grid - a site-area forecast, not a mast reading. The site anemometer and the lifting plan govern.",
    },
  };
}

/** WMO weather codes, as published for Open-Meteo's weather_code field. */
const WMO: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

type OpenMeteoBody = {
  current?: Record<string, number | string>;
};

/** Turn an Open-Meteo body into our shape. Exported for tests. */
export function normaliseOpenMeteo(body: unknown): ConditionsResult {
  const current = (body as OpenMeteoBody | null)?.current;
  if (!current || typeof current["wind_speed_10m"] !== "number") {
    return { ok: false, reason: "The forecast service did not return a reading." };
  }
  const code = typeof current["weather_code"] === "number" ? current["weather_code"] : null;
  return {
    ok: true,
    conditions: {
      observedAt: typeof current["time"] === "string" ? current["time"] : new Date().toISOString(),
      // Requested in m/s so both providers arrive in the same unit.
      windMph: msToMph(current["wind_speed_10m"] as number),
      windDirectionDeg:
        typeof current["wind_direction_10m"] === "number" ? (current["wind_direction_10m"] as number) : null,
      gustMph: typeof current["wind_gusts_10m"] === "number" ? msToMph(current["wind_gusts_10m"] as number) : null,
      temperatureC: typeof current["temperature_2m"] === "number" ? (current["temperature_2m"] as number) : null,
      humidityPercent:
        typeof current["relative_humidity_2m"] === "number" ? (current["relative_humidity_2m"] as number) : null,
      cloudPercent: typeof current["cloud_cover"] === "number" ? (current["cloud_cover"] as number) : null,
      symbol: code === null ? null : (WMO[code] ?? null),
      provider: "open-meteo",
      providerName: "Open-Meteo",
      providerUrl: "https://open-meteo.com/",
      resolutionNote:
        "Open-Meteo's best-match model, typically 1 to 11 km - a site-area forecast, not a mast reading. The site anemometer and the lifting plan govern.",
    },
  };
}

/** Ask the selected provider for the conditions at a point. Never throws. */
export async function fetchConditions(
  latitude: number,
  longitude: number,
  options: { provider?: ConditionProvider; fetchJson?: FetchLike; now?: number } = {},
): Promise<ConditionsResult> {
  const provider = options.provider ?? selectedProvider();
  const key = `${provider}:${cacheKeyFor(latitude, longitude)}`;
  const now = options.now ?? Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.result;

  const load = options.fetchJson ?? getJson;
  const lat = latitude.toFixed(4);
  const lon = longitude.toFixed(4);

  let result: ConditionsResult;
  try {
    if (provider === "open-meteo") {
      const url =
        `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&wind_speed_unit=ms` +
        "&current=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code" +
        "&timezone=UTC";
      result = normaliseOpenMeteo(await load(url, { headers: { Accept: "application/json" } }));
    } else {
      result = normaliseMetNo(
        await load(`${METNO_URL}?lat=${lat}&lon=${lon}`, {
          headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        }),
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    result = { ok: false, reason: `The forecast service could not be reached (${message}).` };
  }

  // Only successful readings are worth caching; a failure is retried next time.
  if (result.ok) cache.set(key, { at: now, result });
  return result;
}

/** Test seam: clear the in-process cache. */
export function clearConditionsCache(): void {
  cache.clear();
}
