import { useEffect, useRef, type RefObject } from 'react';

/**
 * Moves keyboard focus into a dialog when it opens, and back to whatever
 * had it when it closes.
 *
 * Every panel here (books, settings, the PC, the borrower's card) opened
 * with focus left behind on the page underneath, so a keyboard or
 * screen-reader user pressing Tab walked through controls hidden behind
 * the overlay instead of the dialog they had just opened.
 */
export function useDialogFocus(open: boolean, target: RefObject<HTMLElement | null>) {
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // preventScroll: the dialogs are fixed overlays; scrolling the page
    // behind them to reveal the target would only jolt it.
    target.current?.focus({ preventScroll: true });
    return () => {
      const el = returnTo.current;
      // Only hand focus back if it is still somewhere sensible — the
      // element may have unmounted along with the dialog.
      if (el && el.isConnected) el.focus({ preventScroll: true });
    };
  }, [open, target]);
}
