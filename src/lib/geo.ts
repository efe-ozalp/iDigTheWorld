import type { LatLon } from '../../shared/types';

/** Mean diameter of the Earth: the length of a tunnel dug straight through the centre. */
export const EARTH_DIAMETER_KM = 12_742;

/** Wraps a longitude in degrees into the range -180 to 180. */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** The point on the exact opposite side of the Earth. */
export function antipode({ lat, lon }: LatLon): LatLon {
  // `|| 0` turns the -0 produced on the equator back into a plain 0.
  return { lat: -lat || 0, lon: wrapLon(lon + 180) };
}

/** Formats a position the way an atlas would: "40.42° N, 3.70° W". */
export function formatCoords({ lat, lon }: LatLon, digits = 2): string {
  const northSouth = lat >= 0 ? 'N' : 'S';
  const eastWest = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(digits)}° ${northSouth}, ${Math.abs(lon).toFixed(digits)}° ${eastWest}`;
}
