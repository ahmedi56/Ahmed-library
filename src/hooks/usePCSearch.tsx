import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

interface PCSearchApi {
  query: string;
  setQuery: (q: string) => void;
  status: Status;
  results: SearchResult[];
  error: string | null;
  search: (q: string) => Promise<void>;
}

const PCSearchContext = createContext<PCSearchApi | null>(null);

/**
 * Lives as context (not a plain hook) so the full-screen search overlay
 * (DOM, outside the Canvas) and the laptop's in-world screen (inside the
 * Canvas) can both show the same live query/results — the physical screen
 * mirrors whatever's actually been searched, not a separate copy of it.
 *
 * Talks to /api/search, which forwards to the real Exa API server-side —
 * the Vite middleware (vite.config.ts) in dev, the serverless function
 * (api/search.ts) on a deployed build. No results are ever fabricated here
 * — a failed/unconfigured search surfaces `error` instead of falling back
 * to placeholder data.
 */
export function PCSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    const id = ++requestId.current;
    setStatus('loading');
    setError(null);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      // A host with no serverless functions answers the SPA's index.html
      // here, which is HTML, not JSON — report that as what it is rather
      // than letting JSON.parse throw into the generic network branch.
      if (!res.headers.get('content-type')?.includes('application/json')) {
        if (id !== requestId.current) return;
        setStatus('error');
        setError('Search endpoint is not available on this deployment.');
        setResults([]);
        return;
      }
      const data = (await res.json()) as { items?: SearchResult[]; error?: string };
      if (id !== requestId.current) return; // a newer search superseded this one

      if (!res.ok) {
        setStatus('error');
        setError(data.error ?? 'Search failed.');
        setResults([]);
        return;
      }

      setResults(data.items ?? []);
      setStatus('done');
    } catch {
      if (id !== requestId.current) return;
      setStatus('error');
      setError('Could not reach the search service.');
      setResults([]);
    }
  }, []);

  const api: PCSearchApi = { query, setQuery, status, results, error, search };

  return <PCSearchContext.Provider value={api}>{children}</PCSearchContext.Provider>;
}

export function usePCSearch(): PCSearchApi {
  const ctx = useContext(PCSearchContext);
  if (!ctx) throw new Error('usePCSearch must be used within a PCSearchProvider');
  return ctx;
}
