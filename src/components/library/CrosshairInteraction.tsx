import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { computeBookLayout, getBookWorldPosition } from '../../lib/bookLayout';
import { useBooks } from '../../hooks/useBooks';
import { DOOR_Z } from './Entrance';
import type { EntrancePhase } from '../../hooks/useEntrance';
import { PROJECT_ANCHORS } from '../../data/projectAnchors';

interface CrosshairInteractionProps {
  entrancePhase: EntrancePhase;
  onHoverBook: (id: string | null) => void;
  onSelectBook: (id: string) => void;
  /** Opening the door for the very first time (outside -> opening). */
  onOpenDoor: () => void;
  /** Toggling it open/closed afterward, once already inside. */
  onToggleDoor: () => void;
  onHoverDoor: (hovered: boolean) => void;
  onHoverPC: (hovered: boolean) => void;
  onOpenPC: () => void;
  onHoverLamp: (hovered: boolean) => void;
  onToggleLamp: () => void;
  /** Project object under the crosshair (TV, desk manuals, phone), or null. */
  onHoverAnchor: (id: string | null) => void;
  /** Opens that object's project details. */
  onOpenAnchor: (id: string) => void;
  interactRef: React.RefObject<(() => void) | null>;
}

const BOOK_INTERACT_RADIUS = 0.22;
const BOOK_MAX_DISTANCE = 2.4;
export const DOOR_INTERACT_POINT = new THREE.Vector3(0, -0.75, DOOR_Z);
const DOOR_INTERACT_RADIUS = 1.2;
const DOOR_MAX_DISTANCE = 5;
// Desk is at [1.9, -1.35, 1.9] rotated -0.35 rad; the laptop sits at local
// [0.12, 0.03, 0.05] within it. World position = desk pos + Y-rotated local
// offset (same rotation-then-translate math as bookLayout.ts's shelf).
export const PC_INTERACT_POINT = new THREE.Vector3(1.996, -1.2, 1.988);
const PC_INTERACT_RADIUS = 0.5;
const PC_MAX_DISTANCE = 3;
// Kept in sync with DoorLamp's LAMP_X/LAMP_Y/LAMP_Z in LibraryEnvironment.tsx
// — the switch plate is the actual target, mounted at local (0, -1.15, 0.01)
// inside that group, which is itself rotated 180° about Y (see DoorLamp's
// doc comment), flipping that local Z to a world offset of -0.01. Y is
// LAMP_Y (0.35) - 1.15 = -0.8, i.e. 1.25 m above the floor.
export const LAMP_INTERACT_POINT = new THREE.Vector3(1.75, -0.8, DOOR_Z - 0.245);
const LAMP_INTERACT_RADIUS = 0.4;
const LAMP_MAX_DISTANCE = 3.5;

type Target =
  | { kind: 'book'; id: string }
  | { kind: 'door' }
  | { kind: 'pc' }
  | { kind: 'lamp' }
  | { kind: 'anchor'; id: string }
  | null;

/**
 * Replaces the old per-mesh onPointerOver/onClick handlers, which relied on
 * the DOM cursor position — that freezes once Pointer Lock engages, so
 * hover/click on books and the door has to come from a crosshair raycast
 * (camera-forward) instead, the standard approach for first-person
 * interaction. Runs a lightweight "closest point to the view ray" test
 * rather than true mesh raycasting, since books don't expose live mesh refs.
 */
