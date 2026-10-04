import { identity } from '../../data/books';

interface LibraryIntroProps {
  visible: boolean;
  /** Touch devices get the on-screen controls, not WASD/mouse-look. */
  touch?: boolean;
  /** prefers-reduced-motion: mouse-look stays off, so say so. */
  reduced?: boolean;
}

export function LibraryIntro({ visible, touch = false, reduced = false }: LibraryIntroProps) {
  // This line used to read "HOVER A BOOK TO EXPLORE · CLICK TO OPEN", which
  // described the interaction model this scene had *before* it became
  // free-roam: there is no hover any more, nothing responds to the mouse
  // cursor, and the only way to reach a book is to walk to it. It was also
  // the only onboarding text in the whole experience, so nothing anywhere
  // told a first-time visitor that they could move at all.
  // On a pointer device with prefers-reduced-motion set, CameraRig keeps
  // mouse-look disabled and arrow keys are the only way to turn — so
  // telling that visitor to move the mouse sends them to a control that
  // does nothing.
  const controls = touch
    ? 'DRAG TO LOOK · STICK TO WALK · USE TO OPEN A BOOK'
    : reduced
      ? 'WASD TO WALK · ARROW KEYS TO LOOK · E TO OPEN A BOOK'
      : 'WASD TO WALK · MOVE THE MOUSE TO LOOK · E TO OPEN A BOOK';

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 z-20 flex flex-col items-center px-6 text-center transition-[opacity,translate] duration-700 ease-out ${
        // Same reason as the aim prompts in Home: on touch the walk stick
        // and USE button own the bottom corners, and this block is tall
        // enough to run under both.
        touch ? 'bottom-60' : 'bottom-16 sm:bottom-20'
      } ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <p className="mb-2 text-[0.65rem] tracking-[0.4em] text-ink/50 sm:text-xs">
        {identity.role}
      </p>
      <h1 className="font-serif text-3xl leading-tight text-ink sm:text-5xl">
        Welcome to my library
      </h1>
      <p className="mt-3 max-w-sm text-sm text-ink/60 sm:text-base">
        A collection of my projects, skills, experience and ideas.
      </p>
      <p className="mt-4 max-w-xs text-[0.65rem] leading-relaxed tracking-[0.25em] text-ink/45 sm:max-w-none sm:text-xs sm:tracking-[0.3em]">
        {controls}
      </p>
    </div>
  );
}
