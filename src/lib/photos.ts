import type { LatLon } from '../../shared/types';
import { fetchJson } from './http';

/** A photograph with the credit that must always be shown beside it. */
export interface Photo {
  url: string;
  /** Author and licence, e.g. "Photo: A. Author, CC BY-SA 4.0, via Wikimedia Commons." */
  credit: string;
  /** The photo's file page on Wikimedia Commons. */
  pageUrl: string;
}

/** Bundled, public domain: the last resort for an ocean landing. */
export const OCEAN_FALLBACK: Photo = {
  url: '/photos/indian-ocean.jpg',
  credit: 'Open ocean seen from the International Space Station. Photo: NASA, public domain, via Wikimedia Commons.',
  pageUrl: 'https://commons.wikimedia.org/wiki/File:ISS006-E-44031_-_View_of_the_Indian_Ocean.jpg',
};

interface ImageInfo {
  thumburl?: string;
  url: string;
  descriptionurl: string;
  width: number;
  height: number;
  mime: string;
  extmetadata?: Record<string, { value?: string }>;
}

interface CommonsPage {
  title: string;
  index?: number;
  imageinfo?: ImageInfo[];
}

interface CommonsReply {
  query?: { pages?: Record<string, CommonsPage> };
}

const COMMONS = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=1920';
const TIMEOUT_MS = 5000;

