import type { CardRequest, Place, TopicCard } from '../../shared/types';
import { sentences } from './wiki';

/**
 * Topic cards for the browser: asks /api/card, remembers the answers, and
 * always has something to show.
 */

/** Either a written card, or the encyclopedia's own words when no card could be had. */
export type CardResult = { kind: 'card'; card: TopicCard } | { kind: 'summary'; text: string };

const TIMEOUT_MS = 16_000;
const STORAGE_PREFIX = 'idig:card:v1:';

const memory = new Map<string, TopicCard>();
const inFlight = new Map<string, Promise<CardResult>>();

const keyFor = (place: Place, topicPath: readonly string[]) =>
  [place.name, place.country, ...topicPath].map((part) => part.trim().toLowerCase()).join('/');

function isCard(value: unknown): value is TopicCard {
  const c = value as TopicCard | null;
  return (
    !!c &&
    typeof c.title === 'string' &&
    typeof c.hook === 'string' &&
    Array.isArray(c.facts) &&
    c.facts.length === 3 &&
    c.facts.every((f) => typeof f === 'string') &&
    Array.isArray(c.subtopics) &&
    c.subtopics.every((s) => typeof s === 'string')
  );
}

function remembered(key: string): TopicCard | undefined {
  const held = memory.get(key);
  if (held) return held;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_PREFIX + key) ?? 'null') as unknown;
    if (isCard(stored)) {
      memory.set(key, stored);
      return stored;
    }
  } catch {
    // Storage is unavailable or holds something unreadable: carry on without it.
  }
  return undefined;
}

function remember(key: string, card: TopicCard): void {
  memory.set(key, card);
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(card));
  } catch {
    // Full or blocked storage only costs the cache.
  }
}

/** The stand-in when the model is slow or fails: the opening of the encyclopedia text. */
function summaryOf(place: Place, grounding: string): CardResult {
  const text = sentences(grounding || place.summary).slice(0, 3).join(' ');
  return { kind: 'summary', text: text || `Nothing more has been written about ${place.name} yet.` };
}

/**
 * The card for a place and a trail of topics. Never rejects: when the model
 * cannot be reached, is too slow, or answers badly, it resolves with the
 * encyclopedia summary instead. Only real cards are remembered, so a failed
 * card is tried again the next time it is asked for.
 */
export function getCard(place: Place, topicPath: readonly string[], grounding: string): Promise<CardResult> {
  const key = keyFor(place, topicPath);
  const held = remembered(key);
  if (held) return Promise.resolve({ kind: 'card', card: held });

  let pending = inFlight.get(key);
  if (!pending) {
    const body: CardRequest = {
      placeName: place.name,
      country: place.country,
      isOcean: place.isOcean,
      topicPath: [...topicPath],
      grounding,
    };
    pending = fetch('/api/card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
      .then(async (res): Promise<CardResult> => {
        const data = res.ok ? ((await res.json()) as { card?: unknown }) : null;
        if (!data || !isCard(data.card)) return summaryOf(place, grounding);
        remember(key, data.card);
        return { kind: 'card', card: data.card };
      })
      .catch(() => summaryOf(place, grounding))
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}

/** Starts writing the opening card of each topic, so it is ready when its object is clicked. */
export function prefetchCards(place: Place, topics: readonly string[], grounding: string): void {
  for (const topic of topics) void getCard(place, [topic], grounding);
}
