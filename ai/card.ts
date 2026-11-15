import { MAX_TOPIC_DEPTH, TOPICS, type CardRequest, type TopicCard } from '../shared/types.js';

/**
 * The prompt for one topic card, and the checking of what comes back.
 * Kept apart from the HTTP handler so both can be read on their own.
 */

/** What the model is asked to return: the parts of a TopicCard it writes. */
export type CardBody = Pick<TopicCard, 'title' | 'hook' | 'facts' | 'subtopics'>;

const TOPIC_BRIEF: Record<string, string> = {
  cuisine: 'what people there grow, cook and eat',
  culture: 'how people there live: customs, arts, festivals, daily life',
  history: 'what has happened there over time',
  biosphere: 'the living world there: animals, plants, landscape, climate and sea life',
};

export const CARD_SYSTEM_PROMPT = `You write cards for an illustrated encyclopedia for curious readers of about ten and up, in the spirit of 1990s DK Eyewitness books: vivid, concrete and full of real information.

Every card is about ONE subject: the last item of the trail the reader has followed, as it exists in the place they are visiting. Everything on the card must be about that subject. A card about "Pre-colonial era" tells what actually happened before the colonial period: who lived there, which kingdoms or sultanates ruled, what they traded. A card about a dish says what goes into it, how it is made and when it is eaten.

What makes a good fact:
- It teaches something specific: it names real peoples, rulers, kingdoms, events, dishes, ingredients, techniques, species or landmarks.
- It could not be written by someone who knew nothing about the subject.
- It is one or two full sentences, 25 to 50 words.

Never write:
- Filler such as "has a rich heritage", "reflects the region's culture", "is a staple".
- Guesses: no "likely", "probably", "may have", "it is possible".
- The place's location, borders or administrative status, unless the card is about exactly that.
- The card's title restated as a fact.

Where the knowledge comes from:
- Use the reference text first. It was gathered for this card and usually holds the specifics you need.
- Add what is well established about the subject, the region or the country. If the town itself is obscure, give real specifics about the surrounding region or country, and say that is what they are about ("Across North Kalimantan...").
- Do not make up names, dates or numbers. Prefer a true general statement about the region to an invented detail about the town.

Reply with one JSON object and nothing else: no introduction, no code fences. Its keys:
- "title": a short heading for the subject, at most 8 words
- "hook": two or three sentences that introduce the subject with real substance
- "facts": exactly 3 strings, each a different specific fact about the subject, as described above
- "subtopics": specific named things to explore next (a particular dish, people, ruler, event, species or site), each 1 to 4 words. Never a broad category.`;

export function cardUserPrompt({ placeName, country, isOcean, topicPath, grounding }: CardRequest): string {
  const [topic, ...trail] = topicPath;
  const where = isOcean ? `${placeName} (open water)` : country && country !== placeName ? `${placeName}, ${country}` : placeName;
  const last = topicPath.length >= MAX_TOPIC_DEPTH;
  return [
    `Place: ${where}`,
    `Topic: ${topic} (${TOPIC_BRIEF[topic] ?? topic})`,
    trail.length > 0
      ? `The reader has followed this trail: ${topicPath.join(' > ')}. Write the card about "${trail[trail.length - 1]}", as it relates to this place and topic.`
      : `Write the opening card about the ${topic} of this place.`,
    last
      ? 'This is the deepest card. "subtopics" must be an empty list.'
      : '"subtopics" must list 2 or 3 specific named things, each narrower than this card and not already in the trail.',
    '',
    'Reference text:',
    grounding.trim() || '(none available; keep to what is widely established about this place or region)',
  ].join('\n');
}

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean && clean.length <= max ? clean : null;
};

/**
 * Reads the model's reply as a card body. Models often wrap JSON in code
 * fences or add a sentence around it, so the outermost {...} is taken.
 * Returns null if what is inside is not a usable card.
 */
export function parseCardBody(reply: string, atMaxDepth: boolean): CardBody | null {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(reply.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }

  const title = text(data.title, 90);
  const hook = text(data.hook, 700);
  const facts = Array.isArray(data.facts) ? data.facts.map((f) => text(f, 600)).filter((f): f is string => f !== null) : [];
  if (!title || !hook || facts.length < 3) return null;

  const listed = Array.isArray(data.subtopics) ? data.subtopics.map((s) => text(s, 60)).filter((s): s is string => s !== null) : [];
  const subtopics = atMaxDepth ? [] : [...new Set(listed)].slice(0, 3);
  if (!atMaxDepth && subtopics.length < 2) return null;

  return { title, hook, facts: [facts[0], facts[1], facts[2]], subtopics };
}

/** Checks a request body from the browser. Returns the cleaned request, or a reason it was refused. */
export function readCardRequest(body: unknown): CardRequest | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const placeName = text(b.placeName, 120);
  if (!placeName) return 'placeName is required';
  if (!Array.isArray(b.topicPath) || b.topicPath.length < 1 || b.topicPath.length > MAX_TOPIC_DEPTH) {
    return `topicPath must have 1 to ${MAX_TOPIC_DEPTH} entries`;
  }
  const topicPath = b.topicPath.map((t) => text(t, 80));
  if (topicPath.some((t) => t === null)) return 'topicPath entries must be short strings';
  if (!(TOPICS as readonly string[]).includes(topicPath[0]!)) return `topicPath must start with one of: ${TOPICS.join(', ')}`;
  return {
    placeName,
    country: text(b.country, 120) ?? '',
    isOcean: b.isOcean === true,
    topicPath: topicPath as string[],
    grounding: typeof b.grounding === 'string' ? b.grounding.slice(0, 9000) : '',
  };
}

/** The key a card is cached under: its place and its trail. */
export function cardId(placeName: string, country: string, topicPath: readonly string[]): string {
  return [placeName, country, ...topicPath].map((part) => part.trim().toLowerCase()).join('/');
}
