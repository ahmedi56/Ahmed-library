import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X, FolderGit2, ExternalLink, Mail } from 'lucide-react';
import { useCustomization } from '../../hooks/useCustomization';
import { useProjectShowcase } from '../../hooks/useProjectShowcase';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { projects as projectMeta } from '../../data/projects';
import { identity } from '../../data/books';
import { tourInput } from '../../lib/tourInput';
import { TV_SCREEN_WORLD, TV_VIEW_STAND } from '../../lib/tvLayout';

/**
 * The viewing mode: every project object in the room leads here.
 *
 * The camera walks (or, from across the room, cuts) to a spot facing the
 * wall TV, which holds on the project; this panel sits beside it with what
 * a 3D texture can't make comfortable to read — the description,
 * highlights, technologies and links. ← → browse; Esc walks the camera
 * back to where the visitor was standing.
 *
 * Text comes from the TV slot (owner-editable in Settings); everything
 * else — role, technologies, highlights, image, links — from
 * data/projects.ts, matched by position.
 */
interface ProjectTheatreProps {
  /** Slot id (`project-N`) to show, or null when closed. */
  slotId: string | null;
  onNavigate: (slotId: string) => void;
  onClose: () => void;
}

const FADE_MS = 320;
/** Further than this, cut (with a short fade) rather than walk through the furniture. */
const WALK_LIMIT = 3.2;

