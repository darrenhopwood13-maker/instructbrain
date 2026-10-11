/**
 * Pinning a project address to a point, so a forecast can be asked for.
 *
 * postcodes.io - free, no API key, no account, unlimited, UK only, data under
 * the Open Government Licence. instructBrain's projects are UK addresses, so a
 * postcode is both the most precise thing on the address line and the only
 * identifier the address is guaranteed to carry that resolves to a point.
 *
 * We do NOT guess a location from a town name. An address that carries no
 * postcode returns null and the dashboard says so, because a wind reading at
 * the wrong town is worse than no wind reading.
 */

const POSTCODES_IO = "https://api.postcodes.io";

/**
 * A UK postcode, loosely. Deliberately permissive on spacing and case, and
 * deliberately anchored on word boundaries so "BH23 1AF" is found inside
 * "Priory Church, Christchurch, Dorset BH23 1AF".
 */
const UK_POSTCODE = /\b([A-PR-UWYZ][A-HK-Y]?\d[\dA-Z]?)\s*(\d[ABD-HJLNP-UW-Z]{2})\b/i;

export type GeoPoint = {
  latitude: number;
  longitude: number;
  /** What the point actually is, for showing back on the panel. */
  label: string;
  /** "postcode" is a full postcode; "outcode" is the BH23 part only. */
  precision: "postcode" | "outcode";
};

/** The full postcode in an address, normalised to "BH23 1AF", or null. */
export function extractUkPostcode(address: string | null | undefined): string | null {
  if (!address) return null;
  const match = UK_POSTCODE.exec(address);
  if (!match) return null;
  return `${match[1]!.toUpperCase()} ${match[2]!.toUpperCase()}`;
}

/** The outward part of a detected postcode, e.g. "BH23". */
export function outwardCode(postcode: string): string {
  return postcode.split(" ")[0]!.toUpperCase();
}

type FetchJson = (url: string) => Promise<unknown>;

async function postcodesIo(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    // A terminated postcode answers 404 with useful coordinates in the body,
    // so the body is read either way and the caller decides.
    if (!response.ok && response.status !== 404) {
      throw new Error(`postcodes.io answered ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

type PostcodeBody = {
  status?: number;
  result?: { postcode?: string; latitude?: number; longitude?: number; admin_district?: string } | null;
  terminated?: { latitude?: number; longitude?: number } | null;
};

function pointFrom(body: unknown): { latitude: number; longitude: number; district: string | null } | null {
  const parsed = body as PostcodeBody | null;
  const latitude = parsed?.result?.latitude ?? parsed?.terminated?.latitude;
  const longitude = parsed?.result?.longitude ?? parsed?.terminated?.longitude;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  return { latitude, longitude, district: parsed?.result?.admin_district ?? null };
}

/**
 * Geocode a UK address. Full postcode first. A postcode that has been retired
 * still answers with its own coordinates, which are used - the point on the
 * ground has not moved. A postcode with no coordinates at all (or a service
 * that is unreachable) falls back to the outward code, and that coarser result
 * is labelled "outcode" so nothing downstream claims a precision it lacks.
 * Returns null when the address carries no postcode at all.
 */
export async function geocodeUkAddress(address: string, fetchJson: FetchJson = postcodesIo): Promise<GeoPoint | null> {
  const postcode = extractUkPostcode(address);
  if (!postcode) return null;

  try {
    const full = pointFrom(await fetchJson(`${POSTCODES_IO}/postcodes/${encodeURIComponent(postcode)}`));
    if (full) {
      return {
        latitude: full.latitude,
        longitude: full.longitude,
        label: full.district ? `${postcode}, ${full.district}` : postcode,
        precision: "postcode",
      };
    }
  } catch {
    // Fall through to the outward code rather than failing the whole row.
  }

  const outcode = outwardCode(postcode);
  try {
    const outer = await fetchJson(`${POSTCODES_IO}/outcodes/${encodeURIComponent(outcode)}`);
    const parsed = outer as { result?: { latitude?: number; longitude?: number; admin_district?: string[] } } | null;
    const latitude = parsed?.result?.latitude;
    const longitude = parsed?.result?.longitude;
    if (typeof latitude === "number" && typeof longitude === "number") {
      const district = parsed?.result?.admin_district?.[0] ?? null;
      return {
        latitude,
        longitude,
        label: district ? `${outcode}, ${district}` : outcode,
        precision: "outcode",
      };
    }
  } catch {
    return null;
  }

  return null;
}
