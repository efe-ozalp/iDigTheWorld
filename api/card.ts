import { CARD_SYSTEM_PROMPT, cardId, cardUserPrompt, parseCardBody, readCardRequest } from '../ai/card.js';
import { AiError, getProvider } from '../ai/provider.js';
import { MAX_TOPIC_DEPTH, type TopicCard } from '../shared/types.js';

/**
 * POST /api/card
 *
 * Writes one topic card with the configured model (see ai/provider.ts). The
 * reply must be JSON in the shape of a TopicCard; if it is not, the model is
 * asked once more. Anything else that goes wrong is answered with an error
 * status, and the browser shows the encyclopedia summary instead.
 *
 * Cards are cached by place and trail for as long as the server runs.
 */

const MODEL_TIMEOUT_MS = 20_000;
const MAX_ANSWER_TOKENS = 1100;
const CACHE_LIMIT = 1000;

const cache = new Map<string, TopicCard>();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'The request body must be JSON.' });
  }
  const wanted = readCardRequest(body);
  if (typeof wanted === 'string') return json(400, { error: wanted });

  const id = cardId(wanted.placeName, wanted.country, wanted.topicPath);
  const cached = cache.get(id);
  if (cached) return json(200, { card: cached });

  const atMaxDepth = wanted.topicPath.length >= MAX_TOPIC_DEPTH;
  const user = cardUserPrompt(wanted);

  try {
    const provider = getProvider();
    const ask = (prompt: string) =>
      provider.complete({ system: CARD_SYSTEM_PROMPT, user: prompt, maxTokens: MAX_ANSWER_TOKENS, timeoutMs: MODEL_TIMEOUT_MS });

    let parsed = parseCardBody(await ask(user), atMaxDepth);
    if (!parsed) {
      // One more try, spelling out what was wrong with the first answer.
      const reminder = `${user}\n\nYour last answer could not be read. Reply with only the JSON object described: "title", "hook", exactly 3 "facts", and "subtopics".`;
      parsed = parseCardBody(await ask(reminder), atMaxDepth);
    }
    if (!parsed) return json(502, { error: 'The model did not return a usable card.' });

    const card: TopicCard = { id, placeName: wanted.placeName, topicPath: wanted.topicPath, ...parsed };
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(id, card);
    return json(200, { card });
  } catch (err) {
    const kind = err instanceof AiError ? err.kind : 'upstream';
    console.error(`[card] ${id} failed (${kind}):`, err instanceof AiError ? err.message : err);
    return json(kind === 'rate_limit' ? 429 : 502, { error: kind });
  }
}
