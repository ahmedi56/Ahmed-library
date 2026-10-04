interface EntranceHintProps {
  visible: boolean;
  onOpen: () => void;
}

export function EntranceHint({ visible, onOpen }: EntranceHintProps) {
  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 bottom-16 z-20 flex flex-col items-center px-6 text-center transition-[opacity,translate] duration-700 ease-out sm:bottom-20 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <button
        onClick={onOpen}
        disabled={!visible}
        className="pointer-events-auto rounded-full border border-paper/25 bg-ink/40 px-6 py-2.5 text-xs tracking-[0.3em] text-paper backdrop-blur-sm transition hover:border-brass hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
      >
        ENTER THE LIBRARY
      </button>
      <p className="mt-3 text-[0.65rem] tracking-[0.25em] text-paper/50 sm:text-xs">
        CLICK THE DOOR &middot; OR PRESS ENTER
      </p>
    </div>
  );
}
