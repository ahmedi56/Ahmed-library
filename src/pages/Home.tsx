import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
/**
 * The 3D room, split into its own chunk.
 *
 * RoomView is the only thing in the app that reaches three.js, drei and
 * the postprocessing stack (~1.2 MB, 340 kB gzipped) or the Firebase SDK
 * (157 kB gzipped). Imported statically those landed in the entry bundle,
 * so a visitor who chose the flat view — or whose browser has no WebGL —
 * downloaded and parsed a renderer, a database client and an auth client
 * in order to look at a page of text.
 */
const RoomView = lazy(() =>
  import('../components/RoomView').then((m) => ({ default: m.RoomView }))
);
// Only ever shown inside the room, so kept out of the entry bundle for the
// same reason as RoomView: the flat view should not pay for it.
const StampToast = lazy(() =>
  import('../components/ui/BorrowerCard').then((m) => ({ default: m.StampToast }))
);
const BorrowerCard = lazy(() =>
  import('../components/ui/BorrowerCard').then((m) => ({ default: m.BorrowerCard }))
);
const RoomQuips = lazy(() =>
  import('../components/ui/RoomQuips').then((m) => ({ default: m.RoomQuips }))
);
import { LibraryIntro } from '../components/ui/LibraryIntro';
import { EntranceHint } from '../components/ui/EntranceHint';
import { BookLabel } from '../components/ui/BookLabel';
import { BookContent } from '../components/ui/BookContent';
import { PCSearch } from '../components/ui/PCSearch';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { PerformanceControls } from '../components/ui/PerformanceControls';
import { TouchControls } from '../components/ui/TouchControls';
import { DiscoveryTally } from '../components/ui/DiscoveryTally';
import { useChallenges } from '../hooks/useChallenges';
import { usePCSearch } from '../hooks/usePCSearch';
import { unlockAudio } from '../lib/audio';
import { playBookClose, playDoorCreak, playPageFlip, playSwitch } from '../lib/sfx';
import { FallbackLibrary } from '../components/ui/FallbackLibrary';
import { SceneErrorBoundary } from '../components/ui/SceneErrorBoundary';
import { useBookInteraction } from '../hooks/useBookInteraction';
import { usePerformance } from '../hooks/usePerformance';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useWebGLSupport } from '../hooks/useWebGLSupport';
import { useEntrance } from '../hooks/useEntrance';
import { useBooks } from '../hooks/useBooks';
import { isTouchDevice } from '../lib/touchInput';
import { useResume } from '../hooks/useResume';
import { readBookParam, writeBookParam } from '../lib/deepLink';
import { identity } from '../data/books';
import { PROJECT_ANCHORS } from '../data/projectAnchors';

const VIEW_STORAGE_KEY = 'library-view';

/** Everything in the room a visitor can find: the books plus door, PC, lamp. */
const EXTRA_INTERACTABLES = ['door', 'pc', 'lamp', ...PROJECT_ANCHORS.map((a) => a.id)];

