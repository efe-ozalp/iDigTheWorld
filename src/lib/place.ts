import type { LatLon, Place } from '../../shared/types';
import { reverseGeocode } from './geocode';
import { marineNameAt } from './ocean';
import { findPhoto, OCEAN_FALLBACK } from './photos';
import { localTimeIn } from './time';
import { findArticle, sentences, wikiSummary, wikivoyageExtract, type WikiSummary } from './wiki';

/** A place, plus short facts about it for the origin card and the field notes. */
export interface PlaceLookup {
  place: Place;
  facts: string[];
  /** Encyclopedia and travel-guide text about the place, for the AI cards to be written from. */
  grounding: string;
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
  const [geo, sea] = await Promise.all([reverseGeocode(point), marineNameAt(point)]);

  // Both geocoders down and not in any known sea: nothing can be said about this spot.
  if (!geo && !sea) return null;

  // Land the geocoders have no name for: in practice Antarctica, or a remote island.
  const unnamedLand = !geo?.found && !sea;
  const isOcean = !geo?.found && !unnamedLand;
  const country = geo?.found ? geo.country : unnamedLand && point.lat < -60 ? 'Antarctica' : '';
  const name = geo?.found ? geo.name : (sea ?? (country || 'Uncharted land'));

  // The place's own article where it has one. Failing that the text comes from
  // its country's article, but that article's pictures are not pictures of here.
  let own: WikiSummary | null;
  let article: WikiSummary | null;
  if (geo?.found) {
    const { region, wikipediaTitle } = geo;
    const titles = [wikipediaTitle ?? '', name, region ? `${name}, ${region}` : '', `${name}, ${country}`];
    own = await findArticle(point, titles, NEARBY_KM);
    article = own ?? (await wikiSummary(country));
  } else {
    own = sea || country ? await wikiSummary(sea ?? country) : null;
    article = own;
  }

  // A photo that shows the place itself; failing that, open water gets the bundled ocean view.
  const [found, guide] = await Promise.all([
    findPhoto({ point, name, region: geo?.found ? geo.region : '', country, article: own }),
    geo?.found ? wikivoyageExtract(article?.title ?? name) : Promise.resolve(null),
  ]);
  const photo = found ?? (isOcean ? OCEAN_FALLBACK : null);
  const grounding = [article?.extract ?? '', guide ? `From the travel guide: ${guide}` : ''].filter(Boolean).join('\n\n').slice(0, 4000);

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
    grounding,
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
