import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { firebaseConfigured } from '../lib/firebaseConfig';
import { loadedFirebase } from '../lib/firebaseLazy';
import { getDocument, listCollection } from '../lib/firestoreRest';
import { projectVideos } from '../data/projectVideos';
import { fetchResumeMeta, invalidateResumeMeta } from '../lib/storedResume';

export interface CertificateSlot {
  id: string;
  title: string;
  image: string | null;
}

/** One slot on the wall TV: the text it shows, and the clip it plays. */
export interface ProjectSlot {
  id: string;
  title: string;
  stack: string;
  description: string;
  /** Direct URL to a video file, or a /videos/... path. Empty = slide only. */
  src: string;
}

/** The owner-uploaded CV, stored in its own `profile/resume` document. */
export interface ResumeFile {
  filename: string;
  size: number;
}

interface CustomizationState {
  certificates: CertificateSlot[];
  photo: string | null;
  projects: ProjectSlot[];
  resume: ResumeFile | null;
}

interface CustomizationApi extends CustomizationState {
  loading: boolean;
  /** Last failed save, if it hasn't since been retried successfully. */
  saveError: string | null;
  setCertificateImage: (id: string, image: string | null) => void;
  setCertificateTitle: (id: string, title: string) => void;
  setPhoto: (image: string | null) => void;
  setProject: (id: string, patch: Partial<Omit<ProjectSlot, 'id'>>) => void;
  /** Stores (or clears, with null) the downloadable CV. Owner only. */
  setResume: (file: { dataUrl: string; filename: string; size: number } | null) => Promise<void>;
}

const DEFAULT_STATE: CustomizationState = {
  certificates: [
    { id: 'frame-1', title: "Bachelor's Degree", image: null },
    { id: 'frame-2', title: 'Professional Certificate', image: null },
    { id: 'frame-3', title: 'Course Certificate', image: null },
    { id: 'frame-4', title: 'Diploma', image: null },
    // frame-5/6: the two frames flanking the window (LibraryEnvironment.tsx:
    // WindowFrames), not the left-wall CertificateWall's four.
    { id: 'frame-5', title: 'Achievement', image: null },
    { id: 'frame-6', title: 'Portfolio Highlight', image: null },
  ],
  photo: null,
  // Seeded from data/projectVideos.ts, which stays the fallback for a
  // database that has never been written to.
  projects: projectVideos.map((p, i) => ({ id: `project-${i + 1}`, ...p })),
  resume: null,
};

const PROFILE_DOC_ID = 'main';
/**
 * The CV lives beside the profile rather than inside it. A base64 PDF can
 * approach Firestore's 1 MiB per-document ceiling on its own, and sharing
 * a document with the bedside photo would mean either could push the other
 * over it — and every photo save would rewrite the whole CV.
 */
const RESUME_DOC_ID = 'resume';

/**
 * How long a document must sit unchanged before it is written. The text
 * fields in the Settings panel change on every keystroke, and each write
 * is a whole-document setDoc — for a certificate that includes its base64
 * image, so typing a 60-character title used to send ~60 × 300 kB and
 * spend 60 of the free tier's 20k daily writes.
 */
const SAVE_DEBOUNCE_MS = 500;

/** `certificates/<id>`, `projects/<id>` or `profile/main`. */
type DocKey = string;

const CustomizationContext = createContext<CustomizationApi | null>(null);

/**
 * Room customization (certificate frames + the bedside photo) lives in
 * Firestore (collections `certificates` and `profile`) instead of
 * localStorage — still React context, though, since the settings panel
 * (DOM, outside the Canvas) and the physical frames (inside the Canvas) are
 * separate component subtrees that both need to see edits live from one
 * shared client-side cache of the DB docs, not just on next reload.
 *
 * Images are stored as resized base64 data URLs directly in each document's
 * `image` field (not Firebase Storage, which requires a paid plan as of
 * Feb 2026) — simpler to wire up, and well within Firestore's 1MiB/doc cap
 * for the resized sizes fileToDataUrl produces.
 *
 * A missing document shows its default below; the owner's first save of
 * it from Settings creates it.
 */
