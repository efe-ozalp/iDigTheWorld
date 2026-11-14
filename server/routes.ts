/**
 * The production route table. `npm run build` compiles this file into
 * dist-server/routes.js, which server.js loads.
 *
 * Every file directly inside /api becomes /api/<name>, the same mapping Vercel
 * applies to that folder, so adding a handler needs no change here.
 */

type ApiModule = Record<string, unknown>;

const modules = import.meta.glob<ApiModule>('../api/*.ts', { eager: true });

export const routes: Record<string, ApiModule> = {};

for (const [file, mod] of Object.entries(modules)) {
  const name = file.slice(file.lastIndexOf('/') + 1, -'.ts'.length);
  // Like Vercel, treat files starting with an underscore as helpers, not routes.
  if (!name.startsWith('_')) routes[`/api/${name}`] = mod;
}
