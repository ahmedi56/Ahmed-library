import { useEffect, useState } from 'react';

/**
 * Whether a CV actually exists at `url`, checked once at startup.
 *
 * The file isn't committed (it's the owner's to add), so the download
 * button can't just be rendered unconditionally — that would hand every
 * visitor a link to a 404. A HEAD request settles it, and the button
 * appears on its own the moment the PDF is dropped into public/cv/.
 *
 * The content-type check matters: a single-page host answers a missing
 * path with index.html and a 200, so status alone would report success for
 * a file that isn't there. Same failure the project's video playlist and
 * search endpoint both have to allow for.
 */
export function useResumeAvailable(url: string): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    // An off-site URL can't be probed (CORS), so trust it and render.
    if (/^https?:\/\//i.test(url)) {
      setAvailable(true);
      return;
    }

    fetch(url, { method: 'HEAD' })
      .then((res) => {
        if (cancelled) return;
        const type = res.headers.get('content-type') ?? '';
        setAvailable(res.ok && !type.includes('text/html'));
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return available;
}
