import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Box,
  Download,
  UserRound,
  FolderGit2,
  Wrench,
  Briefcase,
  GraduationCap,
  Cpu,
  Palette,
  Mail,
  BookOpen,
  MessageCircleQuestion,
  type LucideIcon,
} from 'lucide-react';
import { identity } from '../../data/books';
import { useBooks } from '../../hooks/useBooks';
import { useResume } from '../../hooks/useResume';
import { BookContent } from './BookContent';
import { writeBookParam } from '../../lib/deepLink';
import type { BookCategory } from '../../data/books';

// Loaded on first open, so the light flat view stays light until then.
const AskLibrarian = lazy(() => import('./AskLibrarian').then((m) => ({ default: m.AskLibrarian })));

/**
 * One icon per section, so the cards are scannable at a glance instead of
 * eight identical colour blocks distinguished only by their captions.
 * Keyed by the book's own category, which is a closed union, so adding a
 * category without an icon is a type error rather than a blank card.
 */
const CATEGORY_ICONS: Record<BookCategory, LucideIcon> = {
  about: UserRound,
  projects: FolderGit2,
  skills: Wrench,
  experience: Briefcase,
  education: GraduationCap,
  ai: Cpu,
  creative: Palette,
  contact: Mail,
};

interface FallbackLibraryProps {
  /**
   * Returns to the 3D room. Absent when WebGL isn't available at all — in
   * that case this view isn't a choice, it's the only thing that can run.
   */
  onEnterRoom?: () => void;
  /** Book to open on arrival, from a ?book= link. */
  initialBookId?: string | null;
  /** Shown when we're here because the room failed, not because it was chosen. */
  notice?: string | null;
}

/**
 * The flat, scrollable version of the same portfolio.
 *
 * It was already here, already complete, and already navigable — but it
 * only ever rendered for visitors whose browser failed the WebGL check.
 * Everyone else was made to walk through a room whether or not they had
 * the hardware, the bandwidth or the time for it. It is now also a
 * deliberate choice anyone can make, and the choice sticks.
 */
export function FallbackLibrary({ onEnterRoom, initialBookId = null, notice = null }: FallbackLibraryProps) {
  const { books } = useBooks();
  const [selectedId, setSelectedId] = useState<string | null>(initialBookId);
  const selected = books.find((b) => b.id === selectedId) ?? null;
  const resume = useResume(identity.resumeUrl);
  const [askOpen, setAskOpen] = useState(false);

  useEffect(() => {
    writeBookParam(selected ? selected.id : null);
  }, [selected]);

  return (
    <div className="relative min-h-screen bg-paper px-6 py-10 sm:px-10">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-3">
        <div className="leading-tight">
          <p className="font-serif text-xl tracking-[0.15em] text-ink">{identity.name}</p>
          <p className="text-xs tracking-[0.35em] text-ink/50">{identity.role}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {resume.available && (
            <button
              type="button"
              onClick={() => void resume.download()}
              disabled={resume.downloading}
              className="flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-xs tracking-[0.2em] text-ink transition hover:border-brass hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:opacity-60"
            >
              <Download size={14} />
              {resume.downloading ? 'PREPARING…' : 'DOWNLOAD CV'}
            </button>
          )}
          <button
            onClick={() => setAskOpen(true)}
            className="flex items-center gap-2 rounded-full border border-brass/50 px-4 py-2 text-xs tracking-[0.2em] text-oak transition hover:border-brass hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            <MessageCircleQuestion size={14} aria-hidden="true" />
            ASK THE LIBRARIAN
          </button>
          {onEnterRoom && (
            <button
              onClick={onEnterRoom}
              className="flex items-center gap-2 rounded-full border border-ink/15 px-4 py-2 text-xs tracking-[0.2em] text-ink transition hover:border-brass hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              <Box size={14} />
              ENTER THE ROOM
            </button>
          )}
        </div>
      </header>

      {notice && (
        <p
          role="status"
          className="mx-auto mb-8 w-fit rounded-full border border-ink/10 bg-ink/5 px-4 py-2 text-xs text-ink/60"
        >
          {notice}
        </p>
      )}

      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-4xl text-ink">Welcome to my library</h1>
        <p className="mt-3 text-ink/60">
          A collection of my projects, skills, experience and ideas.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
        {books.map((book) => (
          <button
            key={book.id}
            onClick={() => setSelectedId(book.id)}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-ink/10 bg-white/40 p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
          >
            <div
              className="flex h-28 w-full items-center justify-center rounded-md shadow-inner"
              style={{ backgroundColor: book.coverColor }}
            >
              {(() => {
                // The cover colours are deep and saturated, so the icon is
                // drawn in the paper tone at partial opacity rather than a
                // fixed grey: it stays legible on every card without
                // fighting the colour it sits on.
                const Icon = CATEGORY_ICONS[book.category] ?? BookOpen;
                return (
                  <Icon
                    size={34}
                    strokeWidth={1.25}
                    className="text-paper/70 transition group-hover:text-paper"
                    aria-hidden="true"
                  />
                );
              })()}
            </div>
            <div>
              <p className="font-serif text-sm text-ink">{book.title}</p>
              <p className="text-xs text-ink/50">{book.subtitle}</p>
            </div>
          </button>
        ))}
      </div>

      <BookContent book={selected} visible={!!selected} onClose={() => setSelectedId(null)} />
      {askOpen && (
        <Suspense fallback={null}>
          <AskLibrarian open onClose={() => setAskOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
