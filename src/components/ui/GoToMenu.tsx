import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { tourInput } from '../../lib/tourInput';
import { DESTINATIONS, pathClear, type Destination } from '../../lib/travel';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape';

const FADE_MS = 380;
/**
 * Give up waiting for the camera to arrive after this long, and hand it
 * back. Generous: the glide runs on frame time, and a slow device renders
 * few frames.
 */
const MAX_TRAVEL_MS = 12_000;

/**
 * Header "Go to" menu: pick a place, and the camera walks there and turns
 * to face it — the room without WASD. A straight walk that would cross
 * furniture becomes a short fade-cut instead, as the viewing mode does.
 * Drives the camera through tourInput, like the tutorial and the TV
 * viewing mode, and never takes it from either.
 */
export function GoToMenu({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [fading, setFading] = useState(false);
  const timers = useRef<number[]>([]);

  const close = useCallback(() => setOpen(false), []);
  useCloseOnEscape(open, close);

  // Free the cursor from pointer lock while the list is open.
  useEffect(() => {
    if (open) document.exitPointerLock?.();
  }, [open]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      if (tourInput.owner === 'travel') {
        tourInput.active = false;
        tourInput.owner = null;
      }
    },
    []
  );

  const go = (d: Destination) => {
    setOpen(false);
    // The tutorial or the viewing mode has the camera: don't fight it.
    if (tourInput.owner && tourInput.owner !== 'travel') return;
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];

    const { x, z } = tourInput.camera;
    tourInput.owner = 'travel';
    tourInput.standX = d.stand[0];
    tourInput.standZ = d.stand[1];
    tourInput.lookAt = d.look;
    tourInput.settled = false;

    const release = () => {
      if (tourInput.owner !== 'travel') return;
      tourInput.active = false;
      tourInput.owner = null;
    };
    const watch = () => {
      const started = performance.now();
      const poll = window.setInterval(() => {
        const arrived = !tourInput.cut && tourInput.settled;
        if (tourInput.owner !== 'travel' || arrived || performance.now() - started > MAX_TRAVEL_MS) {
          window.clearInterval(poll);
          release();
        }
      }, 80);
      timers.current.push(poll);
    };

    if (pathClear(x, z, d.stand[0], d.stand[1])) {
      tourInput.active = true;
      watch();
    } else {
      setFading(true);
      timers.current.push(
        window.setTimeout(() => {
          tourInput.cut = true;
          tourInput.active = true;
          setFading(false);
          watch();
        }, FADE_MS)
      );
    }
  };

  if (!enabled) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Go to a place in the room"
        className="flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-4 py-2 text-xs tracking-[0.2em] text-ink backdrop-blur-sm transition hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
      >
        <MapPin size={14} aria-hidden="true" />
        <span className="hidden sm:inline">GO TO</span>
      </button>

      {open && (
        <ul
          aria-label="Places in the room"
          className="absolute left-0 top-full mt-2 w-52 overflow-hidden rounded-2xl border border-ink/10 bg-paper/95 py-1.5 shadow-xl backdrop-blur-md"
        >
          {DESTINATIONS.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => go(d)}
                className="w-full px-4 py-2 text-left text-sm text-ink transition hover:bg-ink/5 focus-visible:bg-ink/5 focus-visible:outline-none"
              >
                {d.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* The fade-cut, for trips that would cross furniture. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-[35] bg-ink transition-opacity ease-in-out ${
          fading ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      />
    </div>
  );
}
