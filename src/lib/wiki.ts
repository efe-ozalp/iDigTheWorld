import type { LatLon } from '../../shared/types';
import { distanceKm } from './geo';
import { fetchJson } from './http';

/** The parts of a Wikipedia article summary the app uses. */
export interface WikiSummary {
  title: string;
  extract: string;
  pageUrl: string;
  coordinates?: LatLon;
  /** The article's lead image, when it has one. */
  imageUrl?: string;
  /** The Wikidata item for the article's subject, e.g. "Q1239". */
  wikidataId?: string;
}

interface SummaryReply {
  type?: string;
  title?: string;
  extract?: string;
  coordinates?: { lat: number; lon: number };
  originalimage?: { source: string };
  wikibase_item?: string;
  content_urls?: { desktop?: { page?: string } };
}

const TIMEOUT_MS = 4000;

/** The summary of one English Wikipedia article, or null if there is no such article. */
export async function wikiSummary(title: string): Promise<WikiSummary | null> {
  try {
    const reply = await fetchJson<SummaryReply>(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`,
      TIMEOUT_MS,
    );
    if (reply.type !== 'standard' || !reply.extract || !reply.title) return null;
    return {
      title: reply.title,
      extract: reply.extract,
      pageUrl: reply.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(reply.title)}`,
      coordinates: reply.coordinates,
      imageUrl: reply.originalimage?.source,
      wikidataId: reply.wikibase_item,
    };
  } catch {
    return null;
  }
}

/** The opening of the Wikivoyage travel guide for a place, when there is one. */
export async function wikivoyageExtract(title: string): Promise<string | null> {
  try {
    const reply = await fetchJson<SummaryReply>(
      `https://en.wikivoyage.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`,
      TIMEOUT_MS,
    );
    return reply.type === 'standard' && reply.extract ? reply.extract : null;
  } catch {
    return null;
  }
}

interface GeosearchReply {
  query?: { geosearch?: { title: string }[] };
}

/** Titles of the articles about things nearest a point, closest first. */
async function articlesNear({ lat, lon }: LatLon): Promise<string[]> {
  try {
    const reply = await fetchJson<GeosearchReply>(
      `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat.toFixed(4)}%7C${lon.toFixed(4)}&gsradius=10000&gslimit=3&format=json&origin=*`,
      TIMEOUT_MS,
    );
    return reply.query?.geosearch?.map((hit) => hit.title) ?? [];
  } catch {
    return [];
  }
}

/**
 * Finds the article that best describes a place. Tries the given titles in
 * order, then whatever Wikipedia has nearest the point. A title that turns
 * out to be about somewhere far away, or about something that is not a place
 * at all, is skipped.
 */
export async function findArticle(point: LatLon, titles: readonly string[], maxKm: number): Promise<WikiSummary | null> {
  const tried = new Set<string>();
  const attempt = async (title: string) => {
    if (!title || tried.has(title)) return null;
    tried.add(title);
    const summary = await wikiSummary(title);
    // An article about a place says where it is. One with no coordinates is
    // about something else that shares the name: a band, a person, a film.
    if (!summary?.coordinates || distanceKm(point, summary.coordinates) > maxKm) return null;
    return summary;
  };

  for (const title of titles) {
    const summary = await attempt(title);
    if (summary) return summary;
  }
  for (const title of await articlesNear(point)) {
    const summary = await attempt(title);
    if (summary) return summary;
  }
  return null;
}

/**
 * Splits a summary into sentences. Rough but good enough for display: a break
 * is a full stop, question mark or exclamation mark followed by a space and a
 * capital letter, and very short pieces (abbreviations) are joined back on.
 */
export function sentences(text: string): string[] {
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z"“])/);
  const out: string[] = [];
  for (const part of parts) {
    if (out.length > 0 && out[out.length - 1].length < 30) out[out.length - 1] += ` ${part}`;
    else out.push(part);
  }
  return out;
}
