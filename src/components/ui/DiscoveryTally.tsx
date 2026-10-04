interface DiscoveryTallyProps {
  found: number;
  total: number;
  visible: boolean;
  /** Stamps earned on the borrower's card, shown beside the count. */
  stamps: number;
  onOpenCard: () => void;
}

/**
 * Quiet running count of how much of the room the visitor has actually
 * found — the reward half of exploring, without any of the gating.
 *
 * Nothing is ever locked behind this. It exists so that poking around has
 * a visible result, and so a visitor can tell there is more to look at
 * before they decide they've seen the place.
 *
 * Sits under the header rather than in a bottom corner: on a phone the
 * bottom-left is the walk stick and the bottom-right is the USE button and
 * the quality switch.
 */
export function DiscoveryTally({ found, total, visible, stamps, onOpenCard }: DiscoveryTallyProps) {
  const complete = found >= total;

  // A button now, so the borrower's card is reachable without a keyboard
  // (J) — on touch this is the only way in.
  return (
    <button
      type="button"
      onClick={onOpenCard}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      aria-label={`${found} of ${total} found, ${stamps} stamps. Open your borrower's card`}
      className={`fixed left-6 top-20 z-20 flex items-center gap-2 rounded-full border border-ink/10 bg-paper/70 px-3 py-1.5 text-[0.6rem] tracking-[0.25em] backdrop-blur-sm transition duration-500 hover:border-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass sm:left-8 sm:top-24 ${
        visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      } ${complete ? 'text-brass' : 'text-ink/60'}`}
    >
      <span aria-live="polite">
        {complete ? 'ROOM EXPLORED' : `${found} / ${total} FOUND`}
      </span>
      <span aria-hidden className="flex items-center gap-1 border-l border-ink/15 pl-2 text-brass">
        <span className="inline-block h-2 w-2 rounded-full border border-brass" />
        {stamps}
      </span>
    </button>
  );
}
