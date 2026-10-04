import { searchExa } from './_exaSearch.ts';

/**
 * Production endpoint for the in-room PC's search.
 *
 * `/api/search` previously existed *only* as a Vite dev-server middleware,
 * so the laptop's search worked locally and then answered 404 (surfacing as
 * "Could not reach the search service") on every deployed build — a visible
 * broken feature on the live portfolio. A Web-standard request/response
 * handler in `api/` is picked up as a serverless function by Vercel and by
 * Netlify's Vite plugin without any extra dependency; the Vite middleware
 * stays for `npm run dev`, and both call the same searchExa().
 *
 * If the host doesn't run functions at all (a purely static bucket), this
 * file is simply not deployed and the client reports the endpoint as
 * unavailable rather than pretending to search.
 */
export default async function handler(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  // Platform-set headers first: a client can send its own X-Forwarded-For,
  // but Vercel (x-real-ip) and Netlify (x-nf-client-connection-ip) set
  // theirs from the actual connection.
  const h = request.headers;
  const clientId =
    h.get('x-real-ip') ??
    h.get('x-nf-client-connection-ip') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  const outcome = await searchExa(q, process.env.EXA_API_KEY, clientId);
  const body = 'items' in outcome ? { items: outcome.items } : { error: outcome.error };

  return new Response(JSON.stringify(body), {
    status: outcome.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
