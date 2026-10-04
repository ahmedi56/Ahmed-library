import { useEffect, useRef } from 'react';

/**
 * Closes a dialog on Escape.
 *
 * BookContent, SettingsPanel and PCSearch all declare role="dialog"
 * aria-modal="true" but none of them handled Escape, so the only way out
 * of any of them was to find and click their close button — and in
 * BookContent's case that button sits below the fold on a short viewport.
 */
// Open dialogs, most recent last. Every dialog listens on window, and
// stopPropagation can't stop other listeners on the same target, so one
// Escape used to close all of them — the borrower's card and the book
// beneath it together. Only the topmost one answers now.
const openStack: object[] = [];

export function useCloseOnEscape(open: boolean, onClose: () => void) {
  // Callers pass inline arrows; re-running the effect for each new one
  // would re-push this dialog to the top of the stack on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const token = {};
    openStack.push(token);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || openStack[openStack.length - 1] !== token) return;
      e.stopPropagation();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      openStack.splice(openStack.indexOf(token), 1);
    };
  }, [open]);
}
