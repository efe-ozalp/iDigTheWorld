import Anthropic from '@anthropic-ai/sdk';

/**
 * One interface over the two places the topic cards can be written:
 *
 *   AI_PROVIDER=databricks  Databricks Foundation Model API (the default)
 *   AI_PROVIDER=anthropic   Anthropic API
 *
 * Server-side only. Nothing here may be imported from src/.
 */

export type ProviderName = 'databricks' | 'anthropic';

export type AiErrorKind =
  | 'config' // an environment variable is missing or wrong
  | 'auth' // the credentials were rejected, or lack permission
  | 'not_found' // no such endpoint or model
  | 'rate_limit'
  | 'timeout'
  | 'network' // the provider could not be reached at all
  | 'refusal' // the model declined to answer
  | 'upstream'; // any other failure on the provider's side

/** Every failure leaves this module as an AiError, so callers can branch on `kind`. */
export class AiError extends Error {
  readonly kind: AiErrorKind;

  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.name = 'AiError';
    this.kind = kind;
  }
}

export interface CompletionRequest {
  system?: string;
  user: string;
  /** Upper bound on the length of the answer, in tokens. */
  maxTokens: number;
  /** Give up after this many milliseconds. */
  timeoutMs: number;
}

export interface AiProvider {
  readonly name: ProviderName;
  /** The serving endpoint (Databricks) or model id (Anthropic) that requests go to. */
  readonly model: string;
  /** How requests are authenticated. Reported by /api/health; never the secret itself. */
  readonly auth: string;
  /** Sends one prompt and returns the model's text. Rejects with an AiError. */
  complete(request: CompletionRequest): Promise<string>;
}

type Env = Record<string, string | undefined>;

export function getProvider(env: Env = process.env): AiProvider {
  const name = (env.AI_PROVIDER ?? 'databricks').trim().toLowerCase();
  if (name === 'databricks') return databricksProvider(env);
  if (name === 'anthropic') return anthropicProvider(env);
  throw new AiError('config', `AI_PROVIDER must be "databricks" or "anthropic", not "${name}".`);
}

// ---------- Databricks Foundation Model API ----------

/** Llama 4 Maverick: the pay-per-token endpoint that Free Edition workspaces can query. */
const DEFAULT_DATABRICKS_ENDPOINT = 'databricks-llama-4-maverick';

interface CachedToken {
  key: string;
  token: string;
  expiresAt: number;
}

/** The service principal's OAuth token lasts an hour, so reuse it between requests. */
let cachedToken: CachedToken | null = null;

/** DATABRICKS_HOST may or may not carry a scheme; always return "https://host" with no trailing slash. */
function workspaceUrl(host: string): string {
  const trimmed = host.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function servicePrincipalToken(
  host: string,
  clientId: string,
  clientSecret: string,
  signal: AbortSignal,
): Promise<string> {
  const key = `${host}|${clientId}`;
  if (cachedToken && cachedToken.key === key && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.token;
  }

  const res = await fetch(`${host}/oidc/v1/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=all-apis',
    signal,
  });
  if (!res.ok) {
    throw new AiError('auth', `Databricks refused to issue a token for the app's service principal (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new AiError('auth', 'The Databricks token response had no access_token.');

  cachedToken = { key, token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

/** Pulls the answer out of an OpenAI-style chat completion. */
function chatText(data: unknown): string {
  const content = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  // Some models answer with a list of parts instead of one string.
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : ((part as { text?: string })?.text ?? ''))).join('');
  }
  throw new AiError('upstream', 'The model endpoint answered without any message content.');
}

async function databricksFailure(res: Response, endpoint: string): Promise<AiError> {
  const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 240);
  const suffix = detail ? ` ${detail}` : '';
  switch (res.status) {
    case 401:
    case 403:
      return new AiError(
        'auth',
        `Not allowed to query "${endpoint}" (HTTP ${res.status}). The app's service principal needs "Can query" on the endpoint.${suffix}`,
      );
    case 404:
      return new AiError('not_found', `No serving endpoint named "${endpoint}" in this workspace.${suffix}`);
    case 429:
      return new AiError('rate_limit', `Rate limit reached on "${endpoint}".${suffix}`);
    default:
      return new AiError('upstream', `"${endpoint}" answered HTTP ${res.status}.${suffix}`);
  }
}

/** Turns anything fetch can throw into an AiError. */
function fetchFailure(err: unknown): AiError {
  if (err instanceof AiError) return err;
  const name = (err as { name?: string })?.name;
  if (name === 'TimeoutError' || name === 'AbortError') return new AiError('timeout', 'The model endpoint took too long to answer.');
  const code = (err as { cause?: { code?: string } })?.cause?.code;
  return new AiError('network', `Could not reach the model endpoint${code ? ` (${code})` : ''}.`);
}

