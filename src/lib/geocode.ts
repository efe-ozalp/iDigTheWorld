import type { GeocodeResult, LatLon } from '../../shared/types';
import { fetchJson } from './http';

interface BigDataCloudReply {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

/**
 * Names the place at a coordinate. Asks our own /api/geocode (Nominatim) first
 * and, if that fails or is slow, BigDataCloud's free browser endpoint.
 * Resolves with null only when both are unavailable.
 */
export async function reverseGeocode({ lat, lon }: LatLon): Promise<GeocodeResult | null> {
  try {
    return await fetchJson<GeocodeResult>(`/api/geocode?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, 4500);
  } catch {
    // Fall through to the second geocoder.
  }
  try {
    const reply = await fetchJson<BigDataCloudReply>(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&localityLanguage=en`,
      4000,
    );
    const country = reply.countryName ?? '';
    if (!country) return { found: false, name: '', region: '', country: '' };
    const name = reply.city || reply.locality || reply.principalSubdivision || country;
    const region = reply.principalSubdivision && reply.principalSubdivision !== name ? reply.principalSubdivision : '';
    return { found: true, name, region, country };
  } catch {
    return null;
  }
}
