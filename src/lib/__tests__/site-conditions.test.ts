import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beaufortFromMph,
  beaufortName,
  compassPoint,
  describeWind,
  formatMph,
  formatTemperature,
  isWindWatch,
  msToKmh,
  msToMph,
} from "@/lib/weather/units";
import { symbolLabel } from "@/lib/weather/symbols";
import { extractUkPostcode, geocodeUkAddress, outwardCode } from "@/lib/weather/geocode.server";
import {
  cacheKeyFor,
  clearConditionsCache,
  fetchConditions,
  normaliseMetNo,
  normaliseOpenMeteo,
  selectedProvider,
  type FetchLike,
} from "@/lib/weather/forecast.server";

/** A real Locationforecast compact body, trimmed. Captured 11 Oct 2026. */
const METNO = {
  properties: {
    timeseries: [
      {
        time: "2026-10-11T11:00:00Z",
        data: {
          instant: {
            details: {
              air_pressure_at_sea_level: 1014.2,
              air_temperature: 14.6,
              cloud_area_fraction: 60.5,
              relative_humidity: 71.4,
              wind_from_direction: 233.9,
              wind_speed: 1.8,
            },
          },
          next_1_hours: { summary: { symbol_code: "partlycloudy_day" } },
        },
      },
    ],
  },
};

const OPEN_METEO = {
  current: {
    time: "2026-10-11T11:45",
    temperature_2m: 14.6,
    relative_humidity_2m: 71,
    cloud_cover: 61,
    wind_speed_10m: 1.8,
    wind_gusts_10m: 4.1,
    wind_direction_10m: 234,
    weather_code: 2,
  },
};

describe("wind units and Beaufort", () => {
  it("converts metres per second", () => {
    expect(msToMph(1)).toBeCloseTo(2.2369, 3);
    expect(msToKmh(1)).toBeCloseTo(3.6, 6);
  });

  it("puts the WMO Beaufort boundaries where they belong", () => {
    expect(beaufortFromMph(0)).toBe(0);
    expect(beaufortFromMph(0.9)).toBe(0);
    expect(beaufortFromMph(1)).toBe(1);
    expect(beaufortFromMph(24.9)).toBe(5);
    expect(beaufortFromMph(25)).toBe(6);
    expect(beaufortFromMph(31)).toBe(6);
    expect(beaufortFromMph(32)).toBe(7);
    expect(beaufortFromMph(80)).toBe(12);
  });

  it("never reports a force below calm on nonsense input", () => {
    expect(beaufortFromMph(-5)).toBe(0);
    expect(beaufortFromMph(Number.NaN)).toBe(0);
  });

  it("names the force and flags the watch point", () => {
    expect(beaufortName(6)).toBe("Strong breeze");
    expect(describeWind(26)).toBe("Force 6 - Strong breeze");
    expect(isWindWatch(24.9)).toBe(false);
    expect(isWindWatch(25)).toBe(true);
  });

  it("reads a direction as a compass point", () => {
    expect(compassPoint(234)).toBe("SW");
    expect(compassPoint(0)).toBe("N");
    expect(compassPoint(361)).toBe("N");
    expect(compassPoint(null)).toBeNull();
  });

  it("formats for showing", () => {
    expect(formatMph(14.4)).toBe("14 mph");
    expect(formatTemperature(14.6)).toBe("15°C");
    expect(formatTemperature(null)).toBeNull();
  });
});

describe("weather symbols in plain words", () => {
  it("translates the published vocabulary", () => {
    expect(symbolLabel("clearsky_day")).toBe("Clear sky");
    expect(symbolLabel("partlycloudy_night")).toBe("Partly cloudy");
    expect(symbolLabel("heavyrainshowersandthunder_polartwilight")).toBe("Heavy rain showers and thunder");
  });

  it("prettifies a code it has never seen rather than showing it raw", () => {
    expect(symbolLabel("somethingnew_day")).toBe("Somethingnew");
    expect(symbolLabel("")).toBeNull();
    expect(symbolLabel(null)).toBeNull();
  });
});

