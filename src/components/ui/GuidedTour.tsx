import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, SkipForward, X } from 'lucide-react';
import { useBooks } from '../../hooks/useBooks';
import type { useBookInteraction } from '../../hooks/useBookInteraction';
import { computeBookLayout, getBookWorldPosition } from '../../lib/bookLayout';
import { tourInput, resetTourInput } from '../../lib/tourInput';

/**
 * The guided tour: shelf to shelf, every book opened in turn, no controls
 * to learn. For the visitor with a minute and no patience for WASD.
 *
 * Lives in the room chunk (bookLayout pulls in three.js). Getting to the
 * shelf is a short fade-to-black cut rather than a walk, because a walk
 * from an arbitrary spot would have to path around the bed and desk; after
 * the cut the camera only ever moves along STAND_X, a line in front of the
 * bookcase that is clear of every collider (lib/collision.ts: shelf from
 * x 3.75, desk to x 2.78, player radius 0.3).
 */
const STAND_X = 3.25;
const STAND_Z_MIN = -0.4;
const STAND_Z_MAX = 2.7;
const FADE_MS = 380;
const MAX_MOVE_MS = 2600;

type Stage = 'fade-out' | 'fade-in' | 'move' | 'open' | 'read' | 'close' | 'done';

/** Long enough to read, short enough that eight books stay around a minute and a half. */
function dwellFor(book: { description: string; items?: { title: string; detail: string }[] }) {
  const text = [book.description, ...(book.items ?? []).map((i) => `${i.title} ${i.detail}`)].join(' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.min(9000, Math.max(4500, 3000 + words * 55));
}

interface GuidedTourProps {
  active: boolean;
  interaction: ReturnType<typeof useBookInteraction>;
  onEnd: () => void;
}

export function GuidedTour({ active, interaction, onEnd }: GuidedTourProps) {
  const { books } = useBooks();
  const layout = useMemo(() => computeBookLayout(books), [books]);
  const [stage, setStage] = useState<Stage | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const { phase, selectedId, select, reset } = interaction;
  const book = books[index];

  // Aim the camera at a book: stand on the clear line, level with it.
  const aimAt = useCallback(
    (i: number) => {
      const b = books[i];
      if (!b) return;
      const [x, y, z] = getBookWorldPosition(layout, b.id);
      tourInput.standX = STAND_X;
      tourInput.standZ = Math.min(STAND_Z_MAX, Math.max(STAND_Z_MIN, z));
      tourInput.lookAt = [x, y, z];
      tourInput.settled = false;
    },
    [books, layout]
  );

  // Start, and tidy up on stop — including the camera, which must never be
  // left on rails after the tour component goes away.
  useEffect(() => {
    if (!active) return;
    // The project viewing mode has the camera; don't fight it for it.
    if (tourInput.owner === 'theatre') {
      onEnd();
      return;
    }
    tourInput.owner = 'tour';
    document.exitPointerLock();
    // A book left open from before the tour closes first.
    if (phase === 'opening' || phase === 'opened') reset();
    setIndex(0);
    setPaused(false);
    setStage('fade-out');
    return () => {
      resetTourInput();
      setStage(null);
    };
    // Runs on start/stop only; phase and reset are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // The stage machine. Each stage either waits on a timer or on the book's
  // own phase (opened / idle) — the book animation stays the authority on
  // when a book is actually open, exactly as when a visitor opens one.
  const startedAt = useRef(0);
  useEffect(() => {
    if (!active || !stage) return;
    startedAt.current = performance.now();

    if (stage === 'fade-out') {
      const t = window.setTimeout(() => {
        aimAt(0);
        tourInput.cut = true;
        tourInput.active = true;
        setStage('fade-in');
      }, FADE_MS);
      return () => window.clearTimeout(t);
    }
    if (stage === 'fade-in') {
      const t = window.setTimeout(() => setStage('move'), FADE_MS);
      return () => window.clearTimeout(t);
    }
    if (stage === 'move') {
      aimAt(index);
      const t = window.setInterval(() => {
        if (tourInput.settled || performance.now() - startedAt.current > MAX_MOVE_MS) {
          window.clearInterval(t);
          setStage('open');
        }
      }, 80);
      return () => window.clearInterval(t);
    }
    if (stage === 'done') {
      resetTourInput();
      const t = window.setTimeout(onEnd, 6000);
      return () => window.clearTimeout(t);
    }
    // select/onEnd are stable; the stage change alone is what should drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stage, index]);

  // Book-phase transitions. Opening waits for the shelf to be idle, so a
  // book the visitor already had open (or one still closing) finishes
  // first instead of colliding with the tour's.
  useEffect(() => {
    // 'hovered' is idle too: the crosshair sweeps across books as the camera glides.
    const shelfIdle = phase === 'idle' || phase === 'hovered';
    if (stage === 'open' && book) {
      if (shelfIdle) select(book.id);
      // Something else got there first — a stray click on the scene, say.
      // The right book open counts; any other book is put back and the
      // tour's own opens once the shelf is idle again. Mid-animation
      // phases (opening, closing) are simply waited out.
      else if (phase === 'opened') {
        if (selectedId === book.id) setStage('read');
        else reset();
      }
    }
    // Closed by the visitor mid-read (Escape, Back to the shelf): that's "next".
    else if (stage === 'read' && (phase === 'closing' || shelfIdle)) setStage('close');
    else if (stage === 'close' && shelfIdle) {
      if (index + 1 >= books.length) setStage('done');
      else {
        setIndex(index + 1);
        setStage('move');
      }
    }
    // select is stable (useBookInteraction).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stage, index, books.length, selectedId]);

  // Reading time — held while paused.
  useEffect(() => {
    if (stage !== 'read' || paused || !book) return;
    const t = window.setTimeout(() => {
      reset();
      setStage('close');
    }, dwellFor(book));
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, paused, index]);

  const next = () => {
    if (stage === 'read') {
      reset();
      setStage('close');
    } else if (stage === 'move') setStage('open');
  };

  const end = () => {
    if (phase === 'opening' || phase === 'opened') reset();
    resetTourInput();
    onEnd();
  };

  if (!active || !stage) return null;

  const fading = stage === 'fade-out';
  const btn =
    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.6rem] tracking-[0.15em] text-paper/80 transition hover:bg-paper/10 hover:text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass disabled:opacity-40';

  return (
    <>
      {/* The cut to the shelf. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-[35] bg-ink transition-opacity ease-in-out ${
          fading ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      />

      <div
        role="region"
        aria-label="Guided tour"
        // Bottom edge, between the CV button and the quality switch on wide
        // screens; lifted above that row on narrow ones. Kept clear of the
        // centred book panel either way.
        className="fixed bottom-20 left-1/2 z-40 flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-2 rounded-full border border-paper/15 bg-ink/85 py-1.5 pl-4 pr-1.5 text-paper shadow-xl backdrop-blur-sm sm:bottom-5"
      >
        <p className="min-w-0 flex-1 truncate text-xs" aria-live="polite">
          {stage === 'done' ? (
            'That’s the tour. The PC, the lamp and a couple of secrets are yours to find.'
          ) : (
            <>
              <span className="text-brass">Tour</span>
              <span className="text-paper/50"> · {Math.min(index + 1, books.length)} of {books.length} · </span>
              {book?.title}
              {paused && <span className="text-paper/50"> (paused)</span>}
            </>
          )}
        </p>
        {stage !== 'done' && (
          <>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Resume tour' : 'Pause tour'}
              className={btn}
            >
              {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={next}
              disabled={stage !== 'read' && stage !== 'move'}
              aria-label="Next book"
              className={btn}
            >
              <SkipForward size={12} aria-hidden="true" />
            </button>
          </>
        )}
        <button type="button" onClick={end} className={btn}>
          <X size={12} aria-hidden="true" />
          {stage === 'done' ? 'LOOK AROUND' : 'END'}
        </button>
      </div>
    </>
  );
}
