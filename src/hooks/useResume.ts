import { useCallback, useEffect, useState } from 'react';
import { fetchResumeData, fetchResumeMeta } from '../lib/storedResume';
import { useResumeAvailable } from './useResumeAvailable';

interface ResumeApi {
  /** True when there is a CV to offer, from either source. */
  available: boolean;
  /** Suggested filename for the saved file. */
  filename: string;
  /** Fetches the bytes (if needed) and hands the browser the download. */
  download: () => Promise<void>;
  /** True while the uploaded PDF is being fetched after a click. */
  downloading: boolean;
}

/**
 * Resolves which CV the download button should offer.
 *
 * Two sources, deliberately kept in this order:
 *
 *   1. An upload made from the Settings panel, stored in Firestore. The
 *      owner can replace the CV from the live site with no redeploy, which
 *      is the whole point of the feature.
 *   2. A file committed at `identity.resumeUrl` (public/cv/...). The
 *      original mechanism, still the better choice for a CV that rarely
 *      changes — it costs no database read and no base64 overhead.
 *
 * Neither present means no button, same as before: an empty folder and an
 * empty database both produce nothing rather than a broken link.
 */
export function useResume(staticUrl: string): ResumeApi {
  const staticReady = useResumeAvailable(staticUrl);
  const [uploaded, setUploaded] = useState<{ filename: string; size: number } | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchResumeMeta().then((meta) => {
      if (!cancelled) setUploaded(meta);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filename = uploaded?.filename ?? staticUrl.split('/').pop() ?? 'cv.pdf';

  const download = useCallback(async () => {
    // The committed file is a real URL, so let the browser do what it
    // already does well — no fetch, no blob, no memory held.
    if (!uploaded) {
      const a = document.createElement('a');
      a.href = staticUrl;
      a.download = '';
      a.click();
      return;
    }

    setDownloading(true);
    try {
      const dataUrl = await fetchResumeData();
      if (!dataUrl) return;
      // A data: URL on an <a download> is enough for the PDF to be saved,
      // and keeps this free of Blob/URL.createObjectURL lifetime juggling.
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = uploaded.filename;
      a.click();
    } finally {
      setDownloading(false);
    }
  }, [uploaded, staticUrl]);

  return {
    available: Boolean(uploaded) || staticReady,
    filename,
    download,
    downloading,
  };
}
