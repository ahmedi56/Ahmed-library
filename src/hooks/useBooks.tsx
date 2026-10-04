import { createContext, useContext, type ReactNode } from 'react';
import { books as seedBooks, type BookData } from '../data/books';

interface BooksApi {
  books: BookData[];
  loading: boolean;
}

const BooksContext = createContext<BooksApi | null>(null);

// Static: data/books.ts is the only source. A module-level object rather
// than one built per render, so consumers of this context don't re-render
// for nothing.
const VALUE: BooksApi = { books: seedBooks, loading: false };

/**
 * Book content, straight from data/books.ts.
 *
 * This provider used to commit a writeBatch of all eight book documents to
 * Firestore on *every single page load* — and then ignore the result,
 * because (as the code itself concluded) this file is authoritative and
 * reading Firestore back had been serving a stale first-run snapshot. So
 * every visitor paid eight document writes for data nobody ever read.
 *
 * Worse than the wasted quota: those writes had to be permitted by the
 * security rules, which meant the `books` collection was publicly
 * writable. Any visitor could have rewritten the portfolio's content. The
 * sync is gone; the rules can now deny writes to `books` outright (see
 * firestore.rules).
 */
export function BooksProvider({ children }: { children: ReactNode }) {
  return <BooksContext.Provider value={VALUE}>{children}</BooksContext.Provider>;
}

export function useBooks(): BooksApi {
  const ctx = useContext(BooksContext);
  if (!ctx) throw new Error('useBooks must be used within a BooksProvider');
  return ctx;
}
