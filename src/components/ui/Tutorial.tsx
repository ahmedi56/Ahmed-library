import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { useBooks } from '../../hooks/useBooks';
import type { useBookInteraction } from '../../hooks/useBookInteraction';
import type { EntrancePhase } from '../../hooks/useEntrance';
import { computeBookLayout, getBookWorldPosition } from '../../lib/bookLayout';
import { TV_SCREEN_WORLD } from '../../lib/tvLayout';
import { tourInput, resetTourInput } from '../../lib/tourInput';
import { markTutorialSeen } from '../../lib/tutorialStorage';

/**
 * The first-visit tutorial, the way a game teaches its controls: each step
 * either waits for the visitor to do the thing (look, walk in, open a
 * book) or turns the camera to show them something (the shelf, the TV,
 * the desk). Skip and Next are always on screen, so nobody gets stuck on a
 * step their device can't do.
 *
 * Lives in the room chunk (bookLayout pulls in three.js). The camera turns
 * in place through tourInput, the same channel the project viewing mode
 * uses: the visitor stays where they are, so no path has to be found
 * around the furniture.
 */
type StepId = 'look' | 'walk' | 'shelf' | 'open' | 'close' | 'tv' | 'desk' | 'card' | 'done';
const STEPS: StepId[] = ['look', 'walk', 'shelf', 'open', 'close', 'tv', 'desk', 'card', 'done'];

/** Radians of combined turning that count as having looked around. */
const LOOK_THRESHOLD = 0.6;
/** How long a camera-showcase step holds on its subject once it arrives. */
const SHOWCASE_HOLD_MS = 3200;
/** Give up waiting for the camera to settle after this long. */
const SHOWCASE_MAX_TURN_MS = 2500;
/** The laptop on the desk (LibraryEnvironment: desk group at 1.9, -1.35, 1.9). */
const LAPTOP_WORLD: [number, number, number] = [1.9, -1.25, 1.9];

