import { useEffect, useRef, useState } from 'react';
import { X, Send } from 'lucide-react';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { identity } from '../../data/books';
import { playPageFlip } from '../../lib/sfx';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'What has Ahmed built?',
  'Which technologies does he use most?',
  'Where did he study?',
  'Is he open to new roles?',
];

const MAX_QUESTION = 400;

/**
 * "Ask the librarian": a short conversation with Claude about Ahmed,
 * answered from the site's own content (api/_librarian.ts holds the rules
 * and the reference text). Lazy-loaded by both the room and the flat
 * view; the conversation lasts as long as the page does.
 */
export function AskLibrarian({ open, onClose }: { open: boolean; onClose: () => void }) {
  useCloseOnEscape(open, onClose);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useDialogFocus(open, inputRef);
  const listRef = useRef<HTMLDivElement>(null);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) document.exitPointerLock();
  }, [open]);

  // Keep the newest exchange in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, pending]);

  const ask = async (question: string) => {
    const q = question.trim().slice(0, MAX_QUESTION);
    if (!q || pending) return;
    const next: Turn[] = [...turns, { role: 'user', content: q }];
    setTurns(next);
    setDraft('');
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/librarian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The server keeps at most the last eight turns, starting on a
        // question; nine here always leaves it a question to start from.
        body: JSON.stringify({ messages: next.slice(-9) }),
      });
      // A host without serverless functions answers with the SPA's HTML.
      if (!res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('The librarian is not available on this deployment.');
      }
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok || !data.answer) throw new Error(data.error ?? 'The librarian could not answer.');
      setTurns([...next, { role: 'assistant', content: data.answer }]);
      playPageFlip();
    } catch (err) {
      // Take the unanswered question back off, so the history stays a
      // clean question/answer alternation, and put it back in the box.
      setTurns(turns);
      setDraft(q);
      setError(err instanceof Error ? err.message : 'Could not reach the librarian.');
    } finally {
      setPending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="librarian-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 px-4 py-8 backdrop-blur-sm"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-ink/10 bg-paper shadow-2xl">
        <div className="flex items-start justify-between gap-4 p-6 pb-3 sm:px-8 sm:pt-8">
          <div>
            <h2 id="librarian-title" className="font-serif text-2xl text-ink sm:text-3xl">
              Ask the librarian
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink/60">
              Questions about Ahmed, answered from what’s on these shelves.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-ink/15 p-2 text-ink transition hover:border-brass hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div
          ref={listRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-6 py-2 sm:px-8"
          aria-live="polite"
        >
          {turns.length === 0 && (
            <div className="flex flex-wrap gap-2 py-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink/75 transition hover:border-brass hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {turns.map((t, i) =>
            t.role === 'user' ? (
              <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2 text-sm text-paper">
                {t.content}
              </p>
            ) : (
              <div key={i} className="max-w-[90%]">
                <p className="font-serif text-xs text-brass">Librarian</p>
                <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-ink">{t.content}</p>
              </div>
            )
          )}

          {pending && <p className="font-serif text-sm italic text-ink/50">Checking the shelves…</p>}
          {error && (
            <p role="alert" className="text-xs leading-relaxed text-red-700">
              {error}
            </p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(draft);
          }}
          className="border-t border-ink/10 p-4 sm:px-8"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-ink/15 bg-white/50 p-2 focus-within:border-brass">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter asks; Shift+Enter is a new line.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void ask(draft);
                }
              }}
              rows={1}
              maxLength={MAX_QUESTION}
              aria-label="Your question"
              placeholder="Ask about Ahmed’s projects, skills or studies…"
              className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-ink/40"
            />
            <button
              type="submit"
              disabled={pending || !draft.trim()}
              aria-label="Ask"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-paper transition hover:bg-walnut focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:opacity-40"
            >
              <Send size={14} aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-[0.7rem] leading-relaxed text-ink/45">
            Answers are written by AI (Claude) from this site’s content and can be wrong. For anything
            important, email{' '}
            <a href={`mailto:${identity.email}`} className="underline underline-offset-2 hover:text-ink">
              {identity.email}
            </a>
            .
          </p>
        </form>
      </div>
    </div>
  );
}
