import type { GeocodeResult } from '../shared/types.js';

/**
 * GET /api/geocode?lat=..&lon=..
 *
 * Reverse geocodes through Nominatim on the browser's behalf, because
 * Nominatim's usage policy asks for an identifying User-Agent (which browsers
 * will not let a page set) and at most one request per second.
 *
 * Answers are cached by coordinates rounded to 0.01°, so repeat digs during a
 * demo cost nothing. On any failure it answers 502 or 503 and the browser
 * falls back to BigDataCloud.
 */

const UPSTREAM_TIMEOUT_MS = 4000;
const MIN_GAP_MS = 1100;
/** Rather than queue for long, tell the browser to use its fallback. */
const MAX_QUEUE_MS = 2500;
const CACHE_LIMIT = 2000;

const cache = new Map<string, GeocodeResult>();
/** When the next upstream request may start. */
let nextSlot = 0;

function userAgent(): string {
  const contact = process.env.NOMINATIM_CONTACT?.trim();
  return `iDigTheWorld/0.1 (hackathon demo${contact ? `; ${contact}` : ''})`;
}

const json = (status: number, body: unknown, cacheControl = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cacheControl },
  });

interface NominatimReply {
  error?: string;
  name?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string> | null;
}

function toResult(reply: NominatimReply): GeocodeResult {
  const a = reply.address ?? {};
  if (reply.error || !a.country) return { found: false, name: '', region: '', country: '' };
  const name = a.city || a.town || a.village || a.municipality || a.suburb || a.county || a.state_district || a.state || reply.name || a.country;
  const wikipedia = reply.extratags?.wikipedia;
  return {
    found: true,
    name,
    region: a.state && a.state !== name ? a.state : '',
    country: a.country,
    wikipediaTitle: wikipedia?.startsWith('en:') ? wikipedia.slice(3) : undefined,
  };
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  if (!params.get('lat') || !params.get('lon') || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return json(400, { error: 'lat and lon must be numbers within range' });
  }

  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cache.get(key);
  if (cached) return json(200, cached, 'public, max-age=86400');

  // Take the next one-second slot, or bow out if the queue is already long.
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  if (start - now > MAX_QUEUE_MS) return json(503, { error: 'busy' });
  nextSlot = start + MIN_GAP_MS;
  if (start > now) await new Promise((resolve) => setTimeout(resolve, start - now));

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&zoom=12&addressdetails=1&extratags=1&accept-language=en`;
    const res = await fetch(url, { headers: { 'User-Agent': userAgent() }, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    if (!res.ok) return json(502, { error: 'upstream', status: res.status });
    const result = toResult((await res.json()) as NominatimReply);
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return json(200, result, 'public, max-age=86400');
  } catch (err) {
    console.error('[geocode] Nominatim request failed:', (err as Error)?.name ?? err);
    return json(502, { error: 'upstream' });
  }
}
