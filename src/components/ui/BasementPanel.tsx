import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Download, ExternalLink, Stamp } from 'lucide-react';
import { identity } from '../../data/books';
import { countSecretVisit, pressHireStamp, SECRET_MESSAGE } from '../../lib/secretRoom';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape';

interface BasementPanelProps {
  visible: boolean;
  reduced: boolean;
  cvAvailable: boolean;
  onDownloadCv: () => void;
  onLeave: () => void;
}

const TYPE_MS = 24;

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * What the portrait says (lib/secretRoom.ts), as a note left on the table:
 * a cream sheet across the bottom of the view, under the painting rather
 * than over it. The message types itself out, then the ways to get in
 * touch appear — the HIRE ME stamp first — and the counter says how few
 * have made it this far.
 */
export function BasementPanel({ visible, reduced, cvAvailable, onDownloadCv, onLeave }: BasementPanelProps) {
  const [shown, setShown] = useState(0);
  const [visit, setVisit] = useState<{ count: number; first: boolean } | null>(null);
  const counted = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useCloseOnEscape(visible, onLeave);

  useEffect(() => {
    if (!visible) {
      setShown(0);
      return;
    }
    document.exitPointerLock?.();
    if (reduced) {
      setShown(SECRET_MESSAGE.length);
      return;
    }
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n >= SECRET_MESSAGE.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, TYPE_MS);
    return () => window.clearInterval(id);
  }, [visible, reduced]);

  useEffect(() => {
    if (!visible || counted.current) return;
    counted.current = true;
    void countSecretVisit().then(setVisit);
  }, [visible]);

  const done = shown >= SECRET_MESSAGE.length;
  const link = identity.linkedin
    ? { href: identity.linkedin, label: 'LINKEDIN' }
    : { href: identity.github, label: 'GITHUB' };
  const button =
    'flex items-center gap-2 rounded-full px-4 py-2 text-xs tracking-[0.18em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass';

  return (
    <div
      inert={!visible}
      className={`fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-20 transition-opacity duration-700 sm:pb-24 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label="A message from Ahmed"
        className="w-full max-w-2xl rounded-2xl border border-oak/20 bg-paper p-5 text-ink shadow-2xl sm:px-7 sm:py-6"
      >
        <p className="text-[0.6rem] tracking-[0.35em] text-oak">A NOTE ON THE TABLE</p>
        {/* The whole message for screen readers at once; the typing is visual. */}
        <p className="sr-only">{SECRET_MESSAGE}</p>
        <p aria-hidden="true" className="mt-2 min-h-[5.5rem] font-serif text-base leading-relaxed sm:min-h-[4.5rem] sm:text-lg">
          {SECRET_MESSAGE.slice(0, shown)}
          {!done && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-ink/60 align-middle" />}
        </p>
        <p className={`mt-1 text-right font-serif text-sm italic text-oak transition-opacity duration-500 ${done ? 'opacity-100' : 'opacity-0'}`}>
          — Ahmed
        </p>

        <div className={`mt-3 transition-opacity duration-500 ${done ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex flex-wrap gap-2">
            {/* Same as clicking the stamp on the table */}
            <button type="button" onClick={pressHireStamp} className={`${button} bg-[#8a1f1a] text-paper hover:bg-[#a3271f]`}>
              <Stamp size={14} aria-hidden="true" />
              HIRE ME
            </button>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${button} border border-ink/15 text-ink hover:border-brass`}
            >
              <ExternalLink size={14} aria-hidden="true" />
              {link.label}
            </a>
            {cvAvailable && (
              <button type="button" onClick={onDownloadCv} className={`${button} border border-ink/15 text-ink hover:border-brass`}>
                <Download size={14} aria-hidden="true" />
                DOWNLOAD CV
              </button>
            )}
          </div>

          {visit && (
            <p className="mt-3 text-xs text-ink/55">
              {visit.first
                ? `You're the ${ordinal(visit.count)} visitor to find this room.`
                : `Only ${visit.count} ${visit.count === 1 ? 'visitor has' : 'visitors have'} found this room.`}
            </p>
          )}

          <button
            type="button"
            onClick={onLeave}
            className="mt-3 flex items-center gap-2 text-xs tracking-[0.2em] text-ink/60 transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
          >
            <ArrowUp size={14} aria-hidden="true" />
            BACK TO THE LIBRARY
          </button>
        </div>
      </div>
    </div>
  );
}
