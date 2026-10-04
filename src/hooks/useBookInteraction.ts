import { useCallback, useEffect, useRef, useState } from 'react';
import { OPEN_TOTAL_MS, CLOSE_TOTAL_MS } from '../lib/bookAnimation';

export type BookState = 'idle' | 'hovered' | 'selected' | 'opening' | 'opened' | 'closing';

/**
 * The old two-step "click shelf to focus, click again to open" model doesn't
 * carry over to free-roam: there's no scripted "shelf focus" camera stage
 * anymore, and interaction is now crosshair-driven (CrosshairInteraction.tsx)
 * rather than per-mesh DOM pointer events. select() now opens directly —
 * walking up and looking at a book is the "focus" step.
 */
export function useBookInteraction() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<BookState>('idle');
  const timer = useRef<number | undefined>(undefined);

  const clearTimer = () => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
  };

  // A pending open/close timeout would otherwise still fire after unmount
  // and set state on a gone component.
  useEffect(() => clearTimer, []);

  const hover = useCallback(
    (id: string | null) => {
      if (phase === 'idle' || phase === 'hovered') {
        setHoveredId(id);
        setPhase(id ? 'hovered' : 'idle');
      }
    },
    [phase]
  );

  const select = useCallback((id: string) => {
    clearTimer();
    setSelectedId(id);
    setPhase('opening');
    setHoveredId(null);
    // Grab -> carry -> open window (see BookPages.tsx / lib/bookAnimation.ts).
    timer.current = window.setTimeout(() => setPhase('opened'), OPEN_TOTAL_MS);
  }, []);

  const reset = useCallback(() => {
    if (phase !== 'opening' && phase !== 'opened') return;
    clearTimer();
    setPhase('closing');
    timer.current = window.setTimeout(() => {
      setSelectedId(null);
      setPhase('idle');
    }, CLOSE_TOTAL_MS);
  }, [phase]);

  const stateFor = useCallback(
    (id: string): BookState => {
      if (selectedId === id) return phase;
      if (hoveredId === id) return 'hovered';
      return 'idle';
    },
    [selectedId, hoveredId, phase]
  );

  return {
    hoveredId,
    selectedId,
    phase,
    hover,
    select,
    reset,
    stateFor,
  };
}
