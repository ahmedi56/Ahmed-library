import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import type { EntrancePhase } from './useEntrance';

export interface AtmosphereMix {
  value: number;
}

// Crossing the threshold is player-driven now (no scripted walk duration to
// tie this to), so the interior warm-up just plays over a fixed, tasteful
// duration once the player is actually inside, rather than during 'walking'
// (door open, but the player might linger at the threshold for any amount
// of time before stepping through).
const INTERIOR_FADE_DURATION = 1.2;

/** 0 = exterior blue-hour, 1 = warm interior. Shared by lighting + fog/background. */
export function useAtmosphereMix(entrancePhase: EntrancePhase, reduced: boolean) {
  const mix = useRef<AtmosphereMix>({ value: 0 });

  useEffect(() => {
    gsap.killTweensOf(mix.current);

    if (reduced) {
      const target = entrancePhase === 'inside' ? 1 : 0;
      gsap.to(mix.current, { value: target, duration: 0.4, ease: 'none' });
      return;
    }

    if (entrancePhase === 'inside') {
      gsap.to(mix.current, { value: 1, duration: INTERIOR_FADE_DURATION, ease: 'power2.inOut' });
    } else {
      mix.current.value = 0;
    }
  }, [entrancePhase, reduced]);

  return mix;
}
