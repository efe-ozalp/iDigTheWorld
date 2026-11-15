import type { LatLon } from '../../shared/types';
import { distanceKm } from './geo';

/**
 * Finds the coast nearest a point at sea, from Natural Earth's 1:50m
 * coastline bundled in src/data/coast.json: a flat list of longitude,
 * latitude pairs, thinned to about one point every 10 km. Works offline.
 */

export interface CoastPoint {
  point: LatLon;
  /** How far it is from where the search started. */
  km: number;
}

let loading: Promise<number[]> | undefined;

function coastline(): Promise<number[]> {
  loading ??= import('../data/coast.json').then((m) => m.default as number[]);
  return loading;
}

/** Candidates are kept this far apart, so each is a different stretch of shore. */
const SPREAD_KM = 40;

/**
 * The nearest stretches of coast, closest first. More than one is returned
 * because the very nearest may be a rock with no name; the caller can try the
 * next. Resolves with an empty list if the coastline cannot be loaded.
 */
export async function nearestCoasts(from: LatLon, count = 3): Promise<CoastPoint[]> {
  let flat: number[];
  try {
    flat = await coastline();
  } catch {
    return [];
  }

  const all: CoastPoint[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    const point = { lat: flat[i + 1], lon: flat[i] };
    all.push({ point, km: distanceKm(from, point) });
  }
  all.sort((a, b) => a.km - b.km);

  const picked: CoastPoint[] = [];
  for (const candidate of all) {
    if (picked.every((p) => distanceKm(p.point, candidate.point) >= SPREAD_KM)) picked.push(candidate);
    if (picked.length === count) break;
  }
  return picked;
}
