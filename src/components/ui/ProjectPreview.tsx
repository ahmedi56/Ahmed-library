import { MonitorPlay, BookOpenCheck, Smartphone, SprayCan } from 'lucide-react';
import type { ProjectAnchor } from '../../data/projectAnchors';
import type { ProjectSlot } from '../../hooks/useCustomization';

interface ProjectPreviewProps {
  anchor: ProjectAnchor | null;
  project: ProjectSlot | null;
  /** "PRESS E" on a pointer device, "TAP USE" on touch. */
  useVerb: string;
  /** Lifted clear of the on-screen walk controls on touch. */
  touch: boolean;
}

const ICONS = {
  screen: MonitorPlay,
  guide: BookOpenCheck,
  mobile: Smartphone,
  service: SprayCan,
} as const;

/**
 * The card that appears when the crosshair lands on an object tied to a
 * project: what the object is, which project it stands for, the stack, a
 * line of description, and how to open it.
 *
 * Deliberately the same translucent-paper language as the room's other
 * aim prompts rather than a new visual style, so discovering a project
 * feels like part of the room instead of a web page appearing over it.
 */
export function ProjectPreview({ anchor, project, useVerb, touch }: ProjectPreviewProps) {
  const visible = Boolean(anchor && project);
  const Icon = anchor ? ICONS[anchor.icon] : ICONS.screen;

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed left-1/2 z-20 w-[min(21rem,calc(100vw-3rem))] -translate-x-1/2 transition-[opacity,translate] duration-300 ease-out ${
        touch ? 'bottom-60' : 'bottom-24'
      } ${visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
    >
      {anchor && project && (
        <div className="rounded-2xl border border-ink/10 bg-paper/90 p-4 shadow-lg backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink/5 text-brass">
              <Icon size={18} strokeWidth={1.5} />
            </span>

            <div className="min-w-0 flex-1 text-left">
              <p className="text-[0.55rem] tracking-[0.25em] text-ink/40">
                {anchor.objectLabel.toUpperCase()}
              </p>
              <p className="font-serif text-lg leading-tight text-ink">{project.title}</p>
              {project.stack && (
                <p className="mt-0.5 text-[0.65rem] tracking-[0.12em] text-brass">{project.stack}</p>
              )}
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink/60">
                {project.description}
              </p>
            </div>
          </div>

          <p className="mt-3 border-t border-ink/10 pt-2 text-center text-[0.6rem] tracking-[0.25em] text-ink/45">
            {useVerb} FOR DETAILS
          </p>
        </div>
      )}
    </div>
  );
}
