import { useCallback, useState } from 'react';

export type EntrancePhase = 'outside' | 'opening' | 'walking' | 'inside';

export const DOOR_OPEN_DURATION = 1.2;

/**
 * The door-open swing is still a timed animation (Entrance.tsx), but crossing
 * the threshold into 'inside' is now player-driven — the walk camera reports
 * it via crossThreshold() once it walks past the door, instead of a scripted
 * camera tween. Reduced-motion only affects the door swing itself (instant
 * vs animated, handled in Entrance.tsx); walking is user input either way,
 * so there's no "automated motion" left here to skip.
 */
export function useEntrance(reduced: boolean) {
  const [phase, setPhase] = useState<EntrancePhase>('outside');

  const enter = useCallback(() => {
    setPhase((prev) => {
      if (prev !== 'outside') return prev;

      if (reduced) {
        return 'walking';
      }

      window.setTimeout(() => setPhase('walking'), DOOR_OPEN_DURATION * 1000);
      return 'opening';
    });
  }, [reduced]);

  const crossThreshold = useCallback(() => {
    setPhase((prev) => (prev === 'walking' ? 'inside' : prev));
  }, []);

  // Straight to 'inside', skipping the door entirely. Only used for a
  // ?book= deep link: someone following a link to a specific section
  // asked for that section, not for a walk through an entrance they
  // didn't choose. The normal arrival path is untouched.
  const skipToInside = useCallback(() => {
    setPhase('inside');
  }, []);

  return { phase, enter, crossThreshold, skipToInside, isInside: phase === 'inside' };
}
