import { askLibrarian } from './_librarian.ts';
import { clientIdFrom } from './_rateLimit.ts';

/** A conversation is a few short strings; anything bigger isn't one. */
const MAX_BODY_BYTES = 16_384;

/**
 * Production endpoint for "Ask the librarian" — the same Web-standard
 * handler shape as api/search.ts. POST { messages: [{ role, content }] }.
 */
export default async function handler(request: Request): Promise<Response> {
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  if (request.method !== 'POST') return reply(405, { error: 'Use POST.' });

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return reply(413, { error: 'That conversation is too long.' });
  let body: { messages?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400, { error: 'Malformed request.' });
  }

  const outcome = await askLibrarian(body.messages, process.env.ANTHROPIC_API_KEY, clientIdFrom(request.headers));
  return reply(outcome.status, 'answer' in outcome ? { answer: outcome.answer } : { error: outcome.error });
}