describe("pinning an address", () => {
  it("finds the postcode inside a real address line", () => {
    expect(extractUkPostcode("Priory Church, Christchurch, Dorset bh23 1af")).toBe("BH23 1AF");
    expect(extractUkPostcode("13 Bruton Street, London W1J 6QB")).toBe("W1J 6QB");
    expect(extractUkPostcode("Riverside House, Leeds LS1 4AP")).toBe("LS1 4AP");
  });

  it("refuses to invent one", () => {
    expect(extractUkPostcode("Priory Church, Christchurch, Dorset")).toBeNull();
    expect(extractUkPostcode("")).toBeNull();
    expect(extractUkPostcode(null)).toBeNull();
  });

  it("takes the outward code off a full postcode", () => {
    expect(outwardCode("BH23 1AF")).toBe("BH23");
  });

  it("does not call the network when there is no postcode to look up", async () => {
    const fetchJson = vi.fn();
    const point = await geocodeUkAddress("Priory Church, Christchurch", fetchJson as unknown as FetchLike);
    expect(point).toBeNull();
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("uses the full postcode when it resolves", async () => {
    const fetchJson = vi.fn(async () => ({
      status: 200,
      result: {
        postcode: "BH23 1AF",
        latitude: 50.7342,
        longitude: -1.7784,
        admin_district: "Bournemouth, Christchurch and Poole",
      },
    }));
    const point = await geocodeUkAddress("Priory Church, Christchurch BH23 1AF", fetchJson as unknown as FetchLike);
    expect(point).toEqual({
      latitude: 50.7342,
      longitude: -1.7784,
      label: "BH23 1AF, Bournemouth, Christchurch and Poole",
      precision: "postcode",
    });
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it("uses the coordinates of a retired postcode, because the ground has not moved", async () => {
    // The exact shape postcodes.io returns for a terminated postcode.
    const terminated = {
      status: 404,
      error: "Postcode not found",
      terminated: { postcode: "BH23 1YA", year_terminated: 2000, month_terminated: 6, longitude: -1.779639, latitude: 50.73465 },
    };
    const fetchJson = vi.fn(async () => terminated);
    const point = await geocodeUkAddress("Old Depot, Christchurch BH23 1YA", fetchJson as unknown as FetchLike);
    expect(point).toEqual({
      latitude: 50.73465,
      longitude: -1.779639,
      label: "BH23 1YA",
      precision: "postcode",
    });
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it("falls back to the outward code when a postcode carries no coordinates - and says so", async () => {
    const fetchJson = vi.fn(async (url: string) =>
      url.includes("/outcodes/")
        ? { status: 200, result: { outcode: "BH23", latitude: 50.7476, longitude: -1.7542, admin_district: ["Dorset"] } }
        : { status: 404, error: "Postcode not found" },
    );
    const point = await geocodeUkAddress("Old Depot, Christchurch BH23 9ZZ", fetchJson as unknown as FetchLike);
    expect(point).toEqual({
      latitude: 50.7476,
      longitude: -1.7542,
      label: "BH23, Dorset",
      precision: "outcode",
    });
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});

describe("normalising a forecast", () => {
  it("reads the MET Norway shape into our own", () => {
    const result = normaliseMetNo(METNO);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.conditions.windMph).toBeCloseTo(4.03, 1);
    expect(result.conditions.windDirectionDeg).toBe(233.9);
    expect(result.conditions.temperatureC).toBe(14.6);
    expect(result.conditions.symbol).toBe("Partly cloudy");
    expect(result.conditions.provider).toBe("metno");
    // MET Norway's global product carries no gust - so we never claim one.
    expect(result.conditions.gustMph).toBeNull();
  });

  it("reads the Open-Meteo shape, gust included", () => {
    const result = normaliseOpenMeteo(OPEN_METEO);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.conditions.gustMph).toBeCloseTo(9.17, 1);
    expect(result.conditions.symbol).toBe("Partly cloudy");
    expect(result.conditions.provider).toBe("open-meteo");
  });

  it("reports a failure rather than a zero when the service answers nothing useful", () => {
    expect(normaliseMetNo({}).ok).toBe(false);
    expect(normaliseMetNo({ properties: { timeseries: [] } }).ok).toBe(false);
    expect(normaliseOpenMeteo({ current: {} }).ok).toBe(false);
  });
});

describe("asking for conditions", () => {
  beforeEach(() => clearConditionsCache());

  it("uses MET Norway by default and adds the identifying User-Agent", async () => {
    const seen: Array<{ url: string; headers?: Record<string, string> }> = [];
    const fetchJson: FetchLike = async (url, init) => {
      seen.push(init?.headers ? { url, headers: init.headers } : { url });
      return METNO;
    };
    const result = await fetchConditions(50.7342, -1.7784, { fetchJson });
    expect(result.ok).toBe(true);
    expect(seen[0]!.url).toContain("lat=50.7342&lon=-1.7784");
    expect(seen[0]!.headers?.["User-Agent"]).toContain("instructbrain.com");
  });

  it("caches a reading per point instead of calling out again", async () => {
    const fetchJson = vi.fn(async () => METNO);
    await fetchConditions(50.7342, -1.7784, { fetchJson: fetchJson as unknown as FetchLike });
    await fetchConditions(50.7342, -1.7784, { fetchJson: fetchJson as unknown as FetchLike });
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failure", async () => {
    const fetchJson = vi.fn(async () => {
      throw new Error("503");
    });
    const first = await fetchConditions(51.5, -0.1, { fetchJson: fetchJson as unknown as FetchLike });
    expect(first.ok).toBe(false);
    await fetchConditions(51.5, -0.1, { fetchJson: fetchJson as unknown as FetchLike });
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it("rounds coordinates to four decimals, as MET Norway ask", () => {
    expect(cacheKeyFor(50.734219, -1.778412)).toBe("50.7342,-1.7784");
  });

  it("only switches to Open-Meteo when explicitly told to", () => {
    expect(selectedProvider({})).toBe("metno");
    expect(selectedProvider({ WEATHER_PROVIDER: "OPEN-METEO" })).toBe("open-meteo");
    expect(selectedProvider({ WEATHER_PROVIDER: "openmeteo" })).toBe("metno");
  });
});
