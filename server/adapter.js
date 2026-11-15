// @ts-check

/**
 * Runs an /api handler on a plain Node request and response.
 *
 * Handlers are written the way Vercel runs them from /api, against the
 * standard Fetch API:
 *
 *   export function GET(request: Request): Response | Promise<Response>
 *
 * Vercel calls them natively. Everywhere else (server.js on Databricks Apps,
 * and the Vite plugin during `npm run dev`) this adapter does the translation,
 * so a handler behaves the same in all three places.
 */

/** Requests carry small JSON bodies; anything bigger is refused. */
const MAX_BODY_BYTES = 64 * 1024; // a card request with its reference text is about 10 KB

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} data
 * @param {Record<string, string>} [headers]
 */
export function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

/** @param {import('node:http').IncomingMessage} req */
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw Object.assign(new Error('Request body too large'), { status: 413 });
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** @param {import('node:http').IncomingMessage} req */
async function toWebRequest(req) {
  const method = (req.method ?? 'GET').toUpperCase();
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(name, v));
    else if (value !== undefined) headers.set(name, value);
  }

  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
  return new Request(url, { method, headers, body: body?.length ? body : undefined });
}

/**
 * @param {Record<string, unknown> | undefined} mod  The handler module, e.g. the exports of api/health.ts.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export async function runApiHandler(mod, req, res) {
  const method = (req.method ?? 'GET').toUpperCase();
  const started = Date.now();
  const log = () => console.log(`[api] ${method} ${req.url} -> ${res.statusCode} in ${Date.now() - started} ms`);

  // A HEAD request is answered by the GET handler, minus the body.
  const handler = mod?.[method === 'HEAD' ? 'GET' : method];
  if (typeof handler !== 'function') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    log();
    return;
  }

  try {
    /** @type {Response} */
    const response = await handler(await toWebRequest(req));
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  } catch (err) {
    // Never let a handler's failure reach the browser as a raw stack trace.
    console.error(`[api] ${method} ${req.url} failed:`, err);
    const tooLarge = /** @type {{ status?: number }} */ (err)?.status === 413;
    if (res.headersSent) res.end();
    else sendJson(res, tooLarge ? 413 : 500, { error: tooLarge ? 'body_too_large' : 'internal_error' });
  }
  log();
}