function databricksProvider(env: Env): AiProvider {
  if (!env.DATABRICKS_HOST?.trim()) {
    throw new AiError(
      'config',
      'DATABRICKS_HOST is not set. Databricks Apps sets it for you; locally, put your workspace URL in .env.local.',
    );
  }
  const host = workspaceUrl(env.DATABRICKS_HOST);
  const endpoint = env.DATABRICKS_MODEL_ENDPOINT?.trim() || DEFAULT_DATABRICKS_ENDPOINT;

  // A personal access token for local work; on Databricks Apps, the app's own service principal.
  const personalToken = env.DATABRICKS_TOKEN?.trim();
  const clientId = env.DATABRICKS_CLIENT_ID?.trim();
  const clientSecret = env.DATABRICKS_CLIENT_SECRET?.trim();
  if (!personalToken && !(clientId && clientSecret)) {
    throw new AiError(
      'config',
      'No Databricks credentials. Set DATABRICKS_TOKEN locally; on Databricks Apps the service principal is provided automatically.',
    );
  }

  return {
    name: 'databricks',
    model: endpoint,
    auth: personalToken ? 'personal access token' : 'app service principal',

    async complete({ system, user, maxTokens, timeoutMs }) {
      const signal = AbortSignal.timeout(timeoutMs);
      try {
        const token = personalToken ?? (await servicePrincipalToken(host, clientId!, clientSecret!, signal));
        const messages = [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }];
        // The API streams by default, so ask for a single JSON answer.
        const common = { messages, max_tokens: maxTokens, stream: false };

        // Both routes are documented. Try the OpenAI-compatible one first and
        // fall back to the per-endpoint route if the workspace does not offer it.
        const attempts = [
          { url: `${host}/serving-endpoints/chat/completions`, body: { model: endpoint, ...common } },
          { url: `${host}/serving-endpoints/${encodeURIComponent(endpoint)}/invocations`, body: common },
        ];

        let res: Response | undefined;
        for (const attempt of attempts) {
          res = await fetch(attempt.url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(attempt.body),
            signal,
          });
          if (res.status !== 404 && res.status !== 405) break;
        }

        if (!res!.ok) {
          if (res!.status === 401) cachedToken = null; // force a fresh token next time
          throw await databricksFailure(res!, endpoint);
        }
        return chatText(await res!.json());
      } catch (err) {
        throw fetchFailure(err);
      }
    },
  };
}

// ---------- Anthropic API ----------

/**
 * Current Claude models think before answering, and that thinking counts
 * against max_tokens. Add room for it so a short answer is never cut off.
 */
const THINKING_HEADROOM_TOKENS = 4096;

function anthropicFailure(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AiError('auth', 'The Anthropic API rejected the key in ANTHROPIC_API_KEY.');
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new AiError('not_found', 'The Anthropic API does not know the model named in ANTHROPIC_MODEL.');
  }
  if (err instanceof Anthropic.RateLimitError) return new AiError('rate_limit', 'Anthropic API rate limit reached.');
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiError('timeout', 'The Anthropic API took too long to answer.');
  }
  if (err instanceof Anthropic.APIConnectionError) return new AiError('network', 'Could not reach the Anthropic API.');
  if (err instanceof Anthropic.APIError) {
    return new AiError('upstream', `The Anthropic API answered HTTP ${err.status}: ${err.message.slice(0, 240)}`);
  }
  console.error('[ai] unexpected Anthropic client failure:', err);
  return new AiError('upstream', 'Unexpected failure while calling the Anthropic API.');
}

function anthropicProvider(env: Env): AiProvider {
  // The model is read only from the environment; there is deliberately no default here.
  const model = env.ANTHROPIC_MODEL?.trim();
  if (!model) throw new AiError('config', 'ANTHROPIC_MODEL is not set.');

  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new AiError('config', 'ANTHROPIC_API_KEY is not set.');

  const client = new Anthropic({ apiKey });

  return {
    name: 'anthropic',
    model,
    auth: 'API key',

    async complete({ system, user, maxTokens, timeoutMs }) {
      try {
        const response = await client.messages.create(
          {
            model,
            max_tokens: maxTokens + THINKING_HEADROOM_TOKENS,
            // The cards are short and grounded in supplied text, so favour speed.
            output_config: { effort: 'low' },
            ...(system ? { system } : {}),
            messages: [{ role: 'user', content: user }],
          },
          { timeout: timeoutMs, maxRetries: 0 },
        );

        if (response.stop_reason === 'refusal') throw new AiError('refusal', 'The model declined to answer.');

        const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
        if (!text.trim()) {
          throw new AiError('upstream', `The model returned no text (stop reason: ${response.stop_reason}).`);
        }
        return text;
      } catch (err) {
        throw anthropicFailure(err);
      }
    },
  };
}
