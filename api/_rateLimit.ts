/**
 * Fixed-window rate limiting for the public endpoints (search, librarian),
 * each with its own budget.
 *
 * Counters live in memory, so on a serverless host they are per warm
 * instance, not global — enough to stop one client looping on an
 * endpoint, not a determined distributed attack. The provider's own
 * dashboard spending limit is the hard backstop.
 */
interface Window {
  count: number;
  resetAt: number;
}

export interface LimiterOptions {
  windowMs: number;
  perClient: number;
  global: number;
}

/** Fixed-window counter. Returns false once the window's budget is spent. */
function take(entry: Window, limit: number, windowMs: number, now: number): boolean {
  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

export function createLimiter({ windowMs, perClient, global }: LimiterOptions) {
  const clients = new Map<string, Window>();
  const all: Window = { count: 0, resetAt: 0 };

  return function allow(clientId: string): boolean {
    const now = Date.now();
    // Drop expired entries so the map can't grow without bound.
    if (clients.size > 5000) {
      for (const [id, e] of clients) if (now >= e.resetAt) clients.delete(id);
    }
    let entry = clients.get(clientId);
    if (!entry) {
      entry = { count: 0, resetAt: now + windowMs };
      clients.set(clientId, entry);
    }
    // Per-client first, so one client hammering the endpoint uses up only
    // its own budget and not everyone else's share of the global one.
    if (!take(entry, perClient, windowMs, now)) return false;
    return take(all, global, windowMs, now);
  };
}

/**
 * Who is asking, for the per-client limit. Platform-set headers first: a
 * client can send its own X-Forwarded-For, but Vercel (x-real-ip) and
 * Netlify (x-nf-client-connection-ip) set theirs from the connection.
 */
export function clientIdFrom(headers: Headers): string {
  return (
    headers.get('x-real-ip') ??
    headers.get('x-nf-client-connection-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
