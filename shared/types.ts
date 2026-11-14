/**
 * Data shapes shared by the browser app (src/) and the serverless functions
 * (api/). Keep this file free of DOM- or Node-specific code so both can import it.
 */

export interface LatLon {
  /** Degrees north of the equator, -90 to 90. */
  lat: number;
  /** Degrees east of Greenwich, -180 to 180. */
  lon: number;
}

/** Somewhere a dig starts or ends: a town, a stretch of countryside, or open sea. */
export interface Place extends LatLon {
  name: string;
  /** Empty for international waters. */
  country: string;
  isOcean: boolean;
  /** The ocean or sea, set when isOcean is true. */
  oceanName?: string;
  summary: string;
  photoUrl: string;
  /** Who made the photo and under what licence, e.g. "Photo: A. Author, CC BY-SA 4.0". Always shown with the photo. */
  photoCredit: string;
  /** The photo's page at its source (for Wikimedia Commons, the file page), which the credit links to. */
  photoPageUrl?: string;
  /** Wall-clock time at the place when it was looked up, e.g. "Saturday 9:41 PM". */
  localTime: string;
  /**
   * IANA zone such as "Pacific/Auckland". When present the UI renders a live
   * clock from it, so cached places don't show a stale localTime.
   */
  timeZone?: string;
}

/** The four subjects every land arrival can be explored through. Open water offers only the biosphere. */
export const TOPICS = ['cuisine', 'culture', 'history', 'biosphere'] as const;
export type Topic = (typeof TOPICS)[number];

/** One card in the "dig deeper" tree. */
export interface TopicCard {
  id: string;
  placeName: string;
  /**
   * The trail from the place down to this card, e.g. ["biosphere", "Waihi Falls"].
   * Empty for a place's overview card.
   */
  topicPath: string[];
  title: string;
  hook: string;
  facts: [string, string, string];
  /** Two or three follow-on topics; each opens a card one level deeper. */
  subtopics: string[];
}

/** A complete trip: where it starts, where it surfaces, and any cards already written for it. */
export interface Dig {
  id: string;
  origin: Place;
  destination: Place;
  cards: TopicCard[];
}
