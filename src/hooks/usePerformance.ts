import { useCallback, useEffect, useRef, useState } from 'react';
import { onSlowFrames } from '../lib/frameRate';

export type PerformanceTier = 'high' | 'medium' | 'low';

export interface PerformanceProfile {
  tier: PerformanceTier;
  shadows: boolean;
  particles: number;
  dpr: number;
  postProcessing: boolean;
}

const PROFILES: Record<PerformanceTier, PerformanceProfile> = {
  high: { tier: 'high', shadows: true, particles: 40, dpr: 1.75, postProcessing: true },
  medium: { tier: 'medium', shadows: true, particles: 18, dpr: 1.25, postProcessing: false },
  low: { tier: 'low', shadows: false, particles: 0, dpr: 1, postProcessing: false },
};

const STEP_DOWN: Record<PerformanceTier, PerformanceTier | null> = { high: 'medium', medium: 'low', low: null };

// The tier this device last ran at, chosen or automatic: where the next
// visit starts.
const TIER_KEY = 'library-perf';
// Set only when the visitor picks a tier themselves. Their choice stands:
// the automatic drop never overrides it.
const CHOICE_KEY = 'library-perf-choice';

function isTier(v: string | null): v is PerformanceTier {
  return v === 'high' || v === 'medium' || v === 'low';
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the tier just isn't remembered.
  }
}

function detectTier(): PerformanceTier {
  if (typeof navigator === 'undefined') return 'medium';

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;

  if (isMobile || cores <= 4 || mem <= 4) return 'low';
  if (cores <= 8 || mem <= 8) return 'medium';
  return 'high';
}

/**
 * Detects a starting tier, steps it down automatically while the room
 * runs slowly (FrameRateWatch), and lets the visitor override it. A tier
 * the visitor picks is persisted and never changed for them.
 */
export function usePerformance() {
  const [tier, setTierState] = useState<PerformanceTier>(() => {
    if (typeof window === 'undefined') return 'medium';
    const saved = read(TIER_KEY);
    return isTier(saved) ? saved : detectTier();
  });
  /** Set when the room lowered the tier itself, for a brief notice. */
  const [autoLowered, setAutoLowered] = useState(false);

  const tierRef = useRef(tier);
  useEffect(() => {
    tierRef.current = tier;
    write(TIER_KEY, tier);
  }, [tier]);

  useEffect(
    () =>
      onSlowFrames(() => {
        if (read(CHOICE_KEY) === '1') return;
        const next = STEP_DOWN[tierRef.current];
        if (!next) return;
        tierRef.current = next;
        setTierState(next);
        setAutoLowered(true);
      }),
    []
  );

  useEffect(() => {
    if (!autoLowered) return;
    const t = window.setTimeout(() => setAutoLowered(false), 5000);
    return () => window.clearTimeout(t);
  }, [autoLowered, tier]);

  /** The visitor's own pick, from the quality buttons. */
  const setTier = useCallback((next: PerformanceTier) => {
    write(CHOICE_KEY, '1');
    setAutoLowered(false);
    setTierState(next);
  }, []);

  return { tier, setTier, profile: PROFILES[tier], autoLowered };
}
