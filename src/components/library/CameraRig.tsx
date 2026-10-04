import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { EntrancePhase } from '../../hooks/useEntrance';
import { DOOR_Z } from './Entrance';
import { collidersFor, resolveMove, PLAYER_EYE_HEIGHT, FLOOR_Y } from '../../lib/collision';
import { playFootstep, unlockFootstepAudio } from '../../lib/footsteps';
import { touchInput, isTouchDevice } from '../../lib/touchInput';
import { tourInput } from '../../lib/tourInput';

interface CameraRigProps {
  entrancePhase: EntrancePhase;
  /** Actual door state (Home.tsx) — replaces the old phase-derived guess so
   *  closing the door after entering really does block the doorway again. */
  doorOpen: boolean;
  reduced: boolean;
  onCrossThreshold: () => void;
  /** Ref this session's crosshair-interact trigger into, so a click/E also
   *  works as "interact" once pointer lock is engaged (not just look). */
  interactRef: React.RefObject<(() => void) | null>;
  /** Reports Pointer Lock state up to the DOM UI layer, which needs to know
   *  when the cursor is captured (menu/tier buttons are unclickable then —
   *  only Esc, or CrosshairInteraction's keyboard-driven interact, work). */
  onLockChange?: (locked: boolean) => void;
  /**
   * Spawn just inside the room instead of out on the porch. Read once, at
   * mount, for ?book= deep links — the entrance phase is already 'inside'
   * in that case, so starting outside the door would strand the visitor on
   * the wrong side of a wall they're not being asked to cross.
   */
  spawnInside?: boolean;
}

const DOOR_HALF_WIDTH = 0.75;
// Seconds between footfalls at normal walking pace — not tied to frame rate,
// just real elapsed time while actually moving.
const STEP_INTERVAL = 0.42;
const STEP_SPEED_THRESHOLD = 0.35;
// z = 7.15 (the far edge of what ROOM_BOUNDS allows, 7.5 minus the player
// radius) rather than 6.8. At 6.8 the camera stands 1.5 m off the door,
// where a 1.66 m leaf covers about half the frame edge-to-edge and the
// frame, arch and surrounding wall are all outside the view — the opening
// shot was a wall of door. The extra 0.35 m pulls the whole entrance into
// frame without moving any geometry.
const SPAWN_POSITION = new THREE.Vector3(0, FLOOR_Y + PLAYER_EYE_HEIGHT, 7.15);
// Just past the entrance wall (its boxes span z 5.1-5.5), facing into the room.
const SPAWN_POSITION_INSIDE = new THREE.Vector3(0, FLOOR_Y + PLAYER_EYE_HEIGHT, 4.3);
// At yaw = 0 the camera faces -Z (three.js default); the door sits at a
// smaller z (5.3) than the spawn point, so yaw = 0 already faces it —
// no turn needed.
const SPAWN_YAW = 0;

const MOVE_SPEED = 3.2;
const DAMPING = 10;
const LOOK_SPEED = 1.6; // rad/sec, keyboard-look fallback
const MOUSE_SENSITIVITY = 0.0022;
// Per CSS pixel of drag. Higher than the mouse figure because a thumb
// covers far less screen distance than a mouse covers desk.
const TOUCH_SENSITIVITY = 0.005;
// Below this much finger travel a touch is a tap (interact), above it a
// look-drag — and the synthetic click the browser fires afterward has to
// be swallowed so dragging the view doesn't also trigger whatever the
// crosshair happened to land on.
const TOUCH_DRAG_THRESHOLD = 8;
// Guided tour: how quickly the camera closes the gap to its target
// (exponential, per second), and how close counts as arrived.
const TOUR_GLIDE_RATE = 2.6;
const TOUR_TURN_RATE = 4;
const TOUR_SETTLE_DISTANCE = 0.04;
const TOUR_SETTLE_ANGLE = 0.03;

