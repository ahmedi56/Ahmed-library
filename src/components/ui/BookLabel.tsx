import { ArrowRight } from 'lucide-react';
import type { BookData } from '../../data/books';

interface BookLabelProps {
  book: BookData | null;
}

export function BookLabel({ book }: BookLabelProps) {
  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed left-1/2 top-[38%] z-20 -translate-x-1/2 -translate-y-1/2 text-center transition-[opacity,translate] duration-300 ${
        book ? 'translate-y-[-4px] opacity-100' : 'opacity-0'
      }`}
    >
      {book && (
        <div className="rounded-2xl border border-ink/10 bg-paper/85 px-6 py-3 shadow-lg backdrop-blur-sm">
          <p className="font-serif text-lg tracking-wide text-ink sm:text-xl">{book.title}</p>
          <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-ink/60">
            {book.subtitle}
            <ArrowRight size={12} />
          </p>
        </div>
      )}
    </div>
  );
}