export function CrosshairInteraction({
  entrancePhase,
  onHoverBook,
  onSelectBook,
  onOpenDoor,
  onToggleDoor,
  onHoverDoor,
  onHoverPC,
  onOpenPC,
  onHoverLamp,
  onToggleLamp,
  onHoverAnchor,
  onOpenAnchor,
  interactRef,
}: CrosshairInteractionProps) {
  const { camera } = useThree();
  const { books } = useBooks();
  const currentTarget = useRef<Target>(null);
  const bookWorldPositions = useRef(new Map<string, THREE.Vector3>());

  // Rebuilt whenever the books list changes (not just once): books load
  // async from Firestore, so the static-fallback list this mounts with can
  // be swapped out shortly after — a one-time build would raycast against
  // stale positions/ids.
  useEffect(() => {
    const layout = computeBookLayout(books);
    const next = new Map<string, THREE.Vector3>();
    for (const slot of layout) {
      next.set(slot.id, new THREE.Vector3(...getBookWorldPosition(layout, slot.id)));
    }
    bookWorldPositions.current = next;
  }, [books]);

  useEffect(() => {
    interactRef.current = () => {
      const target = currentTarget.current;
      if (!target) return;
      if (target.kind === 'book') onSelectBook(target.id);
      else if (target.kind === 'pc') onOpenPC();
      else if (target.kind === 'lamp') onToggleLamp();
      else if (target.kind === 'anchor') onOpenAnchor(target.id);
      else if (entrancePhase === 'outside') onOpenDoor();
      else onToggleDoor();
    };
  }, [
    interactRef,
    onSelectBook,
    onOpenDoor,
    onToggleDoor,
    onOpenPC,
    onToggleLamp,
    onOpenAnchor,
    entrancePhase,
  ]);

  const forward = useRef(new THREE.Vector3());
  const toPoint = useRef(new THREE.Vector3());
  // Scratch vector for the closest-point test below. That test ran
  // origin.clone() once per candidate per frame — eight books plus the PC,
  // lamp and door, so roughly 660 throwaway Vector3s a second feeding the
  // garbage collector for no reason. The two refs above already exist for
  // exactly this; this is the third one they were missing.
  const closest = useRef(new THREE.Vector3());
  const tmpAnchor = useRef(new THREE.Vector3());

  useFrame(() => {
    camera.getWorldDirection(forward.current);
    const origin = camera.position;

    let best: Target = null;
    let bestDist = Infinity;

    if (entrancePhase === 'inside' || entrancePhase === 'walking') {
      for (const [id, point] of bookWorldPositions.current) {
        toPoint.current.copy(point).sub(origin);
        const t = toPoint.current.dot(forward.current);
        if (t <= 0 || t > BOOK_MAX_DISTANCE) continue;
        closest.current.copy(origin).addScaledVector(forward.current, t);
        const dist = closest.current.distanceTo(point);
        if (dist < BOOK_INTERACT_RADIUS && dist < bestDist) {
          bestDist = dist;
          best = { kind: 'book', id };
        }
      }

      toPoint.current.copy(PC_INTERACT_POINT).sub(origin);
      const pcT = toPoint.current.dot(forward.current);
      if (pcT > 0 && pcT <= PC_MAX_DISTANCE) {
        closest.current.copy(origin).addScaledVector(forward.current, pcT);
        const dist = closest.current.distanceTo(PC_INTERACT_POINT);
        if (dist < PC_INTERACT_RADIUS && dist < bestDist) {
          bestDist = dist;
          best = { kind: 'pc' };
        }
      }

      toPoint.current.copy(LAMP_INTERACT_POINT).sub(origin);
      const lampT = toPoint.current.dot(forward.current);
      if (lampT > 0 && lampT <= LAMP_MAX_DISTANCE) {
        closest.current.copy(origin).addScaledVector(forward.current, lampT);
        const dist = closest.current.distanceTo(LAMP_INTERACT_POINT);
        if (dist < LAMP_INTERACT_RADIUS && dist < bestDist) {
          bestDist = dist;
          best = { kind: 'lamp' };
        }
      }

      // Project objects. Same closest-point-to-the-view-ray test as
      // everything else, so when two targets overlap — the desk manuals
      // sit within half a metre of the laptop — whichever the crosshair
      // is actually nearer wins, rather than whichever was checked first.
      for (const anchor of PROJECT_ANCHORS) {
        toPoint.current.set(anchor.position[0], anchor.position[1], anchor.position[2]).sub(origin);
        const t = toPoint.current.dot(forward.current);
        if (t <= 0 || t > anchor.maxDistance) continue;
        closest.current.copy(origin).addScaledVector(forward.current, t);
        const dist = closest.current.distanceTo(
          tmpAnchor.current.set(anchor.position[0], anchor.position[1], anchor.position[2])
        );
        if (dist < anchor.radius && dist < bestDist) {
          bestDist = dist;
          best = { kind: 'anchor', id: anchor.id };
        }
      }

      // Door stays interactable after entry too — this is what makes it a
      // toggle (open/close) rather than a one-time entrance trigger.
      toPoint.current.copy(DOOR_INTERACT_POINT).sub(origin);
      const doorT = toPoint.current.dot(forward.current);
      if (doorT > 0 && doorT <= DOOR_MAX_DISTANCE) {
        closest.current.copy(origin).addScaledVector(forward.current, doorT);
        const dist = closest.current.distanceTo(DOOR_INTERACT_POINT);
        if (dist < DOOR_INTERACT_RADIUS && dist < bestDist) {
          bestDist = dist;
          best = { kind: 'door' };
        }
      }
    } else if (entrancePhase === 'outside') {
      toPoint.current.copy(DOOR_INTERACT_POINT).sub(origin);
      const t = toPoint.current.dot(forward.current);
      if (t > 0 && t <= DOOR_MAX_DISTANCE) {
        closest.current.copy(origin).addScaledVector(forward.current, t);
        const dist = closest.current.distanceTo(DOOR_INTERACT_POINT);
        if (dist < DOOR_INTERACT_RADIUS) best = { kind: 'door' };
      }
    }

    const prev = currentTarget.current;
    const changed =
      (prev?.kind ?? null) !== (best?.kind ?? null) ||
      (prev?.kind === 'book' && best?.kind === 'book' && prev.id !== best.id) ||
      (prev?.kind === 'anchor' && best?.kind === 'anchor' && prev.id !== best.id);

    if (changed) {
      currentTarget.current = best;
      onHoverBook(best?.kind === 'book' ? best.id : null);
      onHoverPC(best?.kind === 'pc');
      onHoverDoor(best?.kind === 'door');
      onHoverLamp(best?.kind === 'lamp');
      onHoverAnchor(best?.kind === 'anchor' ? best.id : null);
    }
  });

  return null;
}
