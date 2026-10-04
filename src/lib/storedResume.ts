/**
 * The owner-uploaded CV, read without the Firebase SDK.
 *
 * The download button renders in two places — Home (the 3D room) and
 * FallbackLibrary (the flat view) — and both sit *outside*
 * CustomizationProvider, which lives in the lazily-loaded room chunk
 * precisely so Firestore and Auth (157 kB gzipped) stay out of the entry
 * bundle. Reading the uploaded CV through that provider would drag the
 * whole SDK back into the entry chunk, and it would land hardest on the
 * flat view — chosen by people on weak hardware or slow connections.
 *
 * `profile/resume` is world-readable by firestore.rules, so a plain REST
 * GET with the public web API key is enough. No SDK, no bundle cost, and
 * it works identically in both views.
 *
 * Writes still go through the SDK (useCustomization), which is fine: only
 * the owner writes, and only from inside the room where it is loaded.
 */

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;

export const RESUME_DOC_PATH = 'profile/resume';

export interface ResumeMeta {
  filename: string;
  /** Size of the original PDF in bytes, for display. */
  size: number;
}

function docUrl(fields?: string[]): string | null {
  if (!projectId || !apiKey) return null;
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${RESUME_DOC_PATH}`;
  const params = new URLSearchParams({ key: apiKey });
  // A stored CV is a base64 data URL — up to ~930 kB of string. Fetching
  // that on every page load, for every visitor, to decide whether to draw
  // a button would be absurd. The mask pulls just the metadata; the bytes
  // are fetched only when someone actually clicks download.
  for (const f of fields ?? []) params.append('mask.fieldPaths', f);
  return `${base}?${params.toString()}`;
}

/**
 * Shared across callers: the download button (useResume) and the Settings
 * panel (useCustomization) both want this same document on load, and
 * without this they each issued their own request for it. One in-flight
 * promise, reused.
 */
let metaRequest: Promise<ResumeMeta | null> | null = null;

/** Metadata only — enough to decide whether to offer the download. */
export function fetchResumeMeta(): Promise<ResumeMeta | null> {
  metaRequest ??= requestResumeMeta();
  return metaRequest;
}

/** Drops the cache so the next read sees a just-uploaded (or removed) CV. */
export function invalidateResumeMeta(): void {
  metaRequest = null;
}

async function requestResumeMeta(): Promise<ResumeMeta | null> {
  const url = docUrl(['filename', 'size']);
  if (!url) return null;

  try {
    const res = await fetch(url);
    // 404 is the ordinary "nothing uploaded yet" case, not an error.
    if (!res.ok) return null;
    const doc = (await res.json()) as { fields?: Record<string, { stringValue?: string; integerValue?: string }> };
    const filename = doc.fields?.filename?.stringValue;
    if (!filename) return null;
    return { filename, size: Number(doc.fields?.size?.integerValue ?? 0) };
  } catch {
    return null;
  }
}

/** The actual PDF, as a data URL. Fetched on demand, never at startup. */
export async function fetchResumeData(): Promise<string | null> {
  const url = docUrl(['dataUrl']);
  if (!url) return null;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const doc = (await res.json()) as { fields?: { dataUrl?: { stringValue?: string } } };
    return doc.fields?.dataUrl?.stringValue ?? null;
  } catch {
    return null;
  }
}
