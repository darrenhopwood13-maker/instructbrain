/**
 * Time and place recorded by the in-app camera at the moment of the shot.
 * Photos taken through getUserMedia carry no EXIF, so the camera stamps them
 * here. EXIF, when present, always wins — this only fills what EXIF lacks.
 */
export type DeviceProvenance = {
  capturedAt: string;
  gpsLat: number | null;
  gpsLng: number | null;
  accuracyM: number | null;
};

export type Fix = { lat: number; lng: number; accuracy: number; at: number };

/** A location fix older than this is not attributed to a shot. */
export const MAX_FIX_AGE_MS = 2 * 60 * 1000;

const stamps = new WeakMap<File, DeviceProvenance>();

export function stampFile(file: File, provenance: DeviceProvenance): void {
  stamps.set(file, provenance);
}

export function deviceProvenanceOf(file: File): DeviceProvenance | null {
  return stamps.get(file) ?? null;
}

/** Build a stamp from the shot time and the latest fix, never guessing a place. */
export function stampFor(shotAt: number, fix: Fix | null): DeviceProvenance {
  const fresh = fix && shotAt - fix.at <= MAX_FIX_AGE_MS && shotAt >= fix.at - 5000 ? fix : null;
  return {
    capturedAt: new Date(shotAt).toISOString(),
    gpsLat: fresh ? fresh.lat : null,
    gpsLng: fresh ? fresh.lng : null,
    accuracyM: fresh ? Math.round(fresh.accuracy) : null,
  };
}

/** EXIF first; device stamp only for fields EXIF left empty. */
export function mergeProvenance<
  T extends { capturedAt: string | null; gpsLat: number | null; gpsLng: number | null },
>(exif: T, device: DeviceProvenance | null): T {
  if (!device) return exif;
  const hasExifPlace = exif.gpsLat != null && exif.gpsLng != null;
  return {
    ...exif,
    capturedAt: exif.capturedAt ?? device.capturedAt,
    gpsLat: hasExifPlace ? exif.gpsLat : device.gpsLat,
    gpsLng: hasExifPlace ? exif.gpsLng : device.gpsLng,
  };
}
