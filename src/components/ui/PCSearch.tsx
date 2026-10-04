import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Search, ExternalLink, Check, Mail } from 'lucide-react';
import { usePCSearch } from '../../hooks/usePCSearch';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape';
import { identity } from '../../data/books';
import { playTyping } from '../../lib/sfx';

interface PCSearchProps {
  open: boolean;
  onClose: () => void;
  /** The visitor asked the PC whether to hire Ahmed (a secret stamp). */
  onHireQuestion?: () => void;
}

const SUGGESTIONS = [
  'Should I hire Ahmed?',
  'Ahmed Jatlaoui GitHub',
  'Ahmed Jatlaoui LinkedIn',
  'Ahmed Jatlaoui projects',
];

/**
 * "Should I hire Ahmed?", "hire him", "would you recruit Jatlaoui"… The one
 * question this PC answers itself instead of asking the internet, which
 * also spares a request from the shared search quota.
 */
function isHireQuestion(q: string): boolean {
  const n = q.toLowerCase();
  return /\b(hire|hiring|recruit\w*)\b/.test(n) && /\b(ahmed|jatlaoui|him|you)\b/.test(n);
}

/**
 * Everything listed here is checkable from the site itself or the CV —
 * the joke is the format, not the claims.
 */
const HIRE_REASONS = [
  'Built the room you are standing in: walkable 3D, and a plain version for slow phones.',
  'BSc in Computer Science, 2026.',
  'Full-stack: React, Next.js, Node/Express and Expo.',
  'Leaves code comments that explain why, not just what.',
];

/**
 * The in-room PC's "browser": a real search against Exa's search API
 * through the local /api/search proxy (vite.config.ts) — no hardcoded/fake
 * results. Styled as a desktop window rather than a plain form, so it reads
 * as "using the computer" rather than a settings dialog. Search state lives
 * in PCSearchProvider (context), shared with the laptop's in-world screen
 * mirror in LibraryEnvironment.tsx.
 */
export function PCSearch({ open, onClose, onHireQuestion }: PCSearchProps) {
  const { query, setQuery, status, results, error, search } = usePCSearch();
  const [hireAnswer, setHireAnswer] = useState(false);

  const run = (q: string) => {
    if (!q.trim()) return;
    playTyping();
    if (isHireQuestion(q)) {
      setHireAnswer(true);
      onHireQuestion?.();
      return;
    }
    setHireAnswer(false);
    void search(q);
  };
  const inputRef = useRef<HTMLInputElement>(null);
  useCloseOnEscape(open, onClose);

  // Same reasoning as BookContent/SettingsPanel: free the cursor for this
  // DOM UI once it's up, since it can be opened purely via crosshair + E.
  useEffect(() => {
    if (open) {
      document.exitPointerLock();
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pc-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/70 px-4 py-8 backdrop-blur-sm"
    >
      <div className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-ink/15 bg-[#0e1116] shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-[#171b21] px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <p id="pc-title" className="flex-1 text-center text-xs tracking-[0.2em] text-white/50">
            SEARCH
          </p>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.65rem] tracking-[0.15em] text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
          >
            <ArrowLeft size={12} />
            CLOSE
          </button>
        </div>

        {/* Address/search bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(query);
          }}
          role="search"
          // The ring sits on the whole bar rather than the bare input, which
          // has no border of its own to carry one.
          className="flex items-center gap-2 border-b border-white/10 bg-[#12151a] px-4 py-3 focus-within:bg-[#161a20] has-[input:focus-visible]:outline has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-brass"
        >
          <Search size={15} aria-hidden="true" className="shrink-0 text-white/40" />
          <input
            ref={inputRef}
            type="search"
            name="q"
            aria-label="Search the web"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={200}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the web…"
            className="min-w-0 flex-1 bg-transparent text-sm text-white/90 outline-none placeholder:text-white/30"
          />
          <button
            type="submit"
            className="rounded-md bg-brass/90 px-3 py-1.5 text-[0.65rem] tracking-[0.2em] text-ink transition hover:bg-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            SEARCH
          </button>
        </form>

        {/* Results */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {/* Results change without focus moving, so a screen reader
              otherwise hears nothing after pressing Search. */}
          <p className="sr-only" aria-live="polite">
            {hireAnswer
              ? 'Yes. One result, from this PC.'
              : status === 'loading'
              ? 'Searching…'
              : status === 'error'
                ? error
                : status === 'done'
                  ? `${results.length} results`
                  : ''}
          </p>
          {hireAnswer && (
            <div className="animate-fade-in">
              <p className="text-xs text-white/35">1 result · 0.00 seconds · answered locally</p>
              <p className="mt-4 font-serif text-5xl text-brass">Yes.</p>
              <p className="mt-3 text-sm text-white/60">Checked against everything in this library:</p>
              <ul className="mt-3 space-y-2">
                {HIRE_REASONS.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-white/80">
                    <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-[#27c93f]" />
                    {r}
                  </li>
                ))}
              </ul>
              <a
                href={`mailto:${identity.email}?subject=${encodeURIComponent('My PC says I should hire you')}`}
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-brass px-4 py-2 text-xs text-ink transition hover:bg-brass/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Mail size={13} aria-hidden="true" /> Email Ahmed
              </a>
              <p className="mt-6 text-xs text-white/30">
                The internet was not consulted. It would only have agreed.
              </p>
            </div>
          )}

          {!hireAnswer && status === 'idle' && (
            <div>
              <p className="text-xs tracking-[0.15em] text-white/30">TRY</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setQuery(s);
                      run(s);
                    }}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-brass/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!hireAnswer && status === 'loading' && (
            <p className="text-sm text-white/40">Searching…</p>
          )}

          {!hireAnswer && status === 'error' && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {!hireAnswer && status === 'done' && results.length === 0 && (
            <p className="text-sm text-white/40">No results.</p>
          )}

          {!hireAnswer && status === 'done' && results.length > 0 && (
            <ul className="space-y-4">
              {results.map((r, i) => (
                // Exa can return the same URL twice; the index keeps keys unique.
                <li key={`${i}-${r.link}`}>
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex max-w-full items-start gap-1.5 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
                  >
                    {/* An untitled page would otherwise be an empty, unclickable link. */}
                    <span className="break-words text-sm text-[#8ab4f8] group-hover:underline">
                      {r.title || r.displayLink || r.link}
                    </span>
                    <ExternalLink size={11} aria-hidden="true" className="mt-0.5 shrink-0 text-white/30" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                  <p className="truncate text-xs text-[#27c93f]/80">{r.displayLink}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">{r.snippet}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
