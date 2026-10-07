import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import { useCustomization, type ProjectSlot } from './useCustomization';

type Status = 'loading' | 'playing' | 'unavailable';

interface ProjectShowcase {
  texture: THREE.VideoTexture;
  current: ProjectSlot | null;
  status: Status;
  /** Position of `current` in the playlist, and its length. */
  index: number;
  count: number;
  /** Jump the TV to a specific slot, e.g. when its object is opened. */
  showProject: (projectId: string) => void;
  /**
   * Stop the slides advancing on their own, while someone is reading about
   * the project on screen (the viewing panel); false resumes.
   */
  setHeld: (held: boolean) => void;
}

const ShowcaseContext = createContext<ProjectShowcase | null>(null);

const SLIDE_INTERVAL_MS = 6000;

/**
 * Drives the TV's project-video playlist: an off-DOM <video> element used
 * purely as a THREE.VideoTexture source (never appended to the page), muted
 * so browser autoplay restrictions don't block it. Advances on `ended`;
 * skips forward on `error` too (a missing/broken file doesn't stall the
 * playlist) — if every entry fails, `status` settles on 'unavailable' rather
 * than looping forever. 'unavailable' does not mean idle, though: no video
 * files ship with the project, so this is the normal path today, not an
 * edge case — a separate timer below keeps `index` advancing every
 * SLIDE_INTERVAL_MS while unavailable, so the TV still cycles through every
 * project as a designed slide (title/stack/description) instead of freezing
 * on whichever entry failed last (see the idle canvas in WallTV).
 */
/**
 * One showcase for the whole room.
 *
 * This used to be a plain hook, and once the project objects started
 * needing to know what was on screen it was being called twice — once by
 * the TV inside the Canvas and once by the interaction layer outside it.
 * Two calls meant two <video> elements, two textures and two independent
 * cycling timers, so the card beside an object could name a different
 * project from the one the TV was actually showing. As a provider there
 * is exactly one playlist, and both sides read the same truth.
 */
export function ProjectShowcaseProvider({ children }: { children: ReactNode }) {
  const value = useShowcaseState();
  return <ShowcaseContext.Provider value={value}>{children}</ShowcaseContext.Provider>;
}

export function useProjectShowcase(): ProjectShowcase {
  const ctx = useContext(ShowcaseContext);
  if (!ctx) throw new Error('useProjectShowcase must be used within a ProjectShowcaseProvider');
  return ctx;
}

function useShowcaseState(): ProjectShowcase {
  // The playlist is owner-editable now (Settings -> Wall TV), so it comes
  // from the customization store rather than the static data file, which
  // remains the fallback when nothing has been saved.
  const { projects } = useCustomization();
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const heldRef = useRef(false);
  useEffect(() => {
    heldRef.current = held;
  }, [held]);
  const [status, setStatus] = useState<Status>(projects.length > 0 ? 'loading' : 'unavailable');
  const consecutiveErrors = useRef(0);

  const count = projects.length;
  const entry = projects[index] ?? null;
  const src = entry?.src ?? '';

  const video = useMemo(() => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    // Clips can now be hosted anywhere the owner likes, and a texture built
    // from a cross-origin video needs this or the canvas is tainted. The
    // host still has to send CORS headers; if it doesn't, the load fails
    // and the TV falls back to the designed slide, same as a missing file.
    v.crossOrigin = 'anonymous';
    v.loop = false;
    v.preload = 'auto';
    return v;
  }, []);

  const texture = useMemo(() => {
    const t = new THREE.VideoTexture(video);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [video]);

  useEffect(() => {
    if (count === 0) return;
    if (!src) {
      // A slot with no clip is a slide, not a failure.
      setStatus('unavailable');
      return;
    }

    const handlePlaying = () => {
      consecutiveErrors.current = 0;
      setStatus('playing');
    };
    const advance = () => setIndex((i) => (i + 1) % count);
    // While held, a finished clip replays instead of moving on.
    const handleEnded = () => {
      if (heldRef.current) {
        video.currentTime = 0;
        void video.play().catch(() => {});
      } else advance();
    };
    const handleError = () => {
      consecutiveErrors.current += 1;
      if (consecutiveErrors.current >= count) {
        setStatus('unavailable');
        return;
      }
      advance();
    };

    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    video.src = src;
    video.load();
    video.play().catch(() => {
      // Autoplay blocked, or the file doesn't exist and the browser rejects
      // the play() promise instead of firing 'error' — either way, treat it
      // like a failed entry so the playlist still moves on.
      handleError();
    });

    return () => {
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [index, video, src, count]);

  useEffect(
    () => () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      texture.dispose();
    },
    [video, texture]
  );

  useEffect(() => {
    if (held || status !== 'unavailable' || count <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [held, status, count]);

  // Opening a project object puts that project on the TV, so the physical
  // object, the information card and the screen all agree.
  const showProject = useCallback(
    (projectId: string) => {
      const next = projects.findIndex((p) => p.id === projectId);
      if (next >= 0) setIndex(next);
    },
    [projects]
  );

  return { texture, current: entry, status, index, count, showProject, setHeld };
}