export function ProjectTheatre({ slotId, onNavigate, onClose }: ProjectTheatreProps) {
  const { projects: slots } = useCustomization();
  const { showProject, setHeld } = useProjectShowcase();
  const open = slotId !== null;
  const index = slots.findIndex((s) => s.id === slotId);
  const slot = index >= 0 ? slots[index] : null;
  const meta = index >= 0 ? projectMeta[index] : undefined;

  const [fading, setFading] = useState(false);
  const [focusTech, setFocusTech] = useState<string | null>(null);
  const origin = useRef<typeof tourInput.camera | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panelRef);

  // Close: walk back to where the visitor stood, then hand the camera over.
  const close = () => {
    const o = origin.current;
    if (o) {
      tourInput.standX = o.x;
      tourInput.standZ = o.z;
      // A point 2 m along their original line of sight.
      const fx = -Math.sin(o.yaw) * Math.cos(o.pitch);
      const fz = -Math.cos(o.yaw) * Math.cos(o.pitch);
      tourInput.lookAt = [o.x + fx * 2, -0.45 + Math.sin(o.pitch) * 2, o.z + fz * 2];
      const far = Math.hypot(o.x - TV_VIEW_STAND[0], o.z - TV_VIEW_STAND[1]) > WALK_LIMIT;
      if (far) tourInput.cut = true;
      // A timer, not requestAnimationFrame: rAF pauses in a background tab,
      // and a missed release would leave the visitor unable to move.
      const started = performance.now();
      const poll = window.setInterval(() => {
        // Arrived: walked back and settled, or the cut back has happened
        // (CameraRig clears `cut` once it has jumped).
        const arrived = far ? !tourInput.cut : tourInput.settled;
        if (arrived || performance.now() - started > 1600) {
          window.clearInterval(poll);
          tourInput.cut = false;
          tourInput.active = false;
          tourInput.owner = null;
        }
      }, 50);
    } else {
      tourInput.active = false;
      tourInput.owner = null;
    }
    origin.current = null;
    onClose();
  };
  useCloseOnEscape(open, close);

  // Open: remember where the visitor stands, then go to the TV.
  useEffect(() => {
    if (!open) return;
    document.exitPointerLock();
    origin.current = { ...tourInput.camera };
    tourInput.owner = 'theatre';
    const narrow = window.innerWidth < 900;
    tourInput.standX = TV_VIEW_STAND[0];
    tourInput.standZ = TV_VIEW_STAND[1];
    // Aim so the screen sits clear of the panel: left of it on wide
    // screens (+z is screen-right from here), above it on narrow ones.
    const [tx, ty, tz] = TV_SCREEN_WORLD;
    tourInput.lookAt = narrow ? [tx, ty - 1.15, tz] : [tx, ty - 0.1, tz + 0.95];
    const far = Math.hypot(tourInput.camera.x - TV_VIEW_STAND[0], tourInput.camera.z - TV_VIEW_STAND[1]) > WALK_LIMIT;
    if (far) {
      setFading(true);
      const t = window.setTimeout(() => {
        tourInput.cut = true;
        tourInput.active = true;
        setFading(false);
      }, FADE_MS);
      return () => window.clearTimeout(t);
    }
    tourInput.active = true;
    // Opening is the trigger; the rest is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The TV shows this project and stays on it while the panel is open.
  useEffect(() => {
    if (!slotId) return;
    showProject(slotId);
    setHeld(true);
    return () => setHeld(false);
  }, [slotId, showProject, setHeld]);

  // ← → browse (not while typing anywhere).
  useEffect(() => {
    if (!open || slots.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const step = e.key === 'ArrowRight' ? 1 : -1;
      onNavigate(slots[(index + step + slots.length) % slots.length].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, slots, index, onNavigate]);

  if (!open || !slot) return null;

  const technologies = meta?.technologies ?? [];
  const usesTech = (i: number) => !focusTech || (projectMeta[i]?.technologies ?? []).includes(focusTech);
  const go = (step: number) => onNavigate(slots[(index + step + slots.length) % slots.length].id);
  const btn =
    'flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink transition hover:border-brass hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass';

  return (
    <>
      <Fade on={fading} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="theatre-title"
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-[56vh] flex-col overflow-y-auto overscroll-contain rounded-t-3xl border border-ink/10 bg-paper/97 p-6 shadow-2xl outline-none backdrop-blur-md min-[900px]:inset-y-4 min-[900px]:left-auto min-[900px]:right-4 min-[900px]:max-h-none min-[900px]:w-[26rem] min-[900px]:rounded-3xl sm:p-8"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink/55">
            Project {index + 1} of {slots.length}
          </p>
          <button type="button" onClick={close} className={btn} aria-label="Back to the room">
            <X size={13} aria-hidden="true" /> Back to the room
          </button>
        </div>

        <h2 id="theatre-title" className="mt-4 font-serif text-3xl leading-tight text-ink sm:text-4xl">
          {slot.title}
        </h2>
        {meta?.tagline && <p className="mt-1 text-sm text-oak">{meta.tagline}</p>}
        {meta?.role && <p className="mt-3 text-xs text-ink/55">{meta.role}</p>}

        {meta?.media?.image && (
          <img
            src={meta.media.image}
            alt={`Screenshot of ${slot.title}`}
            width={640}
            height={360}
            loading="lazy"
            className="mt-5 aspect-video w-full rounded-xl border border-ink/10 object-cover"
          />
        )}

        <p className="mt-5 text-sm leading-relaxed text-ink/80">{slot.description}</p>

        {meta?.highlights && meta.highlights.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm text-ink/75">
            {meta.highlights.map((h) => (
              <li key={h} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brass" />
                {h}
              </li>
            ))}
          </ul>
        )}

        {technologies.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-ink/55">Built with — select one to see where else it’s used</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {technologies.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={focusTech === t}
                  onClick={() => setFocusTech((f) => (f === t ? null : t))}
                  className={`rounded-full border px-2.5 py-1 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass ${
                    focusTech === t ? 'border-brass bg-brass/20 text-ink' : 'border-ink/15 text-ink/75 hover:border-brass'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {meta?.links?.github && (
            <a href={meta.links.github} target="_blank" rel="noopener noreferrer" className={btn}>
              <FolderGit2 size={13} aria-hidden="true" /> Code on GitHub
            </a>
          )}
          {meta?.links?.live && (
            <a href={meta.links.live} target="_blank" rel="noopener noreferrer" className={btn}>
              <ExternalLink size={13} aria-hidden="true" /> Open the live app
            </a>
          )}
          {!meta?.links?.github && !meta?.links?.live && (
            <a
              href={`mailto:${identity.email}?subject=${encodeURIComponent(`About ${slot.title}`)}`}
              className={btn}
            >
              <Mail size={13} aria-hidden="true" /> Ask Ahmed about {slot.title}
            </a>
          )}
        </div>

        {slots.length > 1 && (
          <nav aria-label="All projects" className="mt-8 border-t border-ink/10 pt-5">
            <ul className="space-y-1">
              {slots.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(s.id)}
                    aria-current={i === index ? 'true' : undefined}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass ${
                      i === index ? 'bg-ink/[0.06] font-medium text-ink' : 'text-ink/70 hover:bg-ink/[0.04]'
                    } ${usesTech(i) ? '' : 'opacity-35'}`}
                  >
                    {s.title}
                    {projectMeta[i]?.tagline && <span className="text-ink/45"> · {projectMeta[i].tagline}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between">
              <button type="button" onClick={() => go(-1)} className={btn} aria-label="Previous project">
                <ArrowLeft size={13} aria-hidden="true" /> Previous
              </button>
              <span className="hidden text-xs text-ink/40 min-[900px]:inline">← → to browse</span>
              <button type="button" onClick={() => go(1)} className={btn} aria-label="Next project">
                Next <ArrowRight size={13} aria-hidden="true" />
              </button>
            </div>
          </nav>
        )}
      </div>
    </>
  );
}

/** A short fade to dark, covering the cut when the walk would be too long. */
function Fade({ on }: { on: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[35] bg-ink transition-opacity ${on ? 'opacity-100' : 'opacity-0'}`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    />
  );
}