export function CustomizationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CustomizationState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(firebaseConfigured);
  // See the matching comment in useBooks.tsx: guards against StrictMode's
  // dev-only double-invoke re-issuing this fetch/seed a second time.
  const fetchStarted = useRef(false);

  useEffect(() => {
    // fetchStarted alone (no separate `cancelled`/cleanup flag) is what
    // makes this run exactly once: a `cancelled`-on-cleanup pattern assumes
    // a second effect invocation will be the one that actually completes
    // and calls setState — true without the ref guard, but with it, the
    // *first* (and only) run is also the one StrictMode's synthetic cleanup
    // marks cancelled, so a `cancelled` check here would discard every
    // fetch's result before it ever reached state.
    if (!firebaseConfigured || fetchStarted.current) return;
    fetchStarted.current = true;

    // Read over REST, not the SDK: see lib/firestoreRest.ts. This used to
    // also seed default documents into an empty database on the owner's
    // first visit; that's gone with the SDK. A missing document already
    // shows its default below, and the first save from Settings creates it.
    (async () => {
      try {
        const certDocs = await listCollection('certificates');
        const certificates = DEFAULT_STATE.certificates.map((fallback) => {
          const data = certDocs.get(fallback.id);
          if (!data) return fallback;
          return {
            id: fallback.id,
            title: (data.title as string | undefined) ?? fallback.title,
            image: (data.image as string | null | undefined) ?? null,
          };
        });

        // Wall TV slots, same read-and-merge shape as the certificates.
        let projects = DEFAULT_STATE.projects;
        try {
          const projDocs = await listCollection('projects');
          projects = DEFAULT_STATE.projects.map((fallback) => {
            const data = projDocs.get(fallback.id);
            if (!data) return fallback;
            return {
              id: fallback.id,
              title: (data.title as string | undefined) ?? fallback.title,
              stack: (data.stack as string | undefined) ?? fallback.stack,
              description: (data.description as string | undefined) ?? fallback.description,
              src: (data.src as string | undefined) ?? fallback.src,
            };
          });
        } catch (err) {
          console.warn('CustomizationProvider: could not load projects', err);
        }

        // Metadata only — the whole base64 PDF (up to ~930 kB) would be
        // pulled into the room's load just to render a filename and a size
        // in the Settings panel. See lib/storedResume.
        const resume = await fetchResumeMeta();

        const profile = await getDocument('profile', PROFILE_DOC_ID);
        const photo = (profile?.photo as string | null | undefined) ?? null;

        setState({ certificates, photo, projects, resume });
      } catch (err) {
        console.warn('CustomizationProvider: Firestore fetch failed', err);
      }
      setLoading(false);
    })();
  }, []);

  // Persistence runs outside the setState updaters. Updaters must be pure:
  // StrictMode calls them twice in dev, which used to send every write
  // twice. A write reads the document's latest contents from this ref when
  // its timer fires, so a burst of edits collapses into one setDoc.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const pendingSaves = useRef(new Map<DocKey, ReturnType<typeof setTimeout>>());
  const [saveError, setSaveError] = useState<{ key: DocKey; message: string } | null>(null);

  const writeDoc = useCallback(async (key: DocKey) => {
    pendingSaves.current.delete(key);
    const firebase = loadedFirebase();
    if (!firebase?.isOwnerNow()) return;

    const [coll, id] = key.split('/');
    const s = stateRef.current;
    let data: Record<string, unknown> | null = null;
    if (coll === 'certificates') {
      const row = s.certificates.find((c) => c.id === id);
      if (row) data = { title: row.title, image: row.image };
    } else if (coll === 'projects') {
      const row = s.projects.find((p) => p.id === id);
      if (row) {
        const { id: _id, ...fields } = row;
        data = fields;
      }
    } else if (coll === 'profile') {
      data = { photo: s.photo };
    }
    if (!data) return;

    try {
      await firebase.writeDocument(coll, id, data);
      // Only clears an error about this same document — a later save of a
      // different one says nothing about whether the failed one landed.
      setSaveError((e) => (e?.key === key ? null : e));
    } catch (err) {
      console.warn(`Failed to save ${key}`, err);
      setSaveError({
        key,
        message:
          err instanceof Error && /permission/i.test(err.message)
            ? 'Not saved: your sign-in no longer has permission. Sign in again and retry.'
            : 'Not saved: the database rejected the last change. Check your connection and try again.',
      });
    }
  }, []);

  const scheduleSave = useCallback(
    (key: DocKey) => {
      // Only the signed-in owner's visit has loaded the SDK (useOwner).
      if (!loadedFirebase()?.isOwnerNow()) return;
      const timers = pendingSaves.current;
      clearTimeout(timers.get(key));
      timers.set(key, setTimeout(() => void writeDoc(key), SAVE_DEBOUNCE_MS));
    },
    [writeDoc]
  );

  // Don't let the debounce eat the last edit: closing the tab, or leaving
  // the 3D room (which unmounts this provider), writes whatever is pending.
  useEffect(() => {
    const timers = pendingSaves.current;
    const flush = () => {
      for (const [key, t] of timers) {
        clearTimeout(t);
        void writeDoc(key);
      }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [writeDoc]);

  const api = useMemo<CustomizationApi>(
    () => ({
      ...state,
      loading,
      saveError: saveError?.message ?? null,
      setCertificateImage: (id, image) => {
        setState((s) => ({ ...s, certificates: s.certificates.map((c) => (c.id === id ? { ...c, image } : c)) }));
        scheduleSave(`certificates/${id}`);
      },
      setCertificateTitle: (id, title) => {
        setState((s) => ({ ...s, certificates: s.certificates.map((c) => (c.id === id ? { ...c, title } : c)) }));
        scheduleSave(`certificates/${id}`);
      },
      setProject: (id, patch) => {
        setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
        scheduleSave(`projects/${id}`);
      },
      setPhoto: (image) => {
        setState((s) => ({ ...s, photo: image }));
        scheduleSave(`profile/${PROFILE_DOC_ID}`);
      },
      // Unlike the debounced writers above, this one awaits the write and
      // lets the failure reach the caller directly. A CV that silently fails to upload — because it
      // crossed Firestore's document ceiling, or the session expired —
      // would otherwise look saved until the next reload, which is exactly
      // when it matters most that it wasn't.
      setResume: async (file) => {
        const firebase = loadedFirebase();
        if (!firebase?.isOwnerNow()) throw new Error('Not signed in as the owner.');

        if (!file) {
          await firebase.removeDocument('profile', RESUME_DOC_ID);
          // Otherwise the cached metadata would keep the download button
          // offering a CV that is no longer there.
          invalidateResumeMeta();
          setState((s) => ({ ...s, resume: null }));
          return;
        }

        await firebase.writeDocument('profile', RESUME_DOC_ID, {
          dataUrl: file.dataUrl,
          filename: file.filename,
          size: file.size,
        });
        invalidateResumeMeta();
        setState((s) => ({ ...s, resume: { filename: file.filename, size: file.size } }));
      },
    }),
    [state, loading, saveError, scheduleSave]
  );

  return <CustomizationContext.Provider value={api}>{children}</CustomizationContext.Provider>;
}

export function useCustomization(): CustomizationApi {
  const ctx = useContext(CustomizationContext);
  if (!ctx) throw new Error('useCustomization must be used within a CustomizationProvider');
  return ctx;
}
