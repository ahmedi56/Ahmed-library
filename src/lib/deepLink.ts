const PARAM = 'book';

/**
 * Shareable links to a single section: `?book=projects` opens that book
 * straight away, skipping the entrance.
 *
 * The point is practical rather than decorative — it makes a job
 * application able to link at the relevant part of the portfolio instead
 * of at a door the reader then has to walk through.
 */
export function readBookParam(): string | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get(PARAM);
  return value && value.trim() ? value.trim() : null;
}

/** Mirrors the open book into the URL, so the address bar is always copyable. */
export function writeBookParam(id: string | null) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(PARAM, id);
  else url.searchParams.delete(PARAM);
  // replaceState, not pushState: opening and closing books shouldn't fill
  // the back button with history entries.
  window.history.replaceState(null, '', url.toString());
}
