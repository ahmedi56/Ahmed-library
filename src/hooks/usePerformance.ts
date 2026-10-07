import { useEffect, useState } from 'react';

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

function detectTier(): PerformanceTier {
  if (typeof navigator === 'undefined') return 'medium';

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;

  if (isMobile || cores <= 4 || mem <= 4) return 'low';
  if (cores <= 8 || mem <= 8) return 'medium';
  return 'high';
}

/** Detects a starting tier, but lets the user override it (persisted). */
export function usePerformance() {
  const [tier, setTier] = useState<PerformanceTier>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('library-perf') : null;
    if (saved === 'high' || saved === 'medium' || saved === 'low') return saved;
    return detectTier();
  });

  useEffect(() => {
    localStorage.setItem('library-perf', tier);
  }, [tier]);

  return { tier, setTier, profile: PROFILES[tier] };
}
