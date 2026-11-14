import type { LatLon, Place } from '../../shared/types';
import { reverseGeocode } from './geocode';
import { marineNameAt } from './ocean';
import { commonsPhotoFromUrl, commonsPhotoNear, OCEAN_FALLBACK, type Photo } from './photos';
import { localTimeIn } from './time';
import { findArticle, sentences, wikiSummary, type WikiSummary } from './wiki';

/** A place, plus short facts about it for the origin card and the field notes. */
export interface PlaceLookup {
  place: Place;
  facts: string[];
}

/** How far an article's subject may be from the point and still count as "here". */
const NEARBY_KM = 150;

/** Ships keep nautical time: one hour per 15° of longitude. IANA writes UTC+6 as "Etc/GMT-6". */
function nauticalZone(lon: number): string {
  const hours = Math.round(lon / 15);
  return hours === 0 ? 'Etc/GMT' : `Etc/GMT${hours > 0 ? '-' : '+'}${Math.abs(hours)}`;
}

async function landZone({ lat, lon }: LatLon): Promise<string> {
  try {
    const { default: tzlookup } = await import('tz-lookup');
    return tzlookup(lat, lon);
  } catch {
    return nauticalZone(lon);
  }
}

async function build(point: LatLon): Promise<PlaceLookup | null> {
  // Started together: none of these depends on another.
  const photoNearby = commonsPhotoNear(point);
  const [geo, sea] = await Promise.all([reverseGeocode(point), marineNameAt(point)]);

  // Both geocoders down and not in any known sea: nothing can be said about this spot.
  if (!geo && !sea) return null;

  // Land the geocoders have no name for: in practice Antarctica, or a remote island.
  const unnamedLand = !geo?.found && !sea;
  const isOcean = !geo?.found && !unnamedLand;
  const country = geo?.found ? geo.country : unnamedLand && point.lat < -60 ? 'Antarctica' : '';
  const name = geo?.found ? geo.name : (sea ?? (country || 'Uncharted land'));

  let article: WikiSummary | null;
  if (geo?.found) {
    const { region, wikipediaTitle } = geo;
    const titles = [wikipediaTitle ?? '', name, region ? `${name}, ${region}` : '', `${name}, ${country}`];
    article = (await findArticle(point, titles, NEARBY_KM)) ?? (await wikiSummary(country));
  } else {
    article = sea || country ? await wikiSummary(sea ?? country) : null;
  }

  // Photos, in order: taken nearby, then the article's own picture (on land,
  // where it is likely to be a view and not a chart), then the bundled ocean view.
  let photo: Photo | null = await photoNearby;
  if (!photo && !isOcean && article?.imageUrl) photo = await commonsPhotoFromUrl(article.imageUrl);
  if (!photo && isOcean) photo = OCEAN_FALLBACK;

  // The opening of the article is the summary and the sentences after it are
  // the facts. A short article gives up only its first sentence as summary.
  const lines = article ? sentences(article.extract) : [];
  const lead = lines.length >= 4 ? 2 : 1;
  const timeZone = isOcean ? nauticalZone(point.lon) : await landZone(point);

  return {
    place: {
      ...point,
      name,
      country,
      isOcean,
      oceanName: isOcean ? name : undefined,
      summary: lines.slice(0, lead).join(' '),
      summaryUrl: article?.pageUrl,
      photoUrl: photo?.url ?? '',
      photoCredit: photo?.credit ?? '',
      photoPageUrl: photo?.pageUrl,
      localTime: localTimeIn(timeZone) ?? '',
      timeZone,
    },
    facts: lines.slice(lead, lead + 3),
  };
}

const cache = new Map<string, Promise<PlaceLookup | null>>();

/**
 * Finds out what is at a coordinate: its name, a summary, a photo and the
 * local time. Every source has a timeout and a fallback, and this never
 * rejects: it resolves with null when nothing at all could be found. Results
 * are remembered by coordinates rounded to 0.01°.
 */
export function lookupPlace(point: LatLon): Promise<PlaceLookup | null> {
  const key = `${point.lat.toFixed(2)},${point.lon.toFixed(2)}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = build(point).catch((err) => {
      console.error('Place lookup failed:', err);
      return null;
    });
    cache.set(key, pending);
    // A failed lookup should be retried next time, not remembered.
    void pending.then((result) => {
      if (!result) cache.delete(key);
    });
  }
  return pending;
}
