import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, X, Settings, Rows3, LogIn, LogOut, Footprints, MessageCircleQuestion } from 'lucide-react';
import { SettingsPanel } from './SettingsPanel';
import { useBooks } from '../../hooks/useBooks';
import { useOwner } from '../../hooks/useOwner';
import { firebaseConfigured } from '../../lib/firebaseClient';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape';
import { useDialogFocus } from '../../hooks/useDialogFocus';

/**
 * The sign-in control is revealed by ?admin=1 rather than sitting in the
 * header for everyone. Visitors get a clean interface with no account
 * furniture in it, and the owner gets a URL to bookmark. This hides the
 * control, not the protection: firestore.rules is what stops anyone else
 * writing, whether or not they find this parameter.
 */
function adminRequested(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('admin');
}

interface NavigationProps {
  /** Opens the book for a section, same as walking up and pressing E on it. */
  onOpenBook: (id: string) => void;
  /** Leaves the 3D room for the flat, scrollable version of the same content. */
  onSkipRoom: () => void;
  /** Starts the guided tour of the shelf. */
  onStartTour: () => void;
  /** Opens "Ask the librarian". */
  onAsk: () => void;
}

export function Navigation({ onOpenBook, onSkipRoom, onStartTour, onAsk }: NavigationProps) {
  const { books } = useBooks();
  const { ready, isOwner, signedIn, signIn, leave, error } = useOwner();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminMode] = useState(adminRequested);
  const canEdit = firebaseConfigured && ready && isOwner;

  // The walk camera's Pointer Lock hides/captures the cursor, so the menu
  // button underneath would otherwise be unclickable once locked. Free the
  // cursor the moment the menu is actually opened.
  useEffect(() => {
    if (open) document.exitPointerLock();
  }, [open]);

  // The menu covers the whole screen, so it behaves as the other overlays
  // do: Escape closes it and focus moves in (and back out) with it.
  const closeMenu = useCallback(() => setOpen(false), []);
  useCloseOnEscape(open, closeMenu);
  const menuRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, menuRef);

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-start justify-between p-6 sm:p-8">
        {/* Way out of the 3D room, into the flat version of the same
            content. Some visitors arrive on a throttled phone, a weak GPU
            or simply in a hurry, and until now the room was the only door
            in — the flat view existed but was reachable only by failing
            the WebGL check. */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={onSkipRoom}
            className="flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-4 py-2 text-xs tracking-[0.2em] text-ink backdrop-blur-sm transition hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            <Rows3 size={14} aria-hidden="true" />
            <span className="hidden sm:inline">SKIP THE ROOM</span>
            <span className="sm:hidden">SKIP</span>
          </button>
          {/* The middle road between walking it yourself and skipping it:
              the room shows itself, book by book. */}
          <button
            onClick={onStartTour}
            className="flex items-center gap-2 rounded-full border border-brass/40 bg-paper/70 px-4 py-2 text-xs tracking-[0.2em] text-oak backdrop-blur-sm transition hover:border-brass hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            <Footprints size={14} aria-hidden="true" />
            TOUR
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {/* Editing the room is the owner's, not the public's. This used
              to be here for every visitor, wired straight to shared
              Firestore documents with no authentication of any kind. */}
          {canEdit && (
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Open room settings"
              className="flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-4 py-2 text-xs tracking-[0.2em] text-ink backdrop-blur-sm transition hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              <Settings size={14} />
              <span className="hidden sm:inline">SETTINGS</span>
            </button>
          )}

          {adminMode && firebaseConfigured && ready && !isOwner && (
            <button
              onClick={() => void signIn()}
              className="flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-4 py-2 text-xs tracking-[0.2em] text-ink backdrop-blur-sm transition hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              <LogIn size={14} />
              <span className="hidden sm:inline">SIGN IN</span>
            </button>
          )}

          {adminMode && signedIn && (
            <button
              onClick={() => void leave()}
              aria-label="Sign out"
              className="flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-4 py-2 text-xs tracking-[0.2em] text-ink backdrop-blur-sm transition hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">SIGN OUT</span>
            </button>
          )}

          <button
            onClick={onAsk}
            aria-label="Ask the librarian"
            className="flex items-center gap-2 rounded-full border border-brass/40 bg-paper/70 px-4 py-2 text-xs tracking-[0.2em] text-oak backdrop-blur-sm transition hover:border-brass hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            <MessageCircleQuestion size={14} aria-hidden="true" />
            <span className="hidden sm:inline">ASK</span>
          </button>

          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-4 py-2 text-xs tracking-[0.2em] text-ink backdrop-blur-sm transition hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            {open ? <X size={14} /> : <Menu size={14} />}
            <span className="hidden sm:inline">MENU</span>
          </button>
        </div>
      </header>

      {/* Signed in, but not as the owner — say so rather than silently
          showing nothing after a successful Google sign-in. */}
      {adminMode && ready && signedIn && !isOwner && (
        <p className="pointer-events-none fixed inset-x-0 top-24 z-30 mx-auto w-fit rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-[0.65rem] tracking-[0.2em] text-amber-800 backdrop-blur-sm">
          SIGNED IN, BUT NOT THE OWNER ACCOUNT
        </p>
      )}
      {adminMode && error && (
        <p className="pointer-events-none fixed inset-x-0 top-24 z-30 mx-auto w-fit rounded-full border border-red-400/30 bg-red-400/10 px-4 py-1.5 text-[0.65rem] tracking-[0.2em] text-red-700 backdrop-blur-sm">
          {error.toUpperCase()}
        </p>
      )}

      <SettingsPanel open={settingsOpen && canEdit} onClose={() => setSettingsOpen(false)} />

      {open && (
        <div
          ref={menuRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-40 flex flex-col items-center justify-center-safe gap-6 overflow-y-auto overscroll-contain bg-ink/95 py-16 outline-none backdrop-blur-sm animate-fade-in"
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="absolute right-6 top-6 rounded-full border border-paper/20 p-2 text-paper transition hover:border-paper/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass sm:right-8 sm:top-8"
          >
            <X size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onStartTour();
            }}
            className="flex items-center gap-2 rounded-full border border-brass/50 px-5 py-2 text-xs tracking-[0.2em] text-brass transition hover:bg-brass hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            <Footprints size={14} aria-hidden="true" />
            TAKE THE GUIDED TOUR
          </button>
          <nav aria-label="Site sections" className="flex flex-col items-center gap-6">
            {/* These were five <a href="#"> that went nowhere — a dead menu on
                a portfolio. Each entry is one of the shelved books, so the
                menu now opens that book's panel, exactly as walking up to it
                and pressing E does. Built from the books list itself so it
                can't drift out of sync with the shelf. */}
            {books.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenBook(book.id);
                }}
                className="font-serif text-3xl text-paper/90 transition hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass sm:text-4xl"
              >
                {book.title}
              </button>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
