import type { LatLon } from '../../shared/types';

/**
 * Tells which sea or ocean a point lies in, using Natural Earth's 1:50m marine
 * polygons bundled in src/data/marine.json (names only, coordinates rounded to
 * 0.01°). Reverse geocoders return nothing for open water, so this is how an
 * ocean landing gets its name. Works offline.
 */

type Ring = [number, number][];

interface MarineArea {
  name: string;
  /** Natural Earth's class: ocean, sea, bay, gulf, strait and so on. */
  kind: string;
  /** Lower ranks are larger, better-known bodies of water. */
  rank: number;
  /** west, south, east, north */
  bbox: [number, number, number, number];
  /** Each polygon is an outer ring followed by any holes. */
  polygons: Ring[][];
}

let loading: Promise<MarineArea[]> | undefined;

/** Loads the polygons once, in their own chunk, the first time they are needed. */
function marineAreas(): Promise<MarineArea[]> {
  loading ??= import('../data/marine.json').then((m) => m.default as unknown as MarineArea[]);
  return loading;
}

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inArea(lon: number, lat: number, area: MarineArea): boolean {
  const [west, south, east, north] = area.bbox;
  if (lon < west || lon > east || lat < south || lat > north) return false;
  return area.polygons.some(([outer, ...holes]) => inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h)));
}

/**
 * The name of the body of water at a point, or null if the point is not in
 * one. Where areas overlap (a bay inside a sea inside an ocean) the most
 * local one wins.
 */
export async function marineNameAt({ lat, lon }: LatLon): Promise<string | null> {
  try {
    const hits = (await marineAreas()).filter((area) => inArea(lon, lat, area));
    if (hits.length === 0) return null;
    hits.sort((a, b) => b.rank - a.rank);
    return hits[0].name;
  } catch {
    return null;
  }
}
