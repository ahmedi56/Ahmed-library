import { useEffect, useRef, useState } from 'react';
import { playDeskBell, playKnock } from '../../lib/sfx';

/**
 * The room talking back, a little: a welcome-back slip for returning
 * visitors, and the odd joke for someone who has stood still a while.
 *
 * Both are the same paper slip as the stamp toasts, sit under every panel
 * (z-20), wait for any stamp toast to finish, and go the moment the
 * visitor does anything. They never block, never repeat back to back, and
 * stop after a handful so they stay a surprise rather than a nag.
 */

interface Quip {
  text: string;
  /** Mentions a mouse or keyboard, so is skipped on touch devices. */
  pointerOnly?: boolean;
}

const QUIPS: Quip[] = [
  { text: "The books don't bite. Mostly." },
  { text: 'This is a library, so standing perfectly still is technically correct.' },
  { text: 'Still there? The lamp switch is by the door, if you need a hobby.' },
  { text: 'The PC takes questions. It is especially good at one of them.' },
  { text: 'Your borrower’s card has empty squares on it. Press J to see which.', pointerOnly: true },
  { text: 'Your borrower’s card has empty squares on it. Tap the counter, top left.' },
  { text: 'If you are reading this, your mouse misses you.', pointerOnly: true },
  { text: 'No rush. These shelves have waited since 2023.' },
  { text: 'Somewhere in this room is a secret. It is not under the rug.' },
];

const IDLE_MS = 30_000;
const SHOW_MS = 6_500;
const MAX_QUIPS = 4;
const VISIT_KEY = 'library-last-visit';
const RETURN_AFTER_MS = 30 * 60_000;

/**
 * Read once per page load, at module evaluation, and stamped with now in
 * the same breath — not in a component, where StrictMode's double render
 * would read back the value it had just written and never greet anyone.
 */
const previousVisit: number | null = (() => {
  try {
    const raw = localStorage.getItem(VISIT_KEY);
    localStorage.setItem(VISIT_KEY, String(Date.now()));
    const at = raw ? Number(raw) : NaN;
    return Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
})();

function greeting(stamps: number, total: number, rank: string, complete: boolean): string {
  const now = Date.now();
  const days = previousVisit ? Math.floor((now - previousVisit) / 86_400_000) : 0;
  const overdue =
    days >= 1 ? ` You’re ${days === 1 ? 'a day' : `${days} days`} overdue. We’ll waive the fine.` : '';

  if (complete) return `Welcome back, ${rank.toLowerCase()}. Nothing to return — your card’s full.${overdue}`;
  if (stamps === 0) return `Welcome back. Your card’s still blank — the lamp by the door is a gentle start.${overdue}`;
  return `Welcome back. Your card shows ${stamps} of ${total} stamps; the shelves missed you.${overdue}`;
}

interface RoomQuipsProps {
  /** Inside, loaded, and no panel open. */
  active: boolean;
  /** A stamp toast is up; wait for it. */
  blocked: boolean;
  touch: boolean;
  stamps: number;
  total: number;
  rank: string;
  complete: boolean;
}

export function RoomQuips({ active, blocked, touch, stamps, total, rank, complete }: RoomQuipsProps) {
  // The kind matters: an idle joke goes the moment the visitor moves, but
  // the greeting has to survive them looking around the room to be read.
  const [slip, setSlip] = useState<{ text: string; kind: 'greeting' | 'idle' } | null>(null);
  const greeted = useRef(false);
  const shown = useRef(0);
  const lastIndex = useRef(-1);

  // Welcome back — once, shortly after a returning visitor is inside.
  useEffect(() => {
    if (greeted.current || !active || blocked) return;
    if (!previousVisit || Date.now() - previousVisit < RETURN_AFTER_MS) {
      greeted.current = true;
      return;
    }
    const t = window.setTimeout(() => {
      greeted.current = true;
      setSlip({ text: greeting(stamps, total, rank, complete), kind: 'greeting' });
      playDeskBell();
    }, 1200);
    return () => window.clearTimeout(t);
  }, [active, blocked, stamps, total, rank, complete]);

  // Idle jokes: any input restarts the clock and dismisses what's showing.
  useEffect(() => {
    if (!active || blocked) return;
    let idleTimer = 0;
    const arm = () => {
      window.clearTimeout(idleTimer);
      if (shown.current >= MAX_QUIPS) return;
      idleTimer = window.setTimeout(() => {
        // Reading a panel is not idling: never interrupt an open dialog.
        if (document.querySelector('[role="dialog"][aria-modal="true"]:not([inert])')) {
          arm();
          return;
        }
        const pool = QUIPS.map((q, i) => ({ q, i })).filter(
          ({ q, i }) => (!touch || !q.pointerOnly) && i !== lastIndex.current
        );
        const pick = pool[Math.floor(Math.random() * pool.length)];
        lastIndex.current = pick.i;
        shown.current += 1;
        setSlip({ text: pick.q.text, kind: 'idle' });
        playKnock();
      }, IDLE_MS);
    };
    const onInput = () => {
      setSlip((s) => (s?.kind === 'idle' ? null : s));
      arm();
    };
    const events = ['keydown', 'pointerdown', 'mousemove', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
    arm();
    return () => {
      window.clearTimeout(idleTimer);
      events.forEach((e) => window.removeEventListener(e, onInput));
    };
  }, [active, blocked, touch]);

  // Every slip leaves on its own, too.
  useEffect(() => {
    if (!slip) return;
    const t = window.setTimeout(() => setSlip(null), slip.kind === 'greeting' ? SHOW_MS + 1500 : SHOW_MS);
    return () => window.clearTimeout(t);
  }, [slip]);

  if (!slip || !active) return null;

  return (
    <div
      role="status"
      key={slip.text}
      className="stamp-drop pointer-events-none fixed left-1/2 top-20 z-20 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-ink/10 bg-paper/95 px-4 py-3 shadow-xl backdrop-blur-sm sm:top-24"
    >
      <p className="font-serif text-base leading-snug text-ink text-pretty">{slip.text}</p>
    </div>
  );
}
