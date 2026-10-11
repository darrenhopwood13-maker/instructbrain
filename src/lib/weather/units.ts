/**
 * Wind and Beaufort helpers. Pure functions only - no network, no environment,
 * so they can be tested directly and reused by the panel and any later report.
 */

/** Metres per second to miles per hour. */
export const MS_TO_MPH = 2.236936;

/** Metres per second to kilometres per hour. */
export const MS_TO_KMH = 3.6;

export function msToMph(ms: number): number {
  return ms * MS_TO_MPH;
}

export function msToKmh(ms: number): number {
  return ms * MS_TO_KMH;
}

/**
 * Upper bounds of Beaufort forces 0 to 11, in mph, exclusive.
 * Force 0 is under 1 mph; force 12 is 73 mph and above.
 * Tabulated from the WMO Beaufort scale.
 */
const BEAUFORT_MPH_UPPER = [1, 4, 8, 13, 19, 25, 32, 39, 47, 55, 64, 73];

export const BEAUFORT_NAMES = [
  "Calm",
  "Light air",
  "Light breeze",
  "Gentle breeze",
  "Moderate breeze",
  "Fresh breeze",
  "Strong breeze",
  "Near gale",
  "Gale",
  "Severe gale",
  "Storm",
  "Violent storm",
  "Hurricane",
] as const;

/** Beaufort force for a mean wind speed in mph. Negative input reads as calm. */
export function beaufortFromMph(mph: number): number {
  const value = Number.isFinite(mph) ? Math.max(0, mph) : 0;
  for (let force = 0; force < BEAUFORT_MPH_UPPER.length; force += 1) {
    if (value < BEAUFORT_MPH_UPPER[force]!) return force;
  }
  return 12;
}

export function beaufortName(force: number): string {
  return BEAUFORT_NAMES[Math.min(Math.max(force, 0), 12)]!;
}

/** One line a site manager can act on. */
export function describeWind(mph: number): string {
  const force = beaufortFromMph(mph);
  return `Force ${force} - ${beaufortName(force)}`;
}

/**
 * The force at which sheeted scaffold and most lifting start needing planned
 * hold points. A conversation flag, NOT a rule and not a published limit -
 * the lifting plan, the crane data plate and the scaffold design govern.
 */
export const WIND_WATCH_FORCE = 6;

export function isWindWatch(mph: number): boolean {
  return beaufortFromMph(mph) >= WIND_WATCH_FORCE;
}

const COMPASS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

/** 16-point compass label for a wind direction in degrees. */
export function compassPoint(degrees: number | null): string | null {
  if (degrees === null || !Number.isFinite(degrees)) return null;
  const normalised = ((degrees % 360) + 360) % 360;
  return COMPASS[Math.round(normalised / 22.5) % 16]!;
}

/**
 * Wind speed for showing.
 *
 * A whole number hides the difference at low wind: two sites 140 miles apart
 * read 2.6 and 2.8 m/s, both printed "6 mph", and the panel looked broken
 * (Dal, 11 Oct 2026, from a phone). Below 10 mph a decimal is shown, so 5.8
 * and 6.3 read as the different readings they are. At and above 10 mph the
 * decimal is noise and a whole number is what a site reads out: 9.4 mph keeps
 * its decimal, 9.96 mph reads "10 mph" rather than "10.0".
 */
export function formatMph(mph: number): string {
  if (!Number.isFinite(mph)) return "- mph";
  const rounded = Math.round(mph);
  return rounded < 10 ? `${mph.toFixed(1)} mph` : `${rounded} mph`;
}

export function formatTemperature(celsius: number | null): string | null {
  if (celsius === null || !Number.isFinite(celsius)) return null;
  return `${Math.round(celsius)}°C`;
}
