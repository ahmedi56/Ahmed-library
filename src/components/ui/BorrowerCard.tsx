import { useEffect, useRef, useState } from 'react';
import { X, Download, Mail } from 'lucide-react';
import { CHALLENGES, CARD_COMPLETE, type ChallengesApi } from '../../hooks/useChallenges';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { identity } from '../../data/books';
import { playFanfare, playGhost, playStamp } from '../../lib/sfx';

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

/**
 * The ink stamp a library presses on a due-date card — the one visual
 * flourish of the challenge system. Everything around it stays quiet.
 */
function Stamp({ at, size = 'md' }: { at: number | undefined; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-16 w-16 text-[0.6rem]' : 'h-11 w-11 text-[0.5rem]';
  if (!at) {
    return (
      <span
        aria-hidden
        className={`${dim} shrink-0 rounded-full border border-dashed border-ink/20`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${dim} flex shrink-0 -rotate-12 flex-col items-center justify-center rounded-full border-2 border-brass font-serif leading-tight text-brass outline outline-1 outline-offset-2 outline-brass/60`}
    >
      <span className="tracking-[0.15em]">DUE</span>
      <span className="font-semibold">{dateFmt.format(at)}</span>
    </span>
  );
}

interface StampToastProps {
  challenges: ChallengesApi;
  touch: boolean;
  /** Opens the card from the toast's own link. */
  onOpenCard: () => void;
}

/**
 * A slip that drops in when a stamp is earned. One at a time, from the
 * queue in useChallenges, so earning three at once reads as three moments
 * instead of a pile-up.
 */
export function StampToast({ challenges, touch, onOpenCard }: StampToastProps) {
  const { current, dismiss, requiredDone, requiredTotal, rank } = challenges;
  // StrictMode re-runs effects in development; without this every stamp
  // would sound twice there.
  const lastPlayed = useRef<string | null>(null);

  useEffect(() => {
    if (!current) {
      lastPlayed.current = null;
      return;
    }
    if (lastPlayed.current !== current) {
      lastPlayed.current = current;
      // Secrets get their own sound; everything else is the stamp thunk.
      if (current === CARD_COMPLETE) playFanfare();
      else if (current === 'poltergeist') playGhost();
      else playStamp();
    }
    const t = window.setTimeout(dismiss, current === CARD_COMPLETE ? 7000 : 4200);
    return () => window.clearTimeout(t);
  }, [current, dismiss]);

  if (!current) return null;

  const challenge = CHALLENGES.find((c) => c.id === current);
  const isComplete = current === CARD_COMPLETE;
  const title = isComplete ? 'Card complete' : (challenge?.title ?? '');
  const body = isComplete
    ? `You've seen the whole library. Rank: ${rank}.`
    : challenge?.secret
      ? `Secret found. ${challenge.hint}`
      : `${requiredDone} of ${requiredTotal} stamps · ${rank}`;

  return (
    <div
      role="status"
      // Keyed so each new stamp replays the press animation.
      key={current}
      className="stamp-drop fixed left-1/2 top-20 z-40 flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-4 rounded-2xl border border-ink/10 bg-paper/95 p-3 pr-4 shadow-xl backdrop-blur-sm sm:top-24"
    >
      <span className="stamp-press">
        <Stamp at={challenges.earned[current] ?? Math.max(0, ...Object.values(challenges.earned))} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-lg leading-tight text-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-ink/60">{body}</p>
        <button
          type="button"
          onClick={() => {
            dismiss();
            onOpenCard();
          }}
          className="mt-1 text-xs text-oak underline decoration-oak/40 underline-offset-2 hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
        >
          {touch ? 'See your card' : 'See your card (J)'}
        </button>
      </div>
    </div>
  );
}

interface BorrowerCardProps {
  open: boolean;
  onClose: () => void;
  challenges: ChallengesApi;
  resumeAvailable: boolean;
  onDownloadResume: () => void;
}

/** The full card: every challenge, its stamp, the rank, and a way out to contact. */
export function BorrowerCard({ open, onClose, challenges, resumeAvailable, onDownloadResume }: BorrowerCardProps) {
  useCloseOnEscape(open, onClose);
  const [confirmClear, setConfirmClear] = useState(false);

  // Same as SettingsPanel: free the cursor so the buttons work.
  useEffect(() => {
    if (open) document.exitPointerLock();
    else setConfirmClear(false);
  }, [open]);

  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panelRef);

  if (!open) return null;

  const { earned, requiredDone, requiredTotal, rank, complete, reset } = challenges;
  const pct = Math.round((requiredDone / requiredTotal) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 px-4 py-8 backdrop-blur-sm"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-ink/10 bg-paper p-6 shadow-2xl outline-none sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="card-title" className="font-serif text-2xl text-ink sm:text-3xl">
              Borrower's card
            </h2>
            <p className="mt-1 text-sm text-ink/60">
              {rank} · {requiredDone} of {requiredTotal} stamps
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close card"
            className="rounded-full border border-ink/15 p-2 text-ink transition hover:border-brass hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
          >
            <X size={16} />
          </button>
        </div>

        <div
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/10"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Card progress"
        >
          <div className="h-full rounded-full bg-brass transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>

        {complete && (
          <div className="mt-5 rounded-2xl border border-brass/40 bg-brass/10 p-4">
            <p className="font-serif text-lg text-ink">You've seen everything.</p>
            <p className="mt-1 text-sm leading-relaxed text-ink/70">
              Thanks for taking the full tour. If you'd like to work together, I'd be glad to hear from you.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`mailto:${identity.email}?subject=${encodeURIComponent('Found you through your library')}`}
                className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs text-paper transition hover:bg-walnut focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
              >
                <Mail size={13} /> Email Ahmed
              </a>
              {resumeAvailable && (
                <button
                  type="button"
                  onClick={onDownloadResume}
                  className="flex items-center gap-1.5 rounded-full border border-ink/20 px-4 py-2 text-xs text-ink transition hover:border-brass hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
                >
                  <Download size={13} /> Download CV
                </button>
              )}
            </div>
          </div>
        )}

        <ul className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
          {CHALLENGES.map((c) => {
            const at = earned[c.id];
            const hidden = c.secret && !at;
            return (
              <li key={c.id} className="flex items-center gap-4 py-3">
                <Stamp at={at} />
                <div className={`min-w-0 flex-1 ${at ? '' : 'opacity-70'}`}>
                  <p className="font-serif text-base leading-tight text-ink">
                    {hidden ? 'A secret' : c.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-ink/60">
                    {hidden ? c.teaser : c.hint}
                  </p>
                </div>
                <span className="sr-only">{at ? 'Stamped' : 'Not yet'}</span>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-ink/50">
          <span>Saved in this browser only.</span>
          {requiredDone > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirmClear) {
                  reset();
                  setConfirmClear(false);
                } else setConfirmClear(true);
              }}
              className="underline underline-offset-2 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
            >
              {confirmClear ? 'Press again to clear' : 'Clear card'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
