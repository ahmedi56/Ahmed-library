/**
 * The room's "this device is struggling" signal. FrameRateWatch (inside the
 * Canvas) reports it; usePerformance (outside, in Home, which must not
 * import three) listens and steps the quality down. A plain listener set,
 * the same module-channel pattern as tourInput.
 */
const listeners = new Set<() => void>();

export function reportSlowFrames(): void {
  listeners.forEach((fn) => fn());
}

export function onSlowFrames(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