/** Signed shortest difference between two angles, in -PI..PI. */
function angleDelta(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * Free-roam walk camera: WASD + damping for movement, Pointer Lock for
 * mouse-look with an arrow-key-look fallback for when lock can't engage
 * (the same WrongDocumentError class of failure hit and fixed in the
 * threejs-walkthrough-demo — ported here as a design decision, not a patch,
 * since this project never used Pointer Lock before).
 */
export function CameraRig({ entrancePhase, doorOpen, reduced, onCrossThreshold, interactRef, onLockChange, spawnInside = false }: CameraRigProps) {
  const { camera, gl } = useThree();
  const yaw = useRef(SPAWN_YAW);
  const pitch = useRef(0);
  const locked = useRef(false);
  const pointerLockSupported = useRef(true);

  const move = useRef({ forward: false, back: false, left: false, right: false });
  const look = useRef({ left: false, right: false, up: false, down: false });
  const velocity = useRef({ x: 0, z: 0 });
  const interactPressed = useRef(false);
  const stepTimer = useRef(0);
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const touchDragged = useRef(false);

  // Spawn once. spawnInside is intentionally not in the dependency list:
  // this is where the visitor starts, not something that should teleport
  // them mid-session if the prop ever changed.
  useEffect(() => {
    camera.position.copy(spawnInside ? SPAWN_POSITION_INSIDE : SPAWN_POSITION);
    camera.rotation.set(0, SPAWN_YAW, 0, 'YXZ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  useEffect(() => {
    const el = gl.domElement;

    // Pointer Lock doesn't exist on touch platforms, and asking for it there
    // only costs a wasted first tap (request -> error -> ignored) before
    // taps start doing anything. Look is handled by drag instead, below.
    if (isTouchDevice()) pointerLockSupported.current = false;

    const onClick = () => {
      unlockFootstepAudio();
      if (touchDragged.current) {
        touchDragged.current = false;
        return;
      }
      if (pointerLockSupported.current && !locked.current) {
        // requestPointerLock() returns a Promise in current browsers and
        // undefined in older ones. We already listen for the legacy
        // 'pointerlockerror' event, but nothing caught the promise, so a
        // refusal surfaced as an uncaught rejection in the console — which
        // is what happens every time the page runs somewhere pointer lock
        // isn't permitted, such as inside an iframe. Catching it also gives
        // the more reliable modern signal for falling back to arrow-key look.
        const request = el.requestPointerLock() as unknown;
        if (request && typeof (request as Promise<void>).catch === 'function') {
          (request as Promise<void>).catch(() => {
            pointerLockSupported.current = false;
          });
        }
        return;
      }
      interactRef.current?.();
    };

    const onTouchStart = (e: TouchEvent) => {
      unlockFootstepAudio();
      const t = e.touches[0];
      if (!t) return;
      lastTouch.current = { x: t.clientX, y: t.clientY };
      touchDragged.current = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      const last = lastTouch.current;
      // Deliberately NOT gated on `reduced`, unlike the mouse path below.
      // A phone has no arrow keys, so treating a look-drag as "motion to
      // suppress" left a visitor with prefers-reduced-motion able to walk
      // (thumbstick) but never able to turn — permanently facing one wall
      // with no other input to fall back on. A drag is direct
      // manipulation, 1:1 with the finger, not the kind of automatic
      // motion that setting is asking us to stop; the door swing and the
      // atmosphere ramp, which are, still honour it.
      if (!t || !last) return;
      // The tour has the camera; a drag shouldn't fight it.
      if (tourInput.active) return;
      const dx = t.clientX - last.x;
      const dy = t.clientY - last.y;
      if (Math.abs(dx) + Math.abs(dy) > TOUCH_DRAG_THRESHOLD) touchDragged.current = true;
      yaw.current -= dx * TOUCH_SENSITIVITY;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - dy * TOUCH_SENSITIVITY,
        -Math.PI / 2 + 0.05,
        Math.PI / 2 - 0.05
      );
      lastTouch.current = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    };
    const onTouchEnd = () => {
      lastTouch.current = null;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!locked.current || reduced || tourInput.active) return;
      yaw.current -= e.movementX * MOUSE_SENSITIVITY;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - e.movementY * MOUSE_SENSITIVITY,
        -Math.PI / 2 + 0.05,
        Math.PI / 2 - 0.05
      );
    };
    const onPointerLockChange = () => {
      locked.current = document.pointerLockElement === el;
      onLockChange?.(locked.current);
    };
    const onLockError = () => {
      pointerLockSupported.current = false;
    };
    // The PC search field and the settings panel's title fields are real
    // text inputs, but these listeners are on window: typing "world" into
    // the search box was also walking the player forward, left and right
    // (and E/Space re-firing interact) behind the open dialog.
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el || !el.tagName) return false;
      return (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      unlockFootstepAudio();
      switch (e.code) {
        case 'KeyW': move.current.forward = true; break;
        case 'KeyS': move.current.back = true; break;
        case 'KeyA': move.current.left = true; break;
        case 'KeyD': move.current.right = true; break;
        case 'ArrowLeft': look.current.left = true; break;
        case 'ArrowRight': look.current.right = true; break;
        case 'ArrowUp': look.current.up = true; break;
        case 'ArrowDown': look.current.down = true; break;
        case 'KeyE':
        case 'Space':
        case 'Enter':
          e.preventDefault();
          interactPressed.current = true;
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      switch (e.code) {
        case 'KeyW': move.current.forward = false; break;
        case 'KeyS': move.current.back = false; break;
        case 'KeyA': move.current.left = false; break;
        case 'KeyD': move.current.right = false; break;
        case 'ArrowLeft': look.current.left = false; break;
        case 'ArrowRight': look.current.right = false; break;
        case 'ArrowUp': look.current.up = false; break;
        case 'ArrowDown': look.current.down = false; break;
      }
    };

    el.addEventListener('click', onClick);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('pointerlockerror', onLockError);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      el.removeEventListener('click', onClick);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gl, reduced, interactRef, onLockChange]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);

    // Guided tour: the camera is on rails. It glides along a line in front
    // of the shelf that GuidedTour picks to be clear of all furniture, so
    // collision isn't consulted, and every other input is set aside —
    // including interact, which would otherwise open whatever the
    // crosshair happened to cross on the way past.
    if (tourInput.active) {
      velocity.current.x = 0;
      velocity.current.z = 0;
      interactPressed.current = false;
      touchInput.interact = false;

      const eyeY = FLOOR_Y + PLAYER_EYE_HEIGHT;
      const before = camera.position.clone();
      const jumped = tourInput.cut || reduced;
      if (jumped) {
        camera.position.set(tourInput.standX, eyeY, tourInput.standZ);
        tourInput.cut = false;
      } else {
        const k = 1 - Math.exp(-TOUR_GLIDE_RATE * delta);
        camera.position.x += (tourInput.standX - camera.position.x) * k;
        camera.position.z += (tourInput.standZ - camera.position.z) * k;
        camera.position.y = eyeY;
      }

      const [lx, ly, lz] = tourInput.lookAt;
      const dx = lx - camera.position.x;
      const dy = ly - camera.position.y;
      const dz = lz - camera.position.z;
      // Forward at yaw = 0 is -Z, so the yaw that faces (dx, dz) is atan2(-dx, -dz).
      const targetYaw = Math.atan2(-dx, -dz);
      const targetPitch = Math.atan2(dy, Math.hypot(dx, dz));
      const turn = reduced ? 1 : 1 - Math.exp(-TOUR_TURN_RATE * delta);
      const yawGap = angleDelta(yaw.current, targetYaw);
      yaw.current += yawGap * turn;
      pitch.current += (targetPitch - pitch.current) * turn;
      camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');

      const dist = Math.hypot(tourInput.standX - camera.position.x, tourInput.standZ - camera.position.z);
      tourInput.settled =
        dist < TOUR_SETTLE_DISTANCE &&
        Math.abs(angleDelta(yaw.current, targetYaw)) < TOUR_SETTLE_ANGLE &&
        Math.abs(targetPitch - pitch.current) < TOUR_SETTLE_ANGLE;

      // Footsteps keep time with the glide, so it still reads as walking.
      const moved = jumped ? 0 : camera.position.distanceTo(before) / Math.max(delta, 1e-4);
      if (moved > STEP_SPEED_THRESHOLD) {
        stepTimer.current += delta;
        if (stepTimer.current >= STEP_INTERVAL) {
          stepTimer.current = 0;
          playFootstep();
        }
      } else {
        stepTimer.current = 0;
      }
      return;
    }

    // Keyboard look (works regardless of pointer-lock availability).
    const yawInput = Number(look.current.left) - Number(look.current.right);
    const pitchInput = Number(look.current.up) - Number(look.current.down);
    if (yawInput !== 0) yaw.current += yawInput * LOOK_SPEED * delta;
    if (pitchInput !== 0) {
      pitch.current = THREE.MathUtils.clamp(
        pitch.current + pitchInput * LOOK_SPEED * delta,
        -Math.PI / 2 + 0.05,
        Math.PI / 2 - 0.05
      );
    }
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');

    // WASD, damped, resolved against room + furniture collision.
    // velocity.z / velocity.x are speeds along the camera's own forward/right
    // axes (positive = forward / right), independent of world orientation.
    velocity.current.z -= velocity.current.z * DAMPING * delta;
    velocity.current.x -= velocity.current.x * DAMPING * delta;
    const forwardInput = THREE.MathUtils.clamp(
      Number(move.current.forward) - Number(move.current.back) + touchInput.moveZ,
      -1,
      1
    );
    const strafeInput = THREE.MathUtils.clamp(
      Number(move.current.right) - Number(move.current.left) + touchInput.moveX,
      -1,
      1
    );
    velocity.current.z += forwardInput * MOVE_SPEED * delta * DAMPING;
    velocity.current.x += strafeInput * MOVE_SPEED * delta * DAMPING;

    const sinYaw = Math.sin(yaw.current);
    const cosYaw = Math.cos(yaw.current);
    // At yaw = 0 the camera faces -Z (three.js convention), so forward = (0,-1)
    // and right = (1,0) in the XZ plane; rotate both by yaw for the general case.
    const forwardX = -sinYaw;
    const forwardZ = -cosYaw;
    const rightX = cosYaw;
    const rightZ = -sinYaw;
    const dx = (velocity.current.z * forwardX + velocity.current.x * rightX) * delta;
    const dz = (velocity.current.z * forwardZ + velocity.current.x * rightZ) * delta;

    // During the initial swing-open animation ('opening'), still block the
    // doorway regardless of the `doorOpen` prop (which flips true the
    // instant the sequence starts) — same as before, don't let the player
    // walk through a door that's still visually mid-swing. Afterward, the
    // real (toggle-able) doorOpen state governs it.
    const collisionDoorOpen = entrancePhase === 'opening' ? false : doorOpen;
    const boxes = collidersFor(collisionDoorOpen, DOOR_Z, DOOR_HALF_WIDTH);
    const resolved = resolveMove(camera.position.x, camera.position.z, camera.position.x + dx, camera.position.z + dz, boxes);
    camera.position.x = resolved.x;
    camera.position.z = resolved.z;
    camera.position.y = FLOOR_Y + PLAYER_EYE_HEIGHT;

    if (entrancePhase === 'walking' && camera.position.z < DOOR_Z) {
      onCrossThreshold();
    }

    // Footsteps: cadence-based on actual elapsed time while moving, not
    // once per frame — silent when stationary or only looking around
    // (yaw/pitch input doesn't touch velocity, so speed is 0 either way).
    const speed = Math.hypot(velocity.current.x, velocity.current.z);
    if (speed > STEP_SPEED_THRESHOLD) {
      stepTimer.current += delta;
      if (stepTimer.current >= STEP_INTERVAL) {
        stepTimer.current = 0;
        playFootstep();
      }
    } else {
      stepTimer.current = 0;
    }

    if (interactPressed.current || touchInput.interact) {
      interactPressed.current = false;
      touchInput.interact = false;
      interactRef.current?.();
    }
  });

  return null;
}
