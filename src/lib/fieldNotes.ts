import type { LatLon, Place } from '../../shared/types';
import { EARTH_DIAMETER_KM, formatCoords } from './geo';

/** Where a piece of text came from, shown as a small "Source" line under it. */
export interface NotesSource {
  label: string;
  url: string;
}

/**
 * One block of the field notes. The scroll renders whatever list of sections
 * it is given, so a new source of information only has to add a section here.
 */
export type NotesSection =
  | { kind: 'summary'; id: string; heading: string; text: string; source?: NotesSource }
  | { kind: 'facts'; id: string; heading: string; facts: readonly string[] }
  | { kind: 'rows'; id: string; heading: string; rows: readonly { label: string; value: string }[] };

/** Names the site a page belongs to, e.g. "Wikipedia" for any Wikipedia article. */
function sourceOf(url: string | undefined): NotesSource | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname;
    if (host.endsWith('wikipedia.org')) return { label: 'Wikipedia', url };
    if (host.endsWith('wikivoyage.org')) return { label: 'Wikivoyage', url };
    return { label: host.replace(/^www\./, ''), url };
  } catch {
    return undefined;
  }
}

interface NotesInput {
  /** True at the far end of the tunnel; false at the start, where the digging is still ahead. */
  travelled: boolean;
  /** How far the swim to shore was, when there was one. */
  swamKm?: number;
  exit: LatLon;
  /** What is at the far end, or null when it has not been looked up. */
  place: Place | null;
  facts: readonly string[];
  /** The time there right now; empty when unknown. */
  localTime: string;
}

/**
 * Lays out what is known about the far end of the tunnel: the summary, the
 * facts, then the numbers. Every part has a fallback, so the notes are never
 * empty even when nothing has been written about the place.
 */
export function buildFieldNotes({ travelled, swamKm, exit, place, facts, localTime }: NotesInput): NotesSection[] {
  const sections: NotesSection[] = [];

  if (place?.summary) {
    sections.push({
      kind: 'summary',
      id: 'about',
      // Seas and oceans take the article: "About the Indian Ocean".
      heading: place.isOcean ? `About the ${place.name}` : `About ${place.name}`,
      text: place.summary,
      source: sourceOf(place.summaryUrl),
    });
  } else {
    sections.push({
      kind: 'summary',
      id: 'about',
      heading: 'About this spot',
      text: place
        ? 'Nobody has written this place up yet, so the numbers below are all the notes there are.'
        : 'Nothing could be looked up for this spot, so the numbers below are all the notes there are.',
    });
  }

  if (facts.length > 0) {
    sections.push({ kind: 'facts', id: 'facts', heading: 'Did you know?', facts });
  }

  const rows = [{ label: travelled ? 'Distance travelled' : 'Tunnel ahead', value: `${EARTH_DIAMETER_KM.toLocaleString('en-US')} km` }];
  if (swamKm !== undefined) rows.push({ label: 'Swim to shore', value: `${Math.round(swamKm).toLocaleString('en-US')} km` });
  if (localTime) rows.push({ label: 'Local time', value: localTime });
  rows.push({ label: 'Coordinates', value: formatCoords(exit) });
  sections.push({ kind: 'rows', id: 'numbers', heading: 'By the numbers', rows });

  return sections;
}
