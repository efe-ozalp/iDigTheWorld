import type { Place } from '../../shared/types';
import { fetchJson } from './http';

/**
 * Gathers reference text for one topic card: the parts of Wikipedia that are
 * actually about the card's subject, not just the opening of the place's
 * article. The model writes a far more specific card when it is handed the
 * place's own "History" or "Cuisine" section and the articles about the thing
 * being dug into.
 */

const API = 'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*';
const TIMEOUT_MS = 4500;
const SECTION_CHARS = 2600;
const SEARCH_CHARS = 900;
const COUNTRY_CHARS = 3000;
const TOTAL_CHARS = 8500;

/** Section headings in a place's article that belong to each topic. */
const SECTION: Record<string, RegExp> = {
  cuisine: /cuisine|food|gastronom|dish|culinar|agricultur|econom|fishing|farming/i,
  culture: /cultur|\barts?\b|music|festival|religio|tradition|demograph|language|ethnic|people|society|sport|architecture/i,
  history: /histor|etymolog|coloni|kingdom|sultanate|independence|\bwar\b|founding|origins?/i,
  biosphere: /geograph|climate|flora|fauna|wildlife|ecolog|environment|biodivers|nature|marine|geolog|conservation/i,
};

/** The country-wide article on each topic, e.g. "History of Indonesia". Redirects cover the variants. */
const COUNTRY_ARTICLE: Record<string, (country: string) => string> = {
  cuisine: (country) => `Cuisine of ${country}`,
  culture: (country) => `Culture of ${country}`,
  history: (country) => `History of ${country}`,
  biosphere: (country) => `Wildlife of ${country}`,
};

/** What to search for when the trail is still at the topic itself. */
const SEARCH_WORDS: Record<string, string> = {
  cuisine: 'cuisine',
  culture: 'culture',
  history: 'history',
  biosphere: 'wildlife',
};

const articleText = new Map<string, Promise<string>>();

/** The whole of an article as plain text, with "== Heading ==" lines between sections. */
function fullText(title: string): Promise<string> {
  let pending = articleText.get(title);
  if (!pending) {
    pending = fetchJson<{ query?: { pages?: Record<string, { extract?: string }> } }>(
      `${API}&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&titles=${encodeURIComponent(title)}`,
      TIMEOUT_MS,
    )
      .then((reply) => Object.values(reply.query?.pages ?? {})[0]?.extract ?? '')
      .catch(() => '');
    articleText.set(title, pending);
  }
  return pending;
}

/** The sections of an article whose headings match, joined and trimmed. */
function sectionsMatching(text: string, heading: RegExp): string {
  const parts = text.split(/\n(?===+ )/);
  return parts
    .filter((part) => heading.test(part.match(/^==+ ?(.*?) ?==+/)?.[1] ?? ''))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .slice(0, SECTION_CHARS);
}

/**
 * The parts of an article that are most about a subject: its sections are
 * scored by how often the subject's words appear, and the best are kept.
 * With no subject, the article's opening is used.
 */
function partsAbout(text: string, subject: string | undefined, maxChars: number): string {
  const sections = text.split(/\n(?===+ )/);
  const words = (subject ?? '').toLowerCase().match(/[a-z]{4,}/g) ?? [];
  if (words.length === 0) return sections[0].slice(0, maxChars);
  const scored = sections
    .map((section) => {
      const lower = section.toLowerCase();
      const heading = lower.match(/^==+ ?(.*?) ?==+/)?.[1] ?? '';
      const score = words.reduce((sum, w) => sum + (heading.includes(w) ? 8 : 0) + Math.min(lower.split(w).length - 1, 6), 0);
      return { section, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return sections[0].slice(0, maxChars);
  return scored
    .slice(0, 3)
    .map((s) => s.section.slice(0, Math.ceil(maxChars / 2)))
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .slice(0, maxChars);
}

interface SearchReply {
  query?: { pages?: Record<string, { title: string; index?: number; extract?: string }> };
}

/** The openings of the articles that best match a search, best first. */
async function search(query: string): Promise<string[]> {
  try {
    const reply = await fetchJson<SearchReply>(
      `${API}&generator=search&gsrlimit=3&gsrsearch=${encodeURIComponent(query)}&prop=extracts&exintro=1&explaintext=1&exlimit=3&exchars=${SEARCH_CHARS}`,
      TIMEOUT_MS,
    );
    return Object.values(reply.query?.pages ?? {})
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .filter((page) => page.extract)
      .map((page) => `From the Wikipedia article "${page.title}":\n${page.extract}`);
  } catch {
    return [];
  }
}

/** The title of the place's own Wikipedia article, read from its summary link. */
function articleTitle(place: Place): string | null {
  try {
    const url = new URL(place.summaryUrl ?? '');
    if (!url.hostname.endsWith('wikipedia.org')) return null;
    return decodeURIComponent(url.pathname.replace(/^\/wiki\//, '')).replace(/_/g, ' ');
  } catch {
    return null;
  }
}

/**
 * Reference text for the card at the end of a trail. Never rejects; anything
 * that cannot be fetched is simply left out, and `base` (the place's own
 * summary) is always included.
 */
export async function groundingFor(place: Place, topicPath: readonly string[], base: string): Promise<string> {
  const [topic, ...rest] = topicPath;
  const subject = rest[rest.length - 1];
  const wider = place.country || place.name;
  const title = articleTitle(place);

  const countryTitle = !place.isOcean && place.country && COUNTRY_ARTICLE[topic] ? COUNTRY_ARTICLE[topic](place.country) : null;

  const [sections, national, about, around] = await Promise.all([
    title && SECTION[topic]
      ? fullText(title).then((text) => sectionsMatching(text, SECTION[topic]) || (subject ? partsAbout(text, subject, 1500) : ''))
      : Promise.resolve(''),
    // The country-wide article on the topic, cut down to the parts about this card's subject.
    countryTitle ? fullText(countryTitle).then((text) => (text ? partsAbout(text, subject, COUNTRY_CHARS) : '')) : Promise.resolve(''),
    // The thing being dug into, wherever Wikipedia writes about it.
    subject ? search(`${subject} ${wider}`) : search(`${SEARCH_WORDS[topic] ?? topic} ${place.name} ${place.isOcean ? '' : wider}`),
    // The same subject in its wider setting: the country's cuisine, history and so on.
    subject ? search(`${subject} ${place.name} ${SEARCH_WORDS[topic] ?? topic}`) : search(`${SEARCH_WORDS[topic] ?? topic} of ${wider}`),
  ]);

  const seen = new Set<string>();
  const found = [...about, ...around].filter((entry) => {
    const key = entry.slice(0, 80);
    return seen.has(key) ? false : (seen.add(key), true);
  });

  return [
    base ? `About ${place.name}:\n${base}` : '',
    sections ? `From the "${topic}" parts of the Wikipedia article on ${place.name}:\n${sections}` : '',
    national ? `From the Wikipedia article "${countryTitle}":\n${national}` : '',
    ...found,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, TOTAL_CHARS);
}