function angleDelta(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

interface TutorialProps {
  active: boolean;
  entrancePhase: EntrancePhase;
  interaction: ReturnType<typeof useBookInteraction>;
  cardOpen: boolean;
  touch: boolean;
  reduced: boolean;
  onEnd: () => void;
}

export function Tutorial({ active, entrancePhase, interaction, cardOpen, touch, reduced, onEnd }: TutorialProps) {
  const { books } = useBooks();
  const layout = useMemo(() => computeBookLayout(books), [books]);
  const [step, setStep] = useState<StepId>('look');
  const { phase } = interaction;
  const isInside = entrancePhase === 'inside';
  const index = STEPS.indexOf(step);
  const counted = STEPS.length - 1; // 'done' isn't a step to count

  const next = () => setStep((s) => STEPS[Math.min(STEPS.indexOf(s) + 1, STEPS.length - 1)]);

  // Start fresh each time, and never leave the camera on rails afterwards.
  useEffect(() => {
    if (!active) return;
    setStep('look');
    return () => {
      if (tourInput.owner === 'tutorial') resetTourInput();
    };
  }, [active]);

  // Look: wait for the view to turn by a meaningful amount.
  useEffect(() => {
    if (!active || step !== 'look') return;
    const start = { ...tourInput.camera };
    const t = window.setInterval(() => {
      const c = tourInput.camera;
      const turned = Math.abs(angleDelta(start.yaw, c.yaw)) + Math.abs(c.pitch - start.pitch);
      if (turned > LOOK_THRESHOLD) next();
    }, 100);
    return () => window.clearInterval(t);
  }, [active, step]);

  // Walk: done once they're through the door — straight away if they
  // already are (a replay from inside the room).
  useEffect(() => {
    if (active && isInside && step === 'walk') setStep('shelf');
  }, [active, isInside, step]);

  // Open, then close, a book — the book animation is the authority on both.
  useEffect(() => {
    if (!active) return;
    if (step === 'open' && phase === 'opened') next();
    else if (step === 'close' && (phase === 'idle' || phase === 'hovered')) next();
  }, [active, step, phase]);

  // The borrower's card.
  useEffect(() => {
    if (active && step === 'card' && cardOpen) next();
  }, [active, step, cardOpen]);

  // Camera showcases: turn in place to the subject, hold, hand control back.
  const showcaseTarget: [number, number, number] | null =
    step === 'shelf'
      ? books.length
        ? getBookWorldPosition(layout, books[Math.floor(books.length / 2)].id)
        : null
      : step === 'tv'
        ? TV_SCREEN_WORLD
        : step === 'desk'
          ? LAPTOP_WORLD
          : null;
  const target = useRef(showcaseTarget);
  target.current = showcaseTarget;

  useEffect(() => {
    if (!active || !target.current) return;
    let hold: number | undefined;
    let begun = 0;
    // The viewing mode or "Go to" may have the camera; wait rather than fight.
    const poll = window.setInterval(() => {
      if (!target.current) return;
      if (!begun) {
        if (tourInput.owner && tourInput.owner !== 'tutorial') return;
        document.exitPointerLock?.();
        tourInput.owner = 'tutorial';
        tourInput.standX = tourInput.camera.x;
        tourInput.standZ = tourInput.camera.z;
        tourInput.lookAt = target.current;
        tourInput.settled = false;
        tourInput.active = true;
        begun = performance.now();
        return;
      }
      if (hold === undefined && (tourInput.settled || performance.now() - begun > SHOWCASE_MAX_TURN_MS)) {
        hold = window.setTimeout(next, SHOWCASE_HOLD_MS);
      }
    }, 80);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(hold);
      if (tourInput.owner === 'tutorial') resetTourInput();
    };
  }, [active, step]);

  // The last word, then out of the way.
  useEffect(() => {
    if (!active || step !== 'done') return;
    markTutorialSeen();
    const t = window.setTimeout(onEnd, 5000);
    return () => window.clearTimeout(t);
    // onEnd is stable (Home).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step]);

  const skip = () => {
    markTutorialSeen();
    if (tourInput.owner === 'tutorial') resetTourInput();
    onEnd();
  };

  if (!active) return null;

  const text: Record<StepId, string> = {
    look: touch
      ? 'Drag anywhere on the screen to look around.'
      : reduced
        ? 'Use the arrow keys to look around.'
        : 'Click the room, then move the mouse to look around.',
    walk: touch
      ? 'Walk in through the door with the stick.'
      : 'Walk in through the door with W A S D.',
    shelf: 'The bookshelf. Every book is one part of my portfolio.',
    open: touch
      ? 'Walk up to the shelf, aim at a book and tap USE.'
      : 'Walk up to the shelf, aim at a book and press E or click.',
    close: touch ? 'Close it with ‘Back to the shelf’.' : 'Close it with Esc or ‘Back to the shelf’.',
    tv: 'My projects play on the TV. Objects around the room open them too.',
    desk: 'The laptop on the desk searches the web. Try the lamp as well.',
    card: touch
      ? 'Finding things earns stamps. Tap the counter at the top to see your card.'
      : 'Finding things earns stamps. Press J to see your borrower’s card.',
    done: 'You’re all set. GO TO, at the top, takes you anywhere in the room.',
  };

  const btn =
    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.6rem] tracking-[0.15em] text-paper/80 transition hover:bg-paper/10 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass';

  return (
    <div
      role="region"
      aria-label="Tutorial"
      // Above the aim prompts ("PRESS E TO OPEN…", which several steps rely
      // on) and clear of the CV button and quality switch below them. On
      // touch the prompts sit higher, over the walk stick, so the bar does too.
      className={`fixed left-1/2 z-40 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-2 rounded-2xl border border-paper/15 bg-ink/85 py-2 pl-4 pr-1.5 text-paper shadow-xl backdrop-blur-sm ${
        touch ? 'bottom-[18rem]' : 'bottom-36'
      }`}
    >
      <p className="min-w-0 flex-1 text-xs leading-snug" aria-live="polite">
        {step !== 'done' && (
          <span className="mr-1.5 text-brass">
            {index + 1}/{counted}
          </span>
        )}
        {text[step]}
      </p>
      {step !== 'done' && (
        <button type="button" onClick={next} aria-label="Next step" className={btn}>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
      <button type="button" onClick={skip} className={btn}>
        <X size={12} aria-hidden="true" />
        {step === 'done' ? 'EXPLORE' : 'SKIP'}
      </button>
    </div>
  );
}
