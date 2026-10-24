/**
 * Distance between two points on the ground, in metres.
 *
 * Used by the street-level pane: a capture 10m away and a capture 90m away are both "the nearest
 * one", and only one of them is a photograph of the site. The pane prints the number rather than
 * letting the reader assume.
 */

export type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6_371_000;

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

/** Great-circle distance in whole metres. */
export function distanceBetween(from: LatLng, to: LatLng): number {
  const deltaLat = toRad(to.latitude - from.latitude);
  const deltaLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_M * c);
}
