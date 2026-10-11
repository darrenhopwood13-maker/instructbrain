/**
 * Weather symbol codes to plain words.
 *
 * MET Norway publishes the symbol vocabulary in its Locationforecast
 * documentation. Anything not listed is prettified rather than guessed at, so
 * an unfamiliar code reads as words instead of leaking a raw string onto the
 * dashboard.
 */

const SYMBOLS: Record<string, string> = {
  clearsky: "Clear sky",
  fair: "Fair",
  partlycloudy: "Partly cloudy",
  cloudy: "Cloudy",
  fog: "Fog",
  lightrain: "Light rain",
  rain: "Rain",
  heavyrain: "Heavy rain",
  lightrainshowers: "Light rain showers",
  rainshowers: "Rain showers",
  heavyrainshowers: "Heavy rain showers",
  lightrainshowersandthunder: "Light rain showers and thunder",
  rainshowersandthunder: "Rain showers and thunder",
  heavyrainshowersandthunder: "Heavy rain showers and thunder",
  lightsleet: "Light sleet",
  sleet: "Sleet",
  heavysleet: "Heavy sleet",
  lightsleetshowers: "Light sleet showers",
  sleetshowers: "Sleet showers",
  heavysleetshowers: "Heavy sleet showers",
  lightsnow: "Light snow",
  snow: "Snow",
  heavysnow: "Heavy snow",
  lightsnowshowers: "Light snow showers",
  snowshowers: "Snow showers",
  heavysnowshowers: "Heavy snow showers",
  lightrainandthunder: "Light rain and thunder",
  rainandthunder: "Rain and thunder",
  heavyrainandthunder: "Heavy rain and thunder",
  lightsleetandthunder: "Light sleet and thunder",
  sleetandthunder: "Sleet and thunder",
  heavysleetandthunder: "Heavy sleet and thunder",
  lightsnowandthunder: "Light snow and thunder",
  snowandthunder: "Snow and thunder",
  heavysnowandthunder: "Heavy snow and thunder",
};

/** Day/night/season suffixes carry no meaning in a written label. */
const SUFFIXES = ["_day", "_night", "_polartwilight"];

export function symbolLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  let base = code.trim();
  for (const suffix of SUFFIXES) {
    if (base.endsWith(suffix)) base = base.slice(0, -suffix.length);
  }
  const known = SYMBOLS[base];
  if (known) return known;
  // Unknown code: split the words so it still reads as words.
  const words = base
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z]+/)
    .filter(Boolean);
  if (words.length === 0) return null;
  const joined = words.join(" ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}
