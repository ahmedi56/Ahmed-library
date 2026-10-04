import { useCallback, useEffect, useRef, useState } from 'react';

export interface Challenge {
  id: string;
  title: string;
  /** What to do. For a secret, shown only once it's earned. */
  hint: string;
  /** Hidden on the card until earned, and not needed to complete it. */
  secret?: boolean;
  /** What a still-hidden secret says about itself on the card. */
  teaser?: string;
}

/**
 * The borrower's card: things to do in the room, each earning a stamp.
 *
 * Same rule as the discovery tally — nothing is ever locked behind these.
 * They exist to point a visitor at the parts of the room they would
 * otherwise walk past (the PC, the lamp, the projects hidden off the
 * shelves) and to give the finished tour a reason to end on the CV and
 * the contact details.
 *
 * Every condition is detected in Home from signals it already has; this
 * file only defines the list and remembers what's been earned.
 */
export const CHALLENGES: Challenge[] = [
  { id: 'enter', title: 'Come in', hint: 'Step through the front door.' },
  { id: 'lamp', title: 'Reading light', hint: 'Switch on the lamp by the entrance.' },
  { id: 'first-book', title: 'First chapter', hint: 'Open any book on the shelves.' },
  { id: 'curator', title: 'Curator', hint: 'Find every project placed around the room.' },
  { id: 'research', title: 'Research desk', hint: 'Run a web search on the PC.' },
  { id: 'bookworm', title: 'Bookworm', hint: 'Open every book in a single visit.' },
  { id: 'explorer', title: 'Every corner', hint: 'Find everything in the room there is to find.' },
  { id: 'borrow', title: 'Checked out', hint: 'Download the CV.' },
  { id: 'speed', title: 'Speed reader', hint: 'Open every book within three minutes of walking in.' },
  {
    id: 'poltergeist',
    title: 'Poltergeist',
    hint: 'Flicked the lamp five times in three seconds.',
    secret: true,
    teaser: "Something in this room doesn't like being switched.",
  },
  {
    id: 'good-taste',
    title: 'Good taste',
    hint: 'Asked the PC whether to hire Ahmed.',
    secret: true,
    teaser: 'The PC knows the answer to one question better than the internet does.',
  },
];

const REQUIRED = CHALLENGES.filter((c) => !c.secret);

/** Rank by number of required stamps, lowest first. */
const RANKS: Array<{ at: number; title: string }> = [
  { at: 0, title: 'Visitor' },
  { at: 2, title: 'Reader' },
  { at: 4, title: 'Regular' },
  { at: 6, title: 'Scholar' },
  { at: REQUIRED.length - 1, title: 'Archivist' },
  { at: REQUIRED.length, title: 'Head librarian' },
];

/** A queued toast: a challenge id, or the one-off "card complete" notice. */
export type StampEvent = string;
export const CARD_COMPLETE: StampEvent = '__complete';

const STORAGE_KEY = 'library-card-v1';

type Earned = Readonly<Record<string, number>>;

// Per-visitor and best-effort: storage can be missing or throw (private
// windows, blocked site data), and the card then simply lasts one visit.
function loadEarned(): Earned {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    const known = new Set(CHALLENGES.map((c) => c.id));
    return Object.fromEntries(
      Object.entries(parsed).filter(([id, at]) => known.has(id) && typeof at === 'number')
    );
  } catch {
    return {};
  }
}

function saveEarned(earned: Earned) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(earned));
  } catch {
    // See loadEarned.
  }
}

export function useChallenges() {
  const [earned, setEarned] = useState<Earned>(loadEarned);
  // The source of truth for "already earned?" — read synchronously by
  // earn(), so a condition that fires on several renders in a row queues
  // one toast, and nothing has to happen inside a setState updater.
  const earnedRef = useRef(earned);
  const [queue, setQueue] = useState<StampEvent[]>([]);

  useEffect(() => saveEarned(earned), [earned]);

  const earn = useCallback((id: string) => {
    if (earnedRef.current[id]) return;
    const next = { ...earnedRef.current, [id]: Date.now() };
    const wasComplete = REQUIRED.every((c) => earnedRef.current[c.id]);
    earnedRef.current = next;
    setEarned(next);
    const nowComplete = REQUIRED.every((c) => next[c.id]);
    setQueue((q) => (nowComplete && !wasComplete ? [...q, id, CARD_COMPLETE] : [...q, id]));
  }, []);

  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  const reset = useCallback(() => {
    earnedRef.current = {};
    setEarned({});
    setQueue([]);
  }, []);

  const requiredDone = REQUIRED.filter((c) => earned[c.id]).length;
  const rank = [...RANKS].reverse().find((r) => requiredDone >= r.at)?.title ?? RANKS[0].title;

  return {
    earned,
    requiredDone,
    requiredTotal: REQUIRED.length,
    complete: requiredDone === REQUIRED.length,
    rank,
    current: queue[0] ?? null,
    earn,
    dismiss,
    reset,
  };
}

export type ChallengesApi = ReturnType<typeof useChallenges>;