const plain = (html: string | undefined) =>
  (html ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** File names that give away a map, flag, chart or other non-photograph. */
const NOT_A_VIEW =
  /map|flag|locat|coat[_ ]of|emblem|seal[_ ]of|logo|icon|diagram|chart|graph|symbol|blason|wappen|orthographic|relief|topograph|bathymetr|\bcia\b|ortelius|mercator|atlas|carte|karte|mappa|maris|projection|visuali|modis|currents|gyre|monsoon|plates?[_ ]|portrait/i;

/** The same giveaways in a file's description or author line, where only whole words are safe to match. */
const DESCRIBED_AS_MAP = /\b(map|maps|chart|diagram|visuali[sz]ation|engraving|painting|painted|drawing|illustration|lithograph)\b/i;

/**
 * Astronaut photographs are tagged with the point below the spacecraft, so a
 * search by coordinates returns them for places they do not show.
 */
const FROM_ORBIT = /Earth Science and Remote Sensing|Johnson Space Center|^File:ISS[-\d]|^File:STS[-\d]/i;

/** A photograph that will fill a wide screen: a reasonably large landscape JPEG of a real view. */
function suitable(page: CommonsPage, info: ImageInfo, allowOrbit: boolean): boolean {
  const shape = info.width / info.height;
  if (info.mime !== 'image/jpeg' || info.width < 1000 || shape < 1.15 || shape > 2.6) return false;
  if (NOT_A_VIEW.test(page.title)) return false;
  const described = `${plain(info.extmetadata?.Artist?.value)} ${plain(info.extmetadata?.ImageDescription?.value).slice(0, 200)}`;
  if (DESCRIBED_AS_MAP.test(described)) return false;
  return allowOrbit || !FROM_ORBIT.test(`${page.title} ${plain(info.extmetadata?.Artist?.value)}`);
}

function toPhoto(info: ImageInfo): Photo {
  const author = plain(info.extmetadata?.Artist?.value).slice(0, 70) || 'unknown author';
  const licence = plain(info.extmetadata?.LicenseShortName?.value) || 'see file page for licence';
  return {
    url: info.thumburl ?? info.url,
    credit: `Photo: ${author}, ${licence}, via Wikimedia Commons.`,
    pageUrl: info.descriptionurl,
  };
}

async function commons(query: string): Promise<CommonsPage[]> {
  const reply = await fetchJson<CommonsReply>(`${COMMONS}&${query}`, TIMEOUT_MS);
  return Object.values(reply.query?.pages ?? {});
}

const normal = (title: string) => decodeURIComponent(title).replace(/_/g, ' ');

/** The first of the named Commons files, in the order given, that makes a good backdrop. */
async function firstSuitableFile(files: readonly string[]): Promise<Photo | null> {
  const titles = [...new Set(files.map(normal))].filter((t) => /\.jpe?g$/i.test(t) && !NOT_A_VIEW.test(t)).slice(0, 12);
  if (titles.length === 0) return null;
  const pages = await commons(`titles=${encodeURIComponent(titles.join('|'))}`);
  for (const title of titles) {
    const page = pages.find((p) => p.title === title);
    const info = page?.imageinfo?.[0];
    if (page && info && suitable(page, info, true)) return toPhoto(info);
  }
  return null;
}

/** Source 1: the photographs used in the place's own Wikipedia article, lead image first. */
async function fromArticle(articleTitle: string, leadImageUrl: string | undefined): Promise<Photo | null> {
  const files: string[] = [];
  if (leadImageUrl) {
    // Only images hosted on Commons qualify; ones uploaded to Wikipedia itself are usually non-free.
    const parts = new URL(leadImageUrl).pathname.split('/');
    const at = parts.indexOf('commons');
    const file = at === -1 ? undefined : parts[at + 1] === 'thumb' ? parts[at + 4] : parts[at + 3];
    if (file) files.push(`File:${file}`);
  }
  try {
    const media = await fetchJson<{ items?: { title?: string; type?: string }[] }>(
      `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(articleTitle.replace(/ /g, '_'))}`,
      TIMEOUT_MS,
    );
    for (const item of media.items ?? []) if (item.type === 'image' && item.title) files.push(item.title);
  } catch {
    // The lead image, if any, is still worth trying.
  }
  return firstSuitableFile(files);
}

/** Source 2: the image Wikidata records for the place (property P18). */
async function fromWikidata(entity: string): Promise<Photo | null> {
  const reply = await fetchJson<{ claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }>(
    `https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&origin=*&property=P18&entity=${encodeURIComponent(entity)}`,
    TIMEOUT_MS,
  );
  const files = (reply.claims?.P18 ?? []).map((c) => c.mainsnak?.datavalue?.value).filter((f): f is string => !!f);
  return firstSuitableFile(files.map((f) => `File:${f}`));
}

/** Source 3: photos on Commons taken within 10 km of the point, sharpest first. Never ones taken from orbit. */
async function fromNearby({ lat, lon }: LatLon): Promise<Photo | null> {
  const pages = await commons(`generator=geosearch&ggsnamespace=6&ggsradius=10000&ggslimit=30&ggscoord=${lat.toFixed(4)}%7C${lon.toFixed(4)}`);
  const best = pages
    .filter((page) => page.imageinfo?.[0] && suitable(page, page.imageinfo[0], false))
    .sort((a, b) => b.imageinfo![0].width * b.imageinfo![0].height - a.imageinfo![0].width * a.imageinfo![0].height)[0];
  return best ? toPhoto(best.imageinfo![0]) : null;
}

/** Source 4: a search of Commons for the place's name, best match first. */
async function fromSearch(terms: string): Promise<Photo | null> {
  const pages = await commons(`generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${encodeURIComponent(`${terms} filetype:bitmap`)}`);
  pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const hit = pages.find((page) => page.imageinfo?.[0] && suitable(page, page.imageinfo[0], false));
  return hit ? toPhoto(hit.imageinfo![0]) : null;
}

export interface PhotoQuery {
  point: LatLon;
  /** Words to search Commons for: the place's name, with its region or country to tell namesakes apart. */
  search: string;
  /** The place's Wikipedia article, when one was found. */
  article?: { title: string; imageUrl?: string; wikidataId?: string } | null;
}

/**
 * Finds a photograph that actually shows the place. Tries, in order: the
 * place's Wikipedia article, its Wikidata image, Commons photos taken nearby,
 * and a Commons search for its name. Each source that fails or times out is
 * skipped. Resolves with null when none has a usable photo.
 */
export async function findPhoto({ point, search, article }: PhotoQuery): Promise<Photo | null> {
  const sources: (() => Promise<Photo | null>)[] = [
    () => (article ? fromArticle(article.title, article.imageUrl) : Promise.resolve(null)),
    () => (article?.wikidataId ? fromWikidata(article.wikidataId) : Promise.resolve(null)),
    () => fromNearby(point),
    () => fromSearch(search),
  ];
  for (const source of sources) {
    try {
      const photo = await source();
      if (photo) return photo;
    } catch {
      // Try the next source.
    }
  }
  return null;
}
