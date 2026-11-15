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

export const CARD_SYSTEM_PROMPT = `You write short cards for an illustrated encyclopedia for curious readers of about ten and up, in the spirit of 1990s DK Eyewitness books: warm, clear, full of wonder, never babyish.

Accuracy rules:
- Stay consistent with the reference text you are given.
- Do not invent specific names, dates, numbers or statistics. Use one only if it is in the reference text or is very widely established.
- If you know little about this exact place, write truthfully about the wider region or the general subject instead of guessing details.

Reply with one JSON object and nothing else: no introduction, no code fences. Its keys:
- "title": a short heading, at most 8 words
- "hook": one inviting sentence
- "facts": exactly 3 strings, each one plain sentence of at most 30 words
- "subtopics": follow-on things to explore next, each 1 to 4 words`;

export function cardUserPrompt({ placeName, country, isOcean, topicPath, grounding }: CardRequest): string {
  const [topic, ...trail] = topicPath;
  const where = isOcean ? `${placeName} (open water)` : country && country !== placeName ? `${placeName}, ${country}` : placeName;
  const last = topicPath.length >= MAX_TOPIC_DEPTH;
  return [
    `Place: ${where}`,
    `Topic: ${topic} (${TOPIC_BRIEF[topic] ?? topic})`,
    trail.length > 0
      ? `The reader has followed this trail: ${topicPath.join(' > ')}. Write the card about "${trail[trail.length - 1]}", as it relates to this place and topic.`
      : 'Write the opening card for this topic at this place.',
    last
      ? 'This is the deepest card. "subtopics" must be an empty list.'
      : '"subtopics" must list 2 or 3 things, each narrower than this card and not already in the trail.',
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
  const hook = text(data.hook, 320);
  const facts = Array.isArray(data.facts) ? data.facts.map((f) => text(f, 320)).filter((f): f is string => f !== null) : [];
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
    grounding: typeof b.grounding === 'string' ? b.grounding.slice(0, 6000) : '',
  };
}

/** The key a card is cached under: its place and its trail. */
export function cardId(placeName: string, country: string, topicPath: readonly string[]): string {
  return [placeName, country, ...topicPath].map((part) => part.trim().toLowerCase()).join('/');
}
