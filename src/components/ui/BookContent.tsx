import { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { ArrowLeft, Mail, Phone, MapPin, ExternalLink, Copy, Check } from 'lucide-react';
import type { BookData } from '../../data/books';
import { identity } from '../../data/books';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape';

interface BookContentProps {
  book: BookData | null;
  visible: boolean;
  onClose: () => void;
}

export function BookContent({ book, visible, onClose }: BookContentProps) {
  useCloseOnEscape(visible, onClose);

  // Same reasoning as Navigation.tsx: free the cursor so "BACK TO THE SHELF"
  // is actually clickable, since a book can be opened purely via keyboard
  // (crosshair + E/Space/Enter) while the pointer is still locked.
  useEffect(() => {
    if (visible) document.exitPointerLock();
  }, [visible]);

  // The panel itself takes focus, not its close button at the bottom,
  // so a screen reader starts reading from the title.
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(visible, panelRef);

  if (!book) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-content-title"
      // The panel is mounted while the book is still sliding off the shelf
      // (and while it slides back), only faded out. Without `inert` its
      // buttons stayed in the tab order and its text in the accessibility
      // tree during that window, invisible.
      inert={!visible}
      className={`fixed inset-0 z-30 flex items-center justify-center px-6 transition-opacity duration-500 ${
        visible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="max-h-[min(85vh,calc(100vh-7.5rem))] w-full max-w-md overflow-y-auto overscroll-contain outline-none rounded-3xl border border-ink/10 bg-paper/95 p-8 text-center shadow-2xl backdrop-blur-md sm:p-10"
      >
        <p className="text-[0.65rem] tracking-[0.4em] text-brass">{book.category.toUpperCase()}</p>
        <h2 id="book-content-title" className="mt-3 font-serif text-3xl text-ink sm:text-4xl">
          {book.title}
        </h2>
        {book.category === 'contact' ? (
          <ContactDetails />
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-ink/70 sm:text-base">{book.description}</p>
        )}
        {book.items && book.items.length > 0 && (
          <div className="mt-6 space-y-4 text-left">
            {book.items.map((item) => (
              <div key={item.title} className="border-t border-ink/10 pt-4 first:border-t-0 first:pt-0">
                <p className="font-serif text-base text-ink">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink/65">{item.detail}</p>
              </div>
            ))}
          </div>
        )}
        {book.status === 'soon' && (
          <p className="mt-6 text-[0.65rem] tracking-[0.3em] text-ink/40">COMING NEXT</p>
        )}
        <button
          onClick={onClose}
          className="mt-8 inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-2.5 text-xs tracking-[0.2em] text-ink transition hover:border-brass hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          <ArrowLeft size={14} />
          BACK TO THE SHELF
        </button>
      </div>
    </div>
  );
}


/**
 * The Contact book, made actionable.
 *
 * This used to be `book.description` — one line reading
 * "email · phone · city" as plain text. Nothing to tap on a phone, no way
 * to copy the address without selecting it by hand inside a 3D scene, and
 * no link to a profile anywhere in the entire app. Every field here comes
 * from `identity`; the ones left empty there simply don't render, so no
 * placeholder or guessed URL ever ships.
 */
function ContactDetails() {
  const [copied, setCopied] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(identity.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (insecure origin, or the permission was denied) —
      // the mailto link beside this still works, so there's nothing to
      // recover from and nothing worth interrupting the visitor about.
    }
  };

  const rowClass =
    'flex items-center gap-3 rounded-xl border border-ink/10 px-4 py-3 text-sm text-ink transition hover:border-brass hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass';

  return (
    <div className="mt-6 space-y-2 text-left">
      <div className="flex items-stretch gap-2">
        <a href={`mailto:${identity.email}`} className={`${rowClass} min-w-0 flex-1`}>
          <Mail size={15} className="shrink-0" />
          <span className="truncate">{identity.email}</span>
        </a>
        <button
          type="button"
          onClick={copyEmail}
          aria-label={copied ? 'Email address copied' : 'Copy email address'}
          className="flex shrink-0 items-center justify-center rounded-xl border border-ink/10 px-3 text-ink transition hover:border-brass hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>

      <a href={`tel:${identity.phone.replace(/\s+/g, '')}`} className={rowClass}>
        <Phone size={15} className="shrink-0" />
        <span>{identity.phone}</span>
      </a>

      {identity.github && (
        <a href={identity.github} target="_blank" rel="noopener noreferrer" className={rowClass}>
          <ExternalLink size={15} className="shrink-0" />
          <span className="truncate">GitHub</span>
        </a>
      )}

      {identity.linkedin && (
        <a href={identity.linkedin} target="_blank" rel="noopener noreferrer" className={rowClass}>
          <ExternalLink size={15} className="shrink-0" />
          <span className="truncate">LinkedIn</span>
        </a>
      )}

      <p className="flex items-center gap-3 px-4 py-2 text-sm text-ink/55">
        <MapPin size={15} className="shrink-0" />
        {identity.location}
      </p>
    </div>
  );
}
