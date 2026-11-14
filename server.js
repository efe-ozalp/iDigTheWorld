// @ts-check

/**
 * Production server: serves the Vite build from dist/ and mounts the /api
 * handlers. This is what Databricks Apps runs (see app.yaml), and what
 * `npm start` runs locally after `npm run build`.
 *
 * It uses only Node's standard library. Vercel does not use this file: it
 * serves dist/ and runs the /api handlers itself.
 */

import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { runApiHandler, sendJson } from './server/adapter.js';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(ROOT, 'dist');
const INDEX = join(DIST, 'index.html');

// Locally, read .env.local the way `npm run dev` does. On Databricks Apps the
// file does not exist and the platform provides the environment. Variables
// that are already set are never overridden.
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(join(ROOT, file));
  } catch {
    // No such file: nothing to load.
  }
}

/** @type {Record<string, Record<string, unknown>>} */
let routes;
try {
  ({ routes } = await import('./dist-server/routes.js'));
} catch (err) {
  console.error('Could not load dist-server/routes.js. Run "npm run build" before "npm start".');
  console.error(err);
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Text formats worth compressing; photos and textures already are. */
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.map', '.svg', '.txt']);

const gzipAsync = promisify(gzip);

/** Compressed copies, kept in memory so each file is gzipped once per deploy. */
const gzipCache = new Map();

/**
 * @param {string} file
 * @param {import('node:fs').Stats} stats
 */
async function gzipped(file, stats) {
  const cached = gzipCache.get(file);
  if (cached?.mtimeMs === stats.mtimeMs) return cached.body;
  const body = await gzipAsync(await readFile(file));
  gzipCache.set(file, { mtimeMs: stats.mtimeMs, body });
  return body;
}

/**
 * Maps a URL path to a file inside dist/, or null if it would escape it.
 * @param {string} pathname
 */
function resolveInDist(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const file = normalize(join(DIST, decoded));
  return file === DIST || file.startsWith(DIST + sep) ? file : null;
}

/** @param {string} file */
async function statFile(file) {
  try {
    const stats = await stat(file);
    return stats.isFile() ? stats : null;
  } catch {
    return null;
  }
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} file
 * @param {import('node:fs').Stats} stats
 * @param {string} cacheControl
 */
async function sendFile(req, res, file, stats, cacheControl) {
  const ext = extname(file).toLowerCase();
  res.setHeader('Content-Type', MIME[/** @type {keyof typeof MIME} */ (ext)] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Last-Modified', stats.mtime.toUTCString());
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const since = Date.parse(req.headers['if-modified-since'] ?? '');
  if (!Number.isNaN(since) && Math.floor(stats.mtimeMs / 1000) * 1000 <= since) {
    res.writeHead(304).end();
    return;
  }

  const headOnly = req.method === 'HEAD';

  if (COMPRESSIBLE.has(ext) && stats.size > 1024) {
    res.setHeader('Vary', 'Accept-Encoding');
    if (/\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
      const body = await gzipped(file, stats);
      res.writeHead(200, { 'Content-Encoding': 'gzip', 'Content-Length': body.length });
      res.end(headOnly ? undefined : body);
      return;
    }
  }

  res.writeHead(200, { 'Content-Length': stats.size });
  if (headOnly) {
    res.end();
    return;
  }
  createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res);
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} pathname
 */
async function serveStatic(req, res, pathname) {
  const file = resolveInDist(pathname);
  const stats = file ? await statFile(file) : null;

  if (file && stats) {
    // Vite fingerprints everything under /assets, so those never change.
    const cacheControl = pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : file === INDEX
        ? 'no-cache'
        : 'public, max-age=3600';
    await sendFile(req, res, file, stats, cacheControl);
    return;
  }

  // A missing file with an extension is a real 404. Anything else is a page
  // address, and this is a single-page app, so it gets index.html.
  if (extname(pathname)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }

  const indexStats = await statFile(INDEX);
  if (!indexStats) {
    res
      .writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end('The app has not been built yet. Run "npm run build".');
    return;
  }
  await sendFile(req, res, INDEX, indexStats, 'no-cache');
}

const server = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      const mod = routes[pathname.replace(/\/+$/, '')];
      if (mod) await runApiHandler(mod, req, res);
      else sendJson(res, 404, { error: 'not_found' });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' }).end('Method not allowed');
      return;
    }

    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error(`[server] ${req.method} ${req.url} failed:`, err);
    if (res.headersSent) res.destroy();
    else res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Something went wrong.');
  }
});

// Databricks Apps tells the app which port to use; PORT covers other hosts.
const port = Number(process.env.DATABRICKS_APP_PORT || process.env.PORT || 8000);

server.listen(port, '0.0.0.0', () => {
  console.log(`iDigTheWorld is listening on port ${port} (routes: ${Object.keys(routes).join(', ') || 'none'})`);
});

// Databricks sends SIGTERM and force-kills the app 15 seconds later.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(0), 8000).unref();
  });
}
