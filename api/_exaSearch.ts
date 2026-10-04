import { createLimiter } from './_rateLimit.ts';

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
 * quota, so it is capped: a query length limit, plus 10 searches a minute
 * per client and 40 overall (see _rateLimit.ts for what those can and
 * can't stop). The Exa dashboard's own usage cap is the hard backstop.
 */
const MAX_QUERY_LENGTH = 200;
const allowRequest = createLimiter({ windowMs: 60_000, perClient: 10, global: 40 });

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
