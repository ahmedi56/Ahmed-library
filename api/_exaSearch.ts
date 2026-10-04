export interface SearchResultItem {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

export type ExaOutcome =
  | { status: number; error: string }
  | { status: 200; items: SearchResultItem[] };

/**
 * Single implementation of the in-room PC's web search, shared by the Vite
 * dev middleware (vite.config.ts) and the deployed serverless function
 * (api/search.ts) so the two can't drift.
 *
 * The API key is a real secret and only ever exists on whichever server
 * calls this — it is never VITE_-prefixed and never reaches the bundle.
 *
 * The endpoint is public and every call spends the shared 20k/month Exa
 * quota, so it is capped below: a query length limit, a per-client rate,
 * and an overall rate. The counters live in memory, so on a serverless
 * host they are per warm instance, not global — enough to stop one
 * client looping on the endpoint, not a determined distributed attack.
 * The Exa dashboard's own usage cap is the hard backstop.
 */
const MAX_QUERY_LENGTH = 200;
const WINDOW_MS = 60_000;
const PER_CLIENT_LIMIT = 10;
const GLOBAL_LIMIT = 40;

const clientHits = new Map<string, { count: number; resetAt: number }>();
let globalHits = { count: 0, resetAt: 0 };

/** Fixed-window counter. Returns false once the window's budget is spent. */
function take(entry: { count: number; resetAt: number }, limit: number, now: number): boolean {
  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

function allowRequest(clientId: string): boolean {
  const now = Date.now();
  // Drop expired entries so the map can't grow without bound.
  if (clientHits.size > 5000) {
    for (const [id, e] of clientHits) if (now >= e.resetAt) clientHits.delete(id);
  }
  let entry = clientHits.get(clientId);
  if (!entry) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    clientHits.set(clientId, entry);
  }
  // Per-client first, so one client hammering the endpoint uses up only
  // its own budget and not everyone else's share of the global one.
  if (!take(entry, PER_CLIENT_LIMIT, now)) return false;
  if (now >= globalHits.resetAt) globalHits = { count: 0, resetAt: now + WINDOW_MS };
  return take(globalHits, GLOBAL_LIMIT, now);
}

/** Only web links reach an `href` — a `javascript:` URL must never render. */
function isWebUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export async function searchExa(
  query: string,
  apiKey: string | undefined,
  clientId = 'unknown'
): Promise<ExaOutcome> {
  const q = query.trim();
  if (!q) return { status: 400, error: 'Missing query parameter "q".' };
  if (q.length > MAX_QUERY_LENGTH) {
    return { status: 400, error: `Search is limited to ${MAX_QUERY_LENGTH} characters.` };
  }
  if (!allowRequest(clientId)) {
    return { status: 429, error: 'Too many searches right now. Wait a minute and try again.' };
  }
  if (!apiKey) {
    return {
      status: 501,
      error: 'Search is not configured. Set EXA_API_KEY on the server — see .env.example.',
    };
  }

  try {
    const upstream = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: q,
        numResults: 8,
        type: 'auto',
        contents: { text: { maxCharacters: 220, includeHtmlTags: false } },
      }),
    });

    const data = (await upstream.json()) as {
      results?: Array<{ title?: string; url?: string; text?: string }>;
      error?: string;
    };

    if (!upstream.ok) {
      return { status: upstream.status, error: data.error ?? 'Search provider error.' };
    }

    const items: SearchResultItem[] = (data.results ?? []).flatMap((item) =>
      isWebUrl(item.url)
        ? [
            {
              title: item.title ?? '',
              link: item.url,
              snippet: item.text ?? '',
              displayLink: new URL(item.url).hostname,
            },
          ]
        : []
    );

    return { status: 200, items };
  } catch {
    return { status: 502, error: 'Failed to reach the search provider.' };
  }
}
