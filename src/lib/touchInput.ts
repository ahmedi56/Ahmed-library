/**
 * Shared, mutable input bus for touch devices.
 *
 * The walk camera is driven by WASD + Pointer Lock, neither of which exists
 * on a phone or tablet: a visitor on mobile could open the door (the DOM
 * "ENTER THE LIBRARY" button) and then had no way whatsoever to move or
 * look around — the whole portfolio was a static view of one wall. The
 * on-screen controls (components/ui/TouchControls.tsx) write here and
 * CameraRig reads it each frame, which keeps the DOM overlay and the
 * in-Canvas camera decoupled without threading a ref through the scene
 * graph or re-rendering either one per frame.
 */
export const touchInput = {
  /** -1..1 along the camera's right axis. */
  moveX: 0,
  /** -1..1 along the camera's forward axis. */
  moveZ: 0,
  /** Set by the on-screen interact button; CameraRig consumes and clears it. */
  interact: false,
};

/**
 * Whether touch is this visitor's *primary* way of pointing.
 *
 * Not the same question as "does this device support touch at all": a
 * Windows laptop with a touchscreen, and any browser with touch emulation
 * on, both report `maxTouchPoints > 0`. Keying the on-screen controls off
 * that put a thumbstick and a USE button over the scene for people holding
 * a mouse, and rewrote every prompt to say "TAP USE" at someone with a
 * keyboard in front of them.
 *
 * `(pointer: coarse)` asks about the primary pointing device instead,
 * which is the actual question. The touch listeners in CameraRig stay
 * attached unconditionally, so a hybrid device can still drag to look —
 * this only decides whose UI to show.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(pointer: coarse)').matches;
  }
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function resetTouchInput() {
  touchInput.moveX = 0;
  touchInput.moveZ = 0;
}
