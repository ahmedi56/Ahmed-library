import { useEffect, useState } from 'react';

/**
 * Whether "Ask the librarian" can answer: GET /api/librarian reports
 * { ready } (is LIBRARIAN_API_KEY set on the server). Without the key the
 * panel could only say it isn't set up, so the button stays hidden until
 * it can do something.
 *
 * A host without functions answers the path with index.html, which fails
 * the JSON parse and reads as not ready — same trap useResumeAvailable
 * guards against. One shared request for both views.
 */
let probe: Promise<boolean> | null = null;

function checkReady(): Promise<boolean> {
  probe ??= fetch('/api/librarian')
    .then((res) => (res.ok ? res.json() : null))
    .then((body: { ready?: unknown } | null) => body?.ready === true)
    .catch(() => false);
  return probe;
}

export function useLibrarianReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void checkReady().then((ok) => {
      if (!cancelled) setReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
