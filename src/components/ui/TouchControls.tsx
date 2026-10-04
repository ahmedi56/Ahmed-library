import { useEffect, useRef, useState } from 'react';
import { touchInput, isTouchDevice, resetTouchInput } from '../../lib/touchInput';

const PAD_RADIUS = 56;

/**
 * On-screen walk + interact controls, rendered only on touch devices.
 *
 * Desktop drives the camera with WASD and Pointer Lock; a phone has
 * neither, so without this the scene is a fixed view you cannot move
 * through. Look is handled by dragging the canvas itself (CameraRig);
 * this supplies the movement axis and an interact button, writing into
 * the shared `touchInput` bus so neither this component nor the camera
 * re-renders while a thumb is down.
 */
interface TouchControlsProps {
  /**
   * Hidden until the entrance sequence has started. Measured on a 375x812
   * viewport, the thumbstick (x 24-152, y 588-716) and the USE button
   * (271-351, 620-700) both intersect the "ENTER THE LIBRARY" call to
   * action (73-303, 695-732) — and sit above it in the stacking order
   * (z-30 vs z-20), so they were covering parts of the one control that
   * screen exists for. There is also nothing to walk to yet while outside.
   */
  active: boolean;
}

export function TouchControls({ active }: TouchControlsProps) {
  const [touch, setTouch] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const padRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);

  useEffect(() => {
    setTouch(isTouchDevice());
    return resetTouchInput;
  }, []);

  if (!touch || !active) return null;

  const applyFromPoint = (clientX: number, clientY: number) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > PAD_RADIUS) {
      dx = (dx / dist) * PAD_RADIUS;
      dy = (dy / dist) * PAD_RADIUS;
    }
    setKnob({ x: dx, y: dy });
    touchInput.moveX = dx / PAD_RADIUS;
    // Screen-up (negative dy) is "forward".
    touchInput.moveZ = -dy / PAD_RADIUS;
  };

  const release = () => {
    activeId.current = null;
    setKnob({ x: 0, y: 0 });
    resetTouchInput();
  };

  return (
    <>
      <div
        ref={padRef}
        aria-hidden="true"
        onTouchStart={(e) => {
          const t = e.changedTouches[0];
          activeId.current = t.identifier;
          applyFromPoint(t.clientX, t.clientY);
        }}
        onTouchMove={(e) => {
          const t = Array.from(e.changedTouches).find((c) => c.identifier === activeId.current);
          if (t) applyFromPoint(t.clientX, t.clientY);
        }}
        onTouchEnd={release}
        onTouchCancel={release}
        className="fixed bottom-24 left-6 z-30 flex h-32 w-32 touch-none select-none items-center justify-center rounded-full border border-paper/25 bg-ink/25 backdrop-blur-sm"
      >
        <div
          className="h-12 w-12 rounded-full border border-paper/40 bg-paper/50"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>

      <button
        type="button"
        aria-label="Interact with what you are looking at"
        onTouchStart={(e) => {
          e.preventDefault();
          touchInput.interact = true;
        }}
        onClick={() => {
          touchInput.interact = true;
        }}
        className="fixed bottom-28 right-6 z-30 h-20 w-20 touch-none select-none rounded-full border border-paper/30 bg-ink/40 text-[0.6rem] tracking-[0.2em] text-paper backdrop-blur-sm active:bg-ink/70"
      >
        USE
      </button>
    </>
  );
}
