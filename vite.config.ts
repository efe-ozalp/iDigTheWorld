import { existsSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { runApiHandler, sendJson } from './server/adapter.js';

/**
 * Serves /api/<name> from api/<name>.ts during `npm run dev`. This is the same
 * mapping Vercel and server.js use, so one command runs the whole app locally.
 */
function devApi(): Plugin {
  return {
    name: 'idigtheworld:dev-api',
    apply: 'serve',
    configureServer(server) {
      // Handlers read process.env in production, so mirror .env.local into it.
      const fileEnv = loadEnv(server.config.mode, server.config.root, '');
      for (const [key, value] of Object.entries(fileEnv)) process.env[key] ??= value;

      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0];
        if (pathname !== '/api' && !pathname.startsWith('/api/')) return next();

        const name = /^\/api\/([\w-]+)\/?$/.exec(pathname)?.[1];
        const file = name && !name.startsWith('_') ? `/api/${name}.ts` : null;
        if (!file || !existsSync(join(server.config.root, file))) {
          sendJson(res, 404, { error: 'not_found' });
          return;
        }

        try {
          await runApiHandler(await server.ssrLoadModule(file), req, res);
        } catch (err) {
          server.ssrFixStacktrace(err as Error);
          next(err);
        }
      });
    },
  };
}

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react(), devApi()],
  build: {
    // The second build pass (server/routes.ts into dist-server/) has no use for the public folder.
    copyPublicDir: !isSsrBuild,
  },
}));
