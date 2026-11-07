/**
 * Shared, mutable channel between the tutorial (DOM, Tutorial.tsx)
 * and the walk camera (CameraRig.tsx) — the same pattern as touchInput.ts,
 * so the camera can be driven per frame without re-rendering anything.
 *
 * While `active`, CameraRig ignores walking and looking input and instead
 * glides to (standX, standZ) and turns to face `lookAt`. It reports back
 * through `settled` once it has arrived, which is the tutorial's cue to
 * hold on what it is showing.
 */
export const tourInput = {
  active: false,
  /** Who is driving: the tutorial, the viewing mode or "Go to". One at a time. */
  owner: null as 'tutorial' | 'theatre' | 'travel' | 'secret' | null,
  standX: 0,
  standZ: 0,
  /** World point to face. */
  lookAt: [0, 0, 0] as [number, number, number],
  /** Jump to the stand point this frame instead of gliding (the fade cut). */
  cut: false,
  /** Eye height above standing height, in metres: on a staircase. Glides like the rest. */
  eyeOffset: 0,
  /** Written by CameraRig: position and view have caught up with the target. */
  settled: false,
  /**
   * Written by CameraRig every frame while the visitor is in control: where
   * they stand and look. The viewing mode reads it when it opens, so it can
   * put them back there when it closes.
   */
  camera: { x: 0, z: 0, yaw: 0, pitch: 0 },
};

export function resetTourInput() {
  tourInput.active = false;
  tourInput.owner = null;
  tourInput.cut = false;
  tourInput.settled = false;
  tourInput.eyeOffset = 0;
}
