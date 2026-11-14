import { AiError, getProvider, type AiErrorKind } from '../ai/provider.js';

/**
 * GET /api/health
 *
 * Reports what this server can actually reach, so a fresh deployment shows
 * its limits at a glance:
 *   - does the configured model endpoint answer a one-word prompt?
 *   - can the server open connections to the outside services the app uses?
 *
 * Always answers 200 with a JSON report; the individual checks say what failed.
 */

const MODEL_TIMEOUT_MS = 20_000;
const PROBE_TIMEOUT_MS = 6_000;

/** Reuse a report for a few seconds so repeated calls cannot hammer the model. */
const CACHE_MS = 10_000;

const PROBES = [
  { host: 'nominatim.openstreetmap.org', url: 'https://nominatim.openstreetmap.org/status' },
  { host: 'en.wikipedia.org', url: 'https://en.wikipedia.org/api/rest_v1/page/summary/Earth' },
  { host: 'api.anthropic.com', url: 'https://api.anthropic.com/' },
] as const;

interface ModelCheck {
  ok: boolean;
  provider?: string;
  model?: string;
  auth?: string;
  ms: number;
  /** The start of the model's answer, when it gave one. */
  reply?: string;
  error?: { kind: AiErrorKind; message: string; hint?: string };
}

interface Reachability {
  /** True when the host returned any HTTP response at all. */
  reachable: boolean;
  status?: number;
  ms: number;
  error?: string;
}

/** A next step to try, for the failures that have an obvious one. */
function hintFor(kind: AiErrorKind, provider: string | undefined): string | undefined {
  const databricks = provider !== 'anthropic';
  switch (kind) {
    case 'auth':
      return databricks
        ? 'Open the app in Databricks, go to Settings > Resources, add the serving endpoint as a Model resource with "Can query", then redeploy.'
        : 'Check the key in ANTHROPIC_API_KEY.';
    case 'not_found':
      return databricks
        ? 'Check DATABRICKS_MODEL_ENDPOINT against the serving endpoints in this workspace.'
        : 'Check the model id in ANTHROPIC_MODEL.';
    case 'rate_limit':
      return databricks
        ? 'On Databricks Free Edition some models have a limit of zero. Try another endpoint in DATABRICKS_MODEL_ENDPOINT.'
        : undefined;
    case 'network':
      return 'Outbound access from this host may be restricted.';
    default:
      return undefined;
  }
}

/** Identifies the app to the services it probes; Nominatim requires this. */
function userAgent(): string {
  const contact = process.env.NOMINATIM_CONTACT?.trim();
  return `iDigTheWorld/0.1 (hackathon demo${contact ? `; ${contact}` : ''})`;
}

async function checkModel(): Promise<ModelCheck> {
  const started = Date.now();
  let described: Pick<ModelCheck, 'provider' | 'model' | 'auth'> = {};
  try {
    const provider = getProvider();
    described = { provider: provider.name, model: provider.model, auth: provider.auth };
    const reply = await provider.complete({
      user: 'Reply with the single word: ready',
      maxTokens: 16,
      timeoutMs: MODEL_TIMEOUT_MS,
    });
    return { ok: true, ...described, ms: Date.now() - started, reply: reply.trim().slice(0, 80) };
  } catch (err) {
    const kind: AiErrorKind = err instanceof AiError ? err.kind : 'upstream';
    const message = err instanceof AiError ? err.message : 'Unexpected error while checking the model.';
    if (!(err instanceof AiError)) console.error('[health] model check failed:', err);
    const hint = hintFor(kind, described.provider);
    return { ok: false, ...described, ms: Date.now() - started, error: { kind, message, hint } };
  }
}

async function probe(url: string): Promise<Reachability> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent(), Accept: '*/*' },
      redirect: 'manual',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    await res.body?.cancel();
    return { reachable: true, status: res.status, ms: Date.now() - started };
  } catch (err) {
    const name = (err as { name?: string })?.name;
    const code = (err as { cause?: { code?: string } })?.cause?.code;
    const error = name === 'TimeoutError' ? 'timed out' : (code ?? 'connection failed');
    return { reachable: false, ms: Date.now() - started, error };
  }
}

function platform(): string {
  if (process.env.DATABRICKS_APP_NAME) return 'databricks-apps';
  if (process.env.VERCEL) return 'vercel';
  return 'local';
}

let cached: { at: number; body: string } | null = null;

export async function GET(): Promise<Response> {
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    const [model, ...reach] = await Promise.all([checkModel(), ...PROBES.map((p) => probe(p.url))]);
    const report = {
      server: 'ok',
      checkedAt: new Date().toISOString(),
      runtime: { platform: platform(), node: process.version },
      model,
      reachable: Object.fromEntries(PROBES.map((p, i) => [p.host, reach[i]])),
    };
    cached = { at: Date.now(), body: JSON.stringify(report, null, 2) };
  }

  return new Response(cached.body, {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
