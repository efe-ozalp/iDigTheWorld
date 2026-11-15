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

/** File names that give away a map, flag, chart, scan or other non-view. */
const NOT_A_VIEW =
  /map|flag|locat|coat[_ ]of|emblem|seal[_ ]of|logo|icon|diagram|chart|graph|symbol|blason|wappen|orthographic|relief|topograph|bathymetr|\bcia\b|ortelius|mercator|atlas|carte|karte|mappa|maris|projection|visuali|modis|currents|gyre|monsoon|plates?[_ ]|portrait|earthquake|seismic|velocit|insar|sentinel|landsat|radar|infograph|scheme|poster|stamp|banknote|\bcoin|manuscript|newspaper|screenshot|census|population|election|\bplot\b/i;

/** The same giveaways in a file's description or author line, where only whole words are safe to match. */
const DESCRIBED_AS_NOT_A_VIEW =
  /\b(map|maps|chart|diagram|visuali[sz]ation|engraving|painting|painted|drawing|illustration|lithograph|figure|graph|plot|velocities|interferogram|satellite image|earthquakes?|portrait|close-?up|macro|logo|poster|scan|scanned)\b/i;

/**
 * Astronaut photographs are tagged with the point below the spacecraft, so a
 * search by coordinates returns them for places they do not show.
 */
const FROM_ORBIT = /Earth Science and Remote Sensing|Johnson Space Center|^File:ISS[-\d]|^File:STS[-\d]|\bNASA\b|\bESA\b/i;

/** Words that mark a picture as a view of a place, not of a thing that happens to be there. */
const SCENIC =
  /view|panoram|skyline|landscape|street|town|village|city|lake|river|mountain|hill|valley|beach|coast|harbou?r|\bport\b|bridge|square|plaza|\bpark\b|forest|field|farm|road|church|mosque|temple|cathedral|castle|palace|tower|station|market|downtown|aerial|sunset|sunrise|countryside|canyon|desert|island|\bbay\b|waterfall|glacier|volcano|ruins|monument|courthouse|savanna|plain|plateau|steppe|dunes?|cliff|gorge|reef|lagoon|rainforest|jungle|pasture|vineyard|terrace|oasis|fjord|wetland|marsh|prairie|highway|rooftop|old town|centre|center|falls|creek|stream|pond|shore|\bsea\b|ocean|\bdam\b|cove|peak|ridge|summit|woods|grove|garden|meadow|trail|lookout|scenery|nature reserve|national park/i;

const words = (page: CommonsPage, info: ImageInfo) =>
  `${page.title} ${plain(info.extmetadata?.ImageDescription?.value).slice(0, 300)}`;

/** Large, wide, a JPEG, and not a map, scan, artwork or close-up by its name, author or description. */
function usable(page: CommonsPage, info: ImageInfo): boolean {
  const shape = info.width / info.height;
  if (info.mime !== 'image/jpeg' || info.width < 1000 || shape < 1.15 || shape > 2.6) return false;
  if (NOT_A_VIEW.test(page.title)) return false;
  const described = `${plain(info.extmetadata?.Artist?.value)} ${plain(info.extmetadata?.ImageDescription?.value).slice(0, 300)}`;
  return !DESCRIBED_AS_NOT_A_VIEW.test(described);
}

const fromOrbit = (page: CommonsPage, info: ImageInfo) => FROM_ORBIT.test(`${page.title} ${plain(info.extmetadata?.Artist?.value)}`);

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

/** The Commons file behind an image address, or null if it is hosted elsewhere (and so probably non-free). */
function commonsFile(imageUrl: string | undefined): string | null {
  if (!imageUrl) return null;
  try {
    const parts = new URL(imageUrl).pathname.split('/');
    const at = parts.indexOf('commons');
    const file = at === -1 ? undefined : parts[at + 1] === 'thumb' ? parts[at + 4] : parts[at + 3];
    return file ? `File:${file}` : null;
  } catch {
    return null;
  }
}

/** The first of the named Commons files, in the order given, that is usable. */
async function firstUsableFile(files: readonly (string | null)[]): Promise<Photo | null> {
  const titles = [...new Set(files.filter((f): f is string => !!f).map(normal))]
    .filter((t) => /\.jpe?g$/i.test(t) && !NOT_A_VIEW.test(t))
    .slice(0, 12);
  if (titles.length === 0) return null;
  const pages = await commons(`titles=${encodeURIComponent(titles.join('|'))}`);
  for (const title of titles) {
    const page = pages.find((p) => p.title === title);
    const info = page?.imageinfo?.[0];
    if (page && info && usable(page, info)) return toPhoto(info);
  }
  return null;
}

interface SummaryReply {
  type?: string;
  originalimage?: { source: string };
  wikibase_item?: string;
}

async function wikidataImage(entity: string): Promise<string | null> {
  const reply = await fetchJson<{ claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }>(
    `https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&origin=*&property=P18&entity=${encodeURIComponent(entity)}`,
    TIMEOUT_MS,
  );
  const file = reply.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return file ? `File:${file}` : null;
}

