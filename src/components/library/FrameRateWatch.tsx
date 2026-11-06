import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { reportSlowFrames } from '../../lib/frameRate';

// Ignore the first seconds after mounting (and after every quality change,
// which remounts this): shaders compile and textures upload then, and a
// device that's fine afterwards would look slow.
const WARM_UP_S = 4;
const WINDOW_S = 2.5;
const MIN_FPS = 30;
// Two slow windows in a row, ~5 s: one hitch (a book opening, a shadow map
// rebuilding) shouldn't cost anyone their quality setting.
const SLOW_WINDOWS = 2;
// A gap this long means the tab was in the background or the debugger
// paused it, not that the room renders slowly. Kept generous on purpose: a
// device managing one or two frames a second is exactly the one to catch.
const MAX_DELTA_S = 3;

/**
 * Measures the room's frame rate and reports when it stays low, so
 * usePerformance can drop a quality tier. The starting tier is only a
 * guess from core count and memory; this checks it against what the
 * device actually manages.
 */
export function FrameRateWatch() {
  const elapsed = useRef(0);
  const frames = useRef(0);
  const windowTime = useRef(0);
  const slowWindows = useRef(0);
  // The first frame after the tab comes back measures the time it was away.
  const skipNext = useRef(false);

  useEffect(() => {
    const onVisibility = () => {
      skipNext.current = true;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useFrame((_, delta) => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (delta > MAX_DELTA_S || document.hidden) return;
    elapsed.current += delta;
    if (elapsed.current < WARM_UP_S) return;

    frames.current += 1;
    windowTime.current += delta;
    if (windowTime.current < WINDOW_S) return;

    const fps = frames.current / windowTime.current;
    frames.current = 0;
    windowTime.current = 0;
    slowWindows.current = fps < MIN_FPS ? slowWindows.current + 1 : 0;
    if (slowWindows.current >= SLOW_WINDOWS) {
      slowWindows.current = 0;
      reportSlowFrames();
    }
  });

  return null;
}
