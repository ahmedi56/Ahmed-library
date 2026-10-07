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
  const [phase, setPhaseState] = useState<BookState>('idle');
  const timer = useRef<number | undefined>(undefined);
  // The phase as of right now, not as of the last render. hover() runs from
  // the crosshair's frame loop, which can still hold a callback from before
  // select() re-rendered; checking a render-time copy let a late hover
  // flip an opening book back to 'hovered' — on slow devices the book's
  // panel then never opened, and the guided tour skipped a book.
  const phaseRef = useRef<BookState>('idle');
  const setPhase = useCallback((p: BookState) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

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
      const now = phaseRef.current;
      if (now === 'idle' || now === 'hovered') {
        setHoveredId(id);
        setPhase(id ? 'hovered' : 'idle');
      }
    },
    [setPhase]
  );

  const select = useCallback(
    (id: string) => {
      clearTimer();
      setSelectedId(id);
      setPhase('opening');
      setHoveredId(null);
      // Grab -> carry -> open window (see BookPages.tsx / lib/bookAnimation.ts).
      timer.current = window.setTimeout(() => setPhase('opened'), OPEN_TOTAL_MS);
    },
    [setPhase]
  );

  const reset = useCallback(() => {
    const now = phaseRef.current;
    if (now !== 'opening' && now !== 'opened') return;
    clearTimer();
    setPhase('closing');
    timer.current = window.setTimeout(() => {
      setSelectedId(null);
      setPhase('idle');
    }, CLOSE_TOTAL_MS);
  }, [setPhase]);

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
