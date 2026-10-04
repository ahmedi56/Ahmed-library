import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MonitorPlay, BookOpenCheck, Smartphone, SprayCan } from 'lucide-react';
import type { ProjectAnchor } from '../../data/projectAnchors';
import type { ProjectSlot } from '../../hooks/useCustomization';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface ProjectDetailProps {
  anchor: ProjectAnchor | null;
  project: ProjectSlot | null;
  onClose: () => void;
}

const ICONS = {
  screen: MonitorPlay,
  guide: BookOpenCheck,
  mobile: Smartphone,
  service: SprayCan,
} as const;

/**
 * Full project view, opened from an object in the room.
 *
 * The clip plays here as a real <video> with controls, which is the one
 * place a plain player is the right answer: the visitor has deliberately
 * asked to look at this project, so scrubbing and pausing matter more
 * than the illusion. Inside the room the same clip stays a texture on the
 * TV mesh, with no player chrome, which is where the illusion matters.
 */
export function ProjectDetail({ anchor, project, onClose }: ProjectDetailProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // A slot can point at a path with no file behind it (the default three
  // do, until clips are added). Without this the player sat spinning on a
  // permanent 404 instead of showing the placeholder.
  const [videoFailed, setVideoFailed] = useState(false);
  const open = Boolean(anchor && project);
  useCloseOnEscape(open, onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panelRef);
  // A looping clip that starts on its own is exactly the motion
  // prefers-reduced-motion asks to avoid; it still plays on request.
  const reduced = useReducedMotion();

  useEffect(() => {
    if (open) document.exitPointerLock();
  }, [open]);

  // Stop playback on close so audio and decoding don't continue behind
  // the room the visitor just went back to.
  useEffect(() => {
    if (!open && videoRef.current) videoRef.current.pause();
  }, [open]);

  // Reset the failure flag when a different project is opened, so one
  // broken clip doesn't suppress the next working one.
  useEffect(() => {
    setVideoFailed(false);
  }, [project?.id, project?.src]);

  if (!anchor || !project) return null;
  const Icon = ICONS[anchor.icon];
  const hasVideo = Boolean(project.src) && !videoFailed;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-detail-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 px-6 backdrop-blur-sm"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-3xl outline-none border border-ink/10 bg-paper/97 p-7 shadow-2xl sm:p-9"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink/5 text-brass">
            <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[0.55rem] tracking-[0.3em] text-ink/40">
              {anchor.objectLabel.toUpperCase()}
            </p>
            <h2 id="project-detail-title" className="font-serif text-2xl leading-tight text-ink sm:text-3xl">
              {project.title}
            </h2>
          </div>
        </div>

        {project.stack && (
          <p className="mt-3 text-[0.7rem] tracking-[0.15em] text-brass">{project.stack}</p>
        )}

        <div className="mt-5 overflow-hidden rounded-2xl border border-ink/10 bg-ink/90">
          {hasVideo ? (
            <video
              ref={videoRef}
              src={project.src}
              controls
              autoPlay={!reduced}
              muted
              loop
              playsInline
              onError={() => setVideoFailed(true)}
              className="aspect-video w-full bg-black"
            />
          ) : (
            // Not an error state: most slots will have no clip until the
            // owner adds one, so this reads as a designed placeholder.
            <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-b from-[#0d1420] to-[#050810]">
              <p className="text-[0.6rem] tracking-[0.3em] text-paper/35">NO CLIP YET</p>
            </div>
          )}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-ink/70">{project.description}</p>

        <button
          onClick={onClose}
          className="mt-7 inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-2.5 text-xs tracking-[0.2em] text-ink transition hover:border-brass hover:text-brass focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          <ArrowLeft size={14} />
          BACK TO THE ROOM
        </button>
      </div>
    </div>
  );
}
