import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Download, ExternalLink, Mail } from 'lucide-react';
import { identity } from '../../data/books';
import { countSecretVisit, SECRET_MESSAGE } from '../../lib/secretRoom';
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
 * What the portrait says (lib/secretRoom.ts): the message types itself out
 * beside the painting, then the ways to get in touch appear, and the
 * counter says how few have made it this far.
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
      className={`fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-24 transition-opacity duration-700 sm:justify-end sm:px-10 sm:pb-28 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label="A message from Ahmed"
        className="w-full max-w-md rounded-3xl border border-paper/15 bg-ink/85 p-6 text-paper shadow-2xl backdrop-blur-md sm:p-7"
      >
        <p className="text-[0.6rem] tracking-[0.35em] text-brass">THE HEAD LIBRARIAN</p>
        {/* The whole message for screen readers at once; the typing is visual. */}
        <p className="sr-only">{SECRET_MESSAGE}</p>
        <p aria-hidden="true" className="mt-3 min-h-[7.5rem] font-serif text-base leading-relaxed sm:text-lg">
          {SECRET_MESSAGE.slice(0, shown)}
          {!done && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-paper/70 align-middle" />}
        </p>

        <div className={`mt-5 transition-opacity duration-500 ${done ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex flex-wrap gap-2">
            <a href={`mailto:${identity.email}`} className={`${button} bg-brass text-ink hover:bg-brass/90`}>
              <Mail size={14} aria-hidden="true" />
              EMAIL ME
            </a>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${button} bg-paper/10 text-paper hover:bg-paper/20`}
            >
              <ExternalLink size={14} aria-hidden="true" />
              {link.label}
            </a>
            {cvAvailable && (
              <button type="button" onClick={onDownloadCv} className={`${button} bg-paper/10 text-paper hover:bg-paper/20`}>
                <Download size={14} aria-hidden="true" />
                DOWNLOAD CV
              </button>
            )}
          </div>

          {visit && (
            <p className="mt-4 text-xs text-paper/60">
              {visit.first
                ? `You're the ${ordinal(visit.count)} visitor to find this room.`
                : `Only ${visit.count} ${visit.count === 1 ? 'visitor has' : 'visitors have'} found this room.`}
            </p>
          )}

          <button
            type="button"
            onClick={onLeave}
            className="mt-4 flex items-center gap-2 text-xs tracking-[0.2em] text-paper/70 transition hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
          >
            <ArrowUp size={14} aria-hidden="true" />
            BACK TO THE LIBRARY
          </button>
        </div>
      </div>
    </div>
  );
}