/** The photographs used in the place's own Wikipedia article: lead image, Wikidata image, then the rest. */
async function fromOwnArticle(article: NonNullable<PhotoQuery['article']>): Promise<Photo | null> {
  const files: (string | null)[] = [commonsFile(article.imageUrl)];
  if (article.wikidataId) files.push(await wikidataImage(article.wikidataId).catch(() => null));
  try {
    const media = await fetchJson<{ items?: { title?: string; type?: string }[] }>(
      `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(article.title.replace(/ /g, '_'))}`,
      TIMEOUT_MS,
    );
    for (const item of media.items ?? []) if (item.type === 'image' && item.title) files.push(item.title);
  } catch {
    // The lead image is still worth trying.
  }
  return firstUsableFile(files);
}

/**
 * Commons pictures taken near the point or found by name. Anything can be
 * geotagged to a place (a pair of hands, a dinner plate), so a picture only
 * counts if its name or description mentions the place or reads as a view.
 */
function bestView(pages: CommonsPage[], names: readonly string[]): Photo | null {
  const lowered = names.filter(Boolean).map((n) => n.toLowerCase());
  const scored = pages
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info || !usable(page, info) || fromOrbit(page, info)) return null;
      const text = words(page, info).toLowerCase();
      const named = lowered.some((n) => text.includes(n));
      const scenic = SCENIC.test(text);
      if (!named && !scenic) return null;
      return { info, score: (named ? 2 : 0) + (scenic ? 1 : 0), pixels: info.width * info.height };
    })
    .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    .sort((a, b) => b.score - a.score || b.pixels - a.pixels);
  return scored[0] ? toPhoto(scored[0].info) : null;
}

async function fromNearby({ lat, lon }: LatLon, names: readonly string[]): Promise<Photo | null> {
  const pages = await commons(`generator=geosearch&ggsnamespace=6&ggsradius=10000&ggslimit=40&ggscoord=${lat.toFixed(4)}%7C${lon.toFixed(4)}`);
  return bestView(pages, names);
}

async function fromSearch(terms: string, names: readonly string[]): Promise<Photo | null> {
  const pages = await commons(`generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=${encodeURIComponent(`${terms} filetype:bitmap`)}`);
  return bestView(pages, names);
}

/**
 * The picture that stands for a wider area (a province, a country): the lead
 * image of its Wikipedia article, its Wikidata image, or the lead image of
 * its Wikivoyage guide. Only these curated pictures are used, never whatever
 * else the article happens to contain.
 */
async function fromWiderArea(title: string): Promise<Photo | null> {
  const files: (string | null)[] = [];
  const page = encodeURIComponent(title.replace(/ /g, '_'));
  const [pedia, voyage] = await Promise.all([
    fetchJson<SummaryReply>(`https://en.wikipedia.org/api/rest_v1/page/summary/${page}?redirect=true`, TIMEOUT_MS).catch(() => null),
    fetchJson<SummaryReply>(`https://en.wikivoyage.org/api/rest_v1/page/summary/${page}?redirect=true`, TIMEOUT_MS).catch(() => null),
  ]);
  files.push(commonsFile(pedia?.originalimage?.source));
  if (pedia?.wikibase_item) files.push(await wikidataImage(pedia.wikibase_item).catch(() => null));
  files.push(commonsFile(voyage?.originalimage?.source));
  return firstUsableFile(files);
}

export interface PhotoQuery {
  point: LatLon;
  /** The place's name. */
  name: string;
  /** The province or state it is in, and its country; empty when unknown or at sea. */
  region: string;
  country: string;
  /** The place's own Wikipedia article, when it has one. Not a stand-in such as its country's. */
  article?: { title: string; imageUrl?: string; wikidataId?: string } | null;
}

/**
 * Finds a photograph for a place, preferring one of the place itself and
 * widening step by step so that almost every place gets a relevant picture:
 *
 *   1. the photographs in the place's own Wikipedia article
 *   2. Commons pictures taken within 10 km that show a view or name the place
 *   3. a Commons search for the place by name
 *   4. the picture that stands for its province or state
 *   5. the picture that stands for its country
 *   6. a Commons search for the country's landscape
 *
 * Each step that fails or times out is skipped. Resolves with null when none
 * has a usable photo.
 */
export async function findPhoto({ point, name, region, country, article }: PhotoQuery): Promise<Photo | null> {
  const names = [name, region];
  const steps: (() => Promise<Photo | null>)[] = [
    () => (article ? fromOwnArticle(article) : Promise.resolve(null)),
    () => fromNearby(point, names),
    () => fromSearch(`"${name}" ${region || country}`.trim(), [name]),
    () => (region ? fromWiderArea(region) : Promise.resolve(null)),
    () => (country ? fromWiderArea(country) : Promise.resolve(null)),
    () => (country ? fromSearch(`${country} landscape`, [country]) : Promise.resolve(null)),
  ];
  for (const step of steps) {
    try {
      const photo = await step();
      if (photo) return photo;
    } catch {
      // Try the next step.
    }
  }
  return null;
}