export function Home() {
  // A ?book= link is a request for that section, so it also decides how
  // the visitor arrives: straight inside, with the book already open,
  // rather than out on the porch. Read once — later navigation shouldn't
  // re-trigger it.
  const deepLinkId = useRef(readBookParam()).current;

  // The flat view is a choice now, not only a WebGL failure state, and the
  // choice is remembered. A visitor who opted out of the room once should
  // not have to opt out again on their next visit.
  const [flatView, setFlatView] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'flat';
  });
  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, flatView ? 'flat' : 'room');
  }, [flatView]);

  // Set when the room's chunk fails to download or the scene throws at
  // runtime; the flat view takes over instead of the page going blank.
  const [sceneFailed, setSceneFailed] = useState(false);
  const handleSceneError = useCallback(() => setSceneFailed(true), []);

  const [loading, setLoading] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [cursorLocked, setCursorLocked] = useState(false);
  const [pcHovered, setPcHovered] = useState(false);
  const [pcOpen, setPcOpen] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [doorHovered, setDoorHovered] = useState(false);
  const [lampOn, setLampOn] = useState(false);
  const [lampHovered, setLampHovered] = useState(false);
  // Every prompt in this UI used to read "PRESS E", which is not an
  // instruction a phone can follow; on touch the equivalent is the
  // on-screen USE button (TouchControls).
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(isTouchDevice()), []);
  const useVerb = touch ? 'TAP USE' : 'PRESS E';
  // The aim prompts sit bottom-centre, and on touch the walk stick sits
  // bottom-left at the same height — on a 375px-wide screen a centred
  // "TAP USE TO CLOSE THE DOOR" pill spans x 72-302 while the stick
  // occupies 24-152, so the prompt ran underneath it. Lifting the prompts
  // clear of the controls (the stick's top edge is 224px up) costs
  // nothing on pointer devices, which keep the original placement.
  const hintClass = `pointer-events-none fixed left-1/2 z-20 -translate-x-1/2 rounded-full border border-ink/10 bg-paper/85 px-4 py-1.5 text-center text-[0.6rem] tracking-[0.25em] text-ink/70 backdrop-blur-sm ${
    touch ? 'bottom-60' : 'bottom-24'
  }`;
  const { books } = useBooks();
  const interaction = useBookInteraction();
  const { tier, setTier, profile } = usePerformance();
  const reduced = useReducedMotion();
  const webglSupported = useWebGLSupport();
  const { phase: entrancePhase, enter, crossThreshold, skipToInside } = useEntrance(reduced);
  const resume = useResume(identity.resumeUrl);

  // Which interactables the visitor has looked at, this session. Purely a
  // reward for exploring — nothing anywhere is gated on it.
  const [discovered, setDiscovered] = useState<ReadonlySet<string>>(() => new Set());
  const discover = useCallback((id: string) => {
    setDiscovered((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const { hoveredId, phase } = interaction;
  // Stable reference, unlike `interaction` itself, which is a fresh object
  // every render and would re-run the deep-link effect on each one.
  const selectBook = interaction.select;
  // Only a ?book= that names a real book counts. Trusting the raw value
  // meant ?book=anything spawned the visitor inside the room while the
  // entrance phase stayed 'outside' — standing in an unlit room, books
  // inert, with the "ENTER THE LIBRARY" prompt still asking them to come
  // in. An unrecognised value now just means a normal arrival.
  const deepLinkBookId = deepLinkId && books.some((b) => b.id === deepLinkId) ? deepLinkId : null;
  const totalInteractables = books.length + EXTRA_INTERACTABLES.length;
  const hoveredBook = books.find((b) => b.id === hoveredId) ?? null;
  const selectedBook = books.find((b) => b.id === interaction.selectedId) ?? null;
  const contentVisible = phase === 'opened';
  const isInside = entrancePhase === 'inside';

  // The door swings open as part of the entrance sequence (handled by
  // `enter`/entrancePhase, unchanged) — this just tracks that it's now
  // open so it can also be toggled shut/open again afterward, which
  // entrancePhase alone has no way to represent (it only ever moves
  // forward: outside -> opening -> walking -> inside).
  useEffect(() => {
    if (entrancePhase !== 'outside') setDoorOpen(true);
  }, [entrancePhase]);
  const toggleDoor = useCallback(() => setDoorOpen((v) => !v), []);

  // The borrower's card (useChallenges). Each stamp below is earned from a
  // signal this component already tracks; none of them gate anything.
  const challenges = useChallenges();
  const { earn } = challenges;
  const [cardOpen, setCardOpen] = useState(false);
  const { status: searchStatus } = usePCSearch();

  // The guided tour (GuidedTour.tsx, in the room chunk). Using it at all
  // this visit rules out Speed reader — the tour opens every book in about
  // a minute and a half, which would hand out that stamp for free.
  const [tourOn, setTourOn] = useState(false);
  const tourUsed = useRef(false);
  const startTour = useCallback(() => {
    tourUsed.current = true;
    setHasInteracted(true);
    setTourOn(true);
  }, []);
  const endTour = useCallback(() => setTourOn(false), []);

  // Secret stamp: five lamp flicks inside three seconds.
  const lampFlicks = useRef<number[]>([]);
  const toggleLamp = useCallback(() => {
    setLampOn((v) => !v);
    const now = Date.now();
    lampFlicks.current = [...lampFlicks.current.filter((t) => now - t < 3000), now];
    if (lampFlicks.current.length >= 5) earn('poltergeist');
  }, [earn]);

  const handleHoverDoor = useCallback(
    (hovered: boolean) => {
      setDoorHovered(hovered);
      if (hovered) discover('door');
    },
    [discover]
  );
  const handleHoverPC = useCallback(
    (hovered: boolean) => {
      setPcHovered(hovered);
      if (hovered) discover('pc');
    },
    [discover]
  );
  const handleHoverLamp = useCallback(
    (hovered: boolean) => {
      setLampHovered(hovered);
      if (hovered) discover('lamp');
    },
    [discover]
  );
  // The project objects live inside RoomView (they need the customization
  // provider, which loads with the room chunk); this is the only thing
  // Home needs back from them.
  const discoverAnchor = useCallback((id: string) => discover(id), [discover]);

  useEffect(() => {
    if (hoveredId || phase !== 'idle') setHasInteracted(true);
  }, [hoveredId, phase]);

  // Honour a ?book= link: step inside, open the door behind us so the room
  // is coherent if the visitor then closes the panel and looks around, and
  // open the requested book.
  //
  // Deferred by a cancellable timeout rather than run inline, and the
  // "already done" flag is set when the work happens rather than when it
  // is scheduled. Both details matter under StrictMode, which mounts,
  // tears down and remounts in development: running inline meant the
  // discarded first pass called select(), whose opening -> opened timer
  // was then killed by useBookInteraction's unmount cleanup, while the
  // flag it had already set stopped the real second pass from retrying.
  // The book stayed wedged half-open and the panel never appeared. This
  // shape leaves no trace behind on a discarded pass.
  const openedDeepLink = useRef(false);
  useEffect(() => {
    if (openedDeepLink.current || !deepLinkBookId || flatView) return;
    const timer = window.setTimeout(() => {
      openedDeepLink.current = true;
      skipToInside();
      setDoorOpen(true);
      selectBook(deepLinkBookId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [deepLinkBookId, flatView, skipToInside, selectBook]);

  // Keep the address bar in step with whatever is open, so any section can
  // be copied out of the URL bar and sent to someone.
  // Tracks the selected book, not the visible panel: a book spends a
  // second or so animating off the shelf before the panel shows, and
  // keying this on visibility stripped ?book= from the address bar during
  // that window and then put it back — briefly breaking the very link the
  // visitor had just followed.
  useEffect(() => {
    if (flatView) return;
    writeBookParam(interaction.selectedId);
  }, [flatView, interaction.selectedId]);

  // Books count as found the moment the crosshair lands on one.
  useEffect(() => {
    if (hoveredId) discover(hoveredId);
  }, [hoveredId, discover]);

  // --- Challenge detection -------------------------------------------
  // Books actually opened this visit (not just looked at), and when the
  // visitor first stepped inside, for Bookworm and Speed reader.
  const [openedBooks, setOpenedBooks] = useState<ReadonlySet<string>>(() => new Set());
  const enteredAt = useRef<number | null>(null);
  const openedId = phase === 'opened' ? interaction.selectedId : null;
  useEffect(() => {
    if (openedId) setOpenedBooks((prev) => (prev.has(openedId) ? prev : new Set(prev).add(openedId)));
  }, [openedId]);

  useEffect(() => {
    if (!isInside) return;
    enteredAt.current ??= Date.now();
    earn('enter');
  }, [isInside, earn]);

  useEffect(() => {
    if (lampOn) earn('lamp');
  }, [lampOn, earn]);

  useEffect(() => {
    if (searchStatus === 'done') earn('research');
  }, [searchStatus, earn]);

  useEffect(() => {
    if (openedBooks.size === 0) return;
    earn('first-book');
    if (books.length > 0 && books.every((b) => openedBooks.has(b.id))) {
      earn('bookworm');
      if (!tourUsed.current && enteredAt.current !== null && Date.now() - enteredAt.current < 3 * 60_000) {
        earn('speed');
      }
    }
  }, [openedBooks, books, earn]);

  useEffect(() => {
    if (PROJECT_ANCHORS.length > 0 && PROJECT_ANCHORS.every((a) => discovered.has(a.id))) earn('curator');
    if (discovered.size >= totalInteractables) earn('explorer');
  }, [discovered, totalInteractables, earn]);

  const downloadResume = useCallback(() => {
    earn('borrow');
    void resume.download();
  }, [earn, resume]);

  // --- Sound -----------------------------------------------------------
  // Browsers hold audio until a gesture. CameraRig unlocks it on the canvas,
  // but the first gesture is often a DOM button (Enter the library, Menu).
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (phase === 'opening') playPageFlip();
    else if (phase === 'closing') playBookClose();
  }, [phase]);

  // Skips the first run of each: a value's initial state isn't a change
  // anyone made, so it shouldn't make a sound.
  const doorSettled = useRef(false);
  useEffect(() => {
    if (doorSettled.current) playDoorCreak(doorOpen);
    doorSettled.current = true;
  }, [doorOpen]);

  const lampSettled = useRef(false);
  useEffect(() => {
    if (lampSettled.current) playSwitch(lampOn);
    lampSettled.current = true;
  }, [lampOn]);

  // J opens the card, like a journal key in a game. Ignored while typing
  // (the PC search box) and before the visitor is inside.
  useEffect(() => {
    if (!isInside) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // Auto-repeat would flick the card open and shut while J is held.
      if (e.code === 'KeyJ' && !e.repeat) setCardOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isInside]);

  // The intro text was only ever dismissed by looking at a book — if you
  // walked in and looked around the entrance/door first instead, it just
  // sat there indefinitely. Auto-dismiss it a few seconds after entering,
  // same as the hover-triggered dismiss, so it never outstays its welcome.
  useEffect(() => {
    if (!isInside) return;
    const timer = window.setTimeout(() => setHasInteracted(true), 6000);
    return () => window.clearTimeout(timer);
  }, [isInside]);

  if (!webglSupported || flatView || sceneFailed) {
    return (
      <FallbackLibrary
        // No way back into a room that just failed — re-mounting it would
        // only fail again. A reload is the honest retry.
        onEnterRoom={webglSupported && !sceneFailed ? () => setFlatView(false) : undefined}
        initialBookId={deepLinkBookId}
        notice={sceneFailed ? 'The 3D room could not be loaded, so here is the plain version.' : null}
      />
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-paper">
      {loading && <LoadingScreen onDone={() => setLoading(false)} />}

      <SceneErrorBoundary onError={handleSceneError}>
        <Suspense fallback={null}>
          <RoomView
            interaction={interaction}
            profile={profile}
            reduced={reduced}
            entrancePhase={entrancePhase}
            doorOpen={doorOpen}
            onOpenDoor={enter}
            onToggleDoor={toggleDoor}
            onHoverDoor={handleHoverDoor}
            onCrossThreshold={crossThreshold}
            onLockChange={setCursorLocked}
            onHoverPC={handleHoverPC}
            onOpenPC={() => setPcOpen(true)}
            lampOn={lampOn}
            onHoverLamp={handleHoverLamp}
            onToggleLamp={toggleLamp}
            discovered={discovered}
            onDiscoverAnchor={discoverAnchor}
            useVerb={useVerb}
            touch={touch}
            spawnInside={!!deepLinkBookId}
            onOpenBook={selectBook}
            onSkipRoom={() => setFlatView(true)}
            tourActive={tourOn && isInside}
            onStartTour={startTour}
            onTourEnd={endTour}
          />
        </Suspense>
      </SceneErrorBoundary>

      {/* Interaction is now aim-based (walk up, look at something, click/E/Enter) —
          a crosshair replaces the old DOM hover cursor for that reason. */}
      {!loading && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper/80 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
      )}

      {/* The Menu/tier buttons below need a free, visible cursor — while
          Pointer Lock has it captured, only Esc (or looking at something
          interactive) gets it back. This is the only way a user would know
          that, otherwise. */}
      {cursorLocked && !touch && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full border border-paper/20 bg-ink/60 px-4 py-1.5 text-[0.6rem] tracking-[0.25em] text-paper/80 backdrop-blur-sm sm:bottom-6">
          PRESS ESC TO FREE THE CURSOR
        </div>
      )}

      {pcHovered && !pcOpen && (
        <div className={hintClass}>
          {useVerb} TO USE THE PC
        </div>
      )}

      {/* Door stays interactable after entry — this is the toggle hint,
          separate from EntranceHint (the one-time "enter the library"
          prompt shown only in the 'outside' phase). */}
      {doorHovered && entrancePhase !== 'outside' && (
        <div className={hintClass}>
          {doorOpen ? `${useVerb} TO CLOSE THE DOOR` : `${useVerb} TO OPEN THE DOOR`}
        </div>
      )}

      {/* Wall lamp switch beside the entrance — same aim-and-press pattern
          as the door/PC, gives the player a light source they control
          instead of waiting on the daylight/atmosphere ramp. */}
      {lampHovered && (
        <div className={hintClass}>
          {lampOn ? `${useVerb} TO TURN OFF THE LAMP` : `${useVerb} TO TURN ON THE LAMP`}
        </div>
      )}

      <EntranceHint visible={!loading && entrancePhase === 'outside'} onOpen={enter} />
      <LibraryIntro visible={!loading && isInside && !hasInteracted} touch={touch} reduced={reduced} />
      <BookLabel book={phase === 'hovered' ? hoveredBook : null} />
      <BookContent book={selectedBook} visible={contentVisible} onClose={interaction.reset} />
      <PCSearch open={pcOpen} onClose={() => setPcOpen(false)} onHireQuestion={() => earn('good-taste')} />
      <DiscoveryTally
        found={discovered.size}
        total={totalInteractables}
        visible={isInside && !loading}
        stamps={Object.keys(challenges.earned).length}
        onOpenCard={() => setCardOpen(true)}
      />
      <Suspense fallback={null}>
        {!loading && <StampToast challenges={challenges} touch={touch} onOpenCard={() => setCardOpen(true)} />}
        {isInside && !loading && (
          <RoomQuips
            active={!contentVisible && !pcOpen && !cardOpen && !tourOn}
            blocked={challenges.current !== null}
            touch={touch}
            stamps={challenges.requiredDone}
            total={challenges.requiredTotal}
            rank={challenges.rank}
            complete={challenges.complete}
          />
        )}
        <BorrowerCard
          open={cardOpen}
          onClose={() => setCardOpen(false)}
          challenges={challenges}
          resumeAvailable={resume.available}
          onDownloadResume={downloadResume}
        />
      </Suspense>

      {/* Appears on its own once a CV exists — uploaded from the Settings
          panel, or committed at identity.resumeUrl. */}
      {resume.available && (
        <button
          type="button"
          onClick={downloadResume}
          disabled={resume.downloading}
          className="pointer-events-auto fixed bottom-5 left-5 z-30 flex items-center gap-2 rounded-full border border-ink/10 bg-paper/70 px-4 py-2 text-[0.6rem] tracking-[0.2em] text-ink backdrop-blur-sm transition hover:border-brass hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:opacity-60 sm:bottom-6 sm:left-6"
        >
          <Download size={13} />
          {resume.downloading ? '…' : 'CV'}
        </button>
      )}

      <PerformanceControls tier={tier} onChange={setTier} />
      {/* Walk + interact controls for phones/tablets, where there is no
          WASD and no Pointer Lock. Renders nothing on pointer devices, or
          before the entrance sequence starts (see TouchControls). */}
      <TouchControls active={entrancePhase !== 'outside' && !tourOn} />
    </div>
  );
}
