import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { searchExa } from './api/_exaSearch.ts'

/**
 * Dev-only search proxy for the in-room PC, backed by Exa (real web search,
 * JSON API, no credit card required — 20,000 free requests/month, renewing
 * every month). Chosen over Google's Custom Search API, which requires a
 * Cloud billing account linked even to use its free quota, and over
 * Serper.dev, whose free tier is a one-time credit pool rather than a
 * renewing one. The API key lives in a local .env (never committed — see
 * .env.example) and is read here via Node's process/loadEnv, not
 * import.meta.env, so it never ends up in the client bundle.
 *
 * The request handling itself lives in api/_exaSearch.ts, shared with
 * api/search.ts — the serverless function that serves this same route on a
 * deployed build, which is what this used to be missing entirely.
 */
function searchApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'pc-search-api',
    configureServer(server) {
      server.middlewares.use('/api/search', async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        const url = new URL(req.url ?? '', 'http://internal');
        const outcome = await searchExa(
          url.searchParams.get('q') ?? '',
          env.EXA_API_KEY,
          req.socket.remoteAddress ?? 'unknown'
        );
        res.statusCode = outcome.status;
        res.end(JSON.stringify('items' in outcome ? { items: outcome.items } : { error: outcome.error }));
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix loads every var from .env (not just VITE_-prefixed ones),
  // including the search API secret — safe here because this callback runs
  // in Node config context, and the result only feeds a server-side plugin.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), searchApiPlugin(env)],
    build: {
      rolldownOptions: {
        output: {
          // The app shipped as one 1.9 MB chunk, so nothing rendered until
          // all of three.js, the postprocessing stack and the Firebase SDK
          // had parsed. Splitting the vendors out lets them download in
          // parallel and stay cached across deploys.
          //
          // three.js is deliberately NOT grouped here. Home loads the 3D
          // scene through a dynamic import, which already gives three its
          // own async chunk — but naming it as a manual group promoted it
          // to a shared chunk of the entry, and Vite then emitted a
          // <link rel="modulepreload"> for it in index.html. The browser
          // dutifully downloaded all 301 kB of renderer before rendering a
          // page of text, which is the exact cost the lazy import exists
          // to avoid. Leaving it ungrouped keeps it async-only.
          codeSplitting: {
            groups: [
              { name: 'firebase', test: /node_modules[\\/](@firebase|firebase|idb)[\\/]/ },
              { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            ],
          },
        },
      },
    },
  };
})
