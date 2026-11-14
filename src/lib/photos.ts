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

/** Bundled, public domain: used when no photo of an ocean landing can be found. */
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

interface CommonsReply {
  query?: { pages?: Record<string, { index?: number; imageinfo?: ImageInfo[] }> };
}

const API = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=1920';
const TIMEOUT_MS = 5000;

const plain = (html: string | undefined) =>
  (html ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

function toPhoto(info: ImageInfo): Photo {
  const author = plain(info.extmetadata?.Artist?.value).slice(0, 70) || 'unknown author';
  const licence = plain(info.extmetadata?.LicenseShortName?.value) || 'see file page for licence';
  return {
    url: info.thumburl ?? info.url,
    credit: `Photo: ${author}, ${licence}, via Wikimedia Commons.`,
    pageUrl: info.descriptionurl,
  };
}

/** A photograph that will fill a wide screen: a reasonably large landscape JPEG. */
function suitable(info: ImageInfo): boolean {
  const shape = info.width / info.height;
  return info.mime === 'image/jpeg' && info.width >= 1200 && shape >= 1.2 && shape <= 2.4;
}

/** The best suitable photo on Wikimedia Commons taken within 10 km of a point. */
export async function commonsPhotoNear({ lat, lon }: LatLon): Promise<Photo | null> {
  try {
    const reply = await fetchJson<CommonsReply>(
      `${API}&generator=geosearch&ggsnamespace=6&ggsradius=10000&ggslimit=30&ggscoord=${lat.toFixed(4)}%7C${lon.toFixed(4)}`,
      TIMEOUT_MS,
    );
    // Of the photos taken nearby, the sharpest one makes the best backdrop.
    const best = Object.values(reply.query?.pages ?? {})
      .map((page) => page.imageinfo?.[0])
      .filter((info): info is ImageInfo => info !== undefined && suitable(info))
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return best ? toPhoto(best) : null;
  } catch {
    return null;
  }
}

/**
 * The credit-bearing version of a Wikipedia article's lead image. Only images
 * hosted on Commons qualify; ones uploaded to Wikipedia itself are usually
 * non-free and are skipped.
 */
export async function commonsPhotoFromUrl(imageUrl: string): Promise<Photo | null> {
  try {
    const parts = new URL(imageUrl).pathname.split('/');
    const at = parts.indexOf('commons');
    if (at === -1) return null;
    const file = parts[at + 1] === 'thumb' ? parts[at + 4] : parts[at + 3];
    if (!file) return null;
    const reply = await fetchJson<CommonsReply>(`${API}&titles=${encodeURIComponent(`File:${decodeURIComponent(file)}`)}`, TIMEOUT_MS);
    const info = Object.values(reply.query?.pages ?? {})[0]?.imageinfo?.[0];
    // Lead images are often maps, flags or diagrams; only a photograph will do.
    return info && info.mime === 'image/jpeg' && info.width >= 800 && info.width >= info.height ? toPhoto(info) : null;
  } catch {
    return null;
  }
}
