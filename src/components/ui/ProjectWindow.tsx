import { useEffect, useRef } from 'react';
import { ExternalLink, FolderGit2, Tv, X } from 'lucide-react';
import { useCustomization } from '../../hooks/useCustomization';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { projects as projectMeta } from '../../data/projects';

interface ProjectWindowProps {
  /** Slot id (`project-N`) to show, or null when closed. */
  slotId: string | null;
  onClose: () => void;
  /** Hands over to the TV's viewing mode for the full write-up. */
  onOpenTv: (slotId: string) => void;
}

/**
 * The quick look: pressing a project object (the cleaning set, the stack
 * of manuals, the phone) opens this window where the visitor stands —
 * the project's video, what it's built with, one line about it — instead
 * of walking them across the room to the TV. The TV stays one click away
 * for everything else.
 *
 * Text and video come from the customization slot (edited in Settings),
 * with data/projects.ts behind it for the links and the screenshot.
 */
export function ProjectWindow({ slotId, onClose, onOpenTv }: ProjectWindowProps) {
  const { projects: slots } = useCustomization();
  const open = slotId !== null;
  const index = slots.findIndex((s) => s.id === slotId);
  const slot = index >= 0 ? slots[index] : null;
  const meta = index >= 0 ? projectMeta[index] : undefined;

  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panelRef);
  useCloseOnEscape(open, onClose);

  // The cursor is needed for the window's buttons and video controls.
  useEffect(() => {
    if (open) document.exitPointerLock?.();
  }, [open]);

  const video = slot?.src || meta?.media?.video || '';
  const image = meta?.media?.image;
  const stack = (slot?.stack ?? '')
    .split(/\s*·\s*/)
    .filter(Boolean);
  const btn =
    'flex items-center gap-2 rounded-full px-4 py-2 text-[0.65rem] tracking-[0.16em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass';

  return (
    <div
      inert={!open}
      onClick={onClose}
      className={`fixed inset-0 z-40 flex items-center justify-center bg-ink/45 px-4 transition-opacity duration-300 ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {slot && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-window-title"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-lg overflow-hidden rounded-3xl bg-paper text-ink shadow-2xl outline-none transition-transform duration-300 ${
            open ? 'scale-100' : 'scale-95'
          }`}
        >
          <div className="relative aspect-video bg-[#17110b]">
            {video ? (
              // Muted so it may start on its own; the controls are there
              // for anyone who wants the sound or to scrub.
              <video
                key={video}
                src={video}
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                controls
              />
            ) : image ? (
              <img src={image} alt="" className="h-full w-full object-cover" />
            ) : (
              // No video or screenshot yet: the TV's own slide, in HTML.
              <div className="flex h-full flex-col justify-center px-7 text-paper">
                <p className="text-[0.6rem] tracking-[0.3em] text-brass">
                  PROJECT {index + 1} OF {slots.length}
                </p>
                <p className="mt-2 font-serif text-4xl leading-none sm:text-5xl">{slot.title}</p>
                <p className="mt-3 text-xs text-brass">{slot.stack}</p>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-paper backdrop-blur-sm transition hover:bg-black/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="p-5 sm:p-6">
            <h2 id="project-window-title" className="font-serif text-2xl leading-tight">
              {slot.title}
            </h2>
            {stack.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Built with">
                {stack.map((t) => (
                  <li key={t} className="rounded-full bg-ink/[0.07] px-2.5 py-1 text-[0.7rem] text-oak">
                    {t}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-sm leading-relaxed text-ink/75">{meta?.tagline || slot.description}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => onOpenTv(slot.id)} className={`${btn} bg-ink text-paper hover:bg-ink/85`}>
                <Tv size={14} aria-hidden="true" />
                FULL DETAILS ON THE TV
              </button>
              {meta?.links?.github && (
                <a
                  href={meta.links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${btn} border border-ink/15 hover:border-brass`}
                >
                  <FolderGit2 size={14} aria-hidden="true" />
                  GITHUB
                </a>
              )}
              {meta?.links?.live && (
                <a
                  href={meta.links.live}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${btn} border border-ink/15 hover:border-brass`}
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  LIVE SITE
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
