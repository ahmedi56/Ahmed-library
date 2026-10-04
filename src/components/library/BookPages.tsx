import { useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';
import * as THREE from 'three';
import type { BookData } from '../../data/books';
import type { BookState } from '../../hooks/useBookInteraction';
import { getBookWorldPosition, computeBookLayout } from '../../lib/bookLayout';
import { useBooks } from '../../hooks/useBooks';
import { BookMesh } from './BookMesh';
import { OpenBookSpread } from './OpenBookSpread';
import { GRAB_DURATION, CARRY_DURATION, OPEN_DURATION, CLOSE_DURATION } from '../../lib/bookAnimation';

interface BookPagesProps {
  book: BookData | null;
  phase: BookState | null;
  reduced: boolean;
  quality: 'high' | 'medium' | 'low';
}

const READING_DISTANCE = 1.1;
const READING_Y_OFFSET = -0.15;
const HIDDEN_SCALE = 0.001;

/**
 * There's no more fixed "reading" camera stage to carry the book to — the
 * free-roam camera never auto-moves. Instead the book flies to a point in
 * front of wherever the player is standing/looking *at the moment they grab
 * it* (yaw only, so a book grabbed while looking up/down still presents
 * level and readable rather than tilted).
 */
function computeReadingTransform(camera: THREE.Camera) {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const yaw = Math.atan2(dir.x, dir.z);

  const position = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
    .multiplyScalar(READING_DISTANCE)
    .add(camera.position);
  position.y = camera.position.y + READING_Y_OFFSET;

  return { position, rotationY: yaw + Math.PI };
}

export function BookPages({ book, phase, reduced, quality }: BookPagesProps) {
  const { camera } = useThree();
  const { books } = useBooks();
  const bookLayout = useMemo(() => computeBookLayout(books), [books]);
  const group = useRef<THREE.Group>(null);
  const closedWrap = useRef<THREE.Group>(null);
  const openWrap = useRef<THREE.Group>(null);
  const openAmount = useRef({ value: 0 });
  const timeline = useRef<gsap.core.Timeline | null>(null);
  // Snapshotted once per grab, not tracked continuously — the book shouldn't
  // chase the player around if they keep walking after opening it.
  const readingTransform = useRef(computeReadingTransform(camera));

  useLayoutEffect(() => {
    if (!book || !phase || !group.current || !closedWrap.current || !openWrap.current) return;
    const g = group.current;
    const [sx, sy, sz] = getBookWorldPosition(bookLayout, book.id);
    const baseRotY = bookLayout.find((s) => s.id === book.id)?.rotationY ?? 0;

    timeline.current?.kill();

    if (phase === 'opening') {
      readingTransform.current = computeReadingTransform(camera);
      const { position: readPos, rotationY: readRotY } = readingTransform.current;

      if (reduced) {
        g.position.copy(readPos);
        g.rotation.set(0, readRotY, 0);
        closedWrap.current.scale.setScalar(HIDDEN_SCALE);
        openWrap.current.scale.setScalar(1);
        openAmount.current.value = 1;
        return;
      }

      g.position.set(sx, sy, sz);
      g.rotation.set(0, baseRotY, 0);
      closedWrap.current.scale.setScalar(1);
      openWrap.current.scale.setScalar(HIDDEN_SCALE);
      openAmount.current.value = 0;

      const tl = gsap.timeline();
      timeline.current = tl;

      // Grab: pull the book off the shelf toward the room, tilting like a hand taking it.
      tl.to(g.position, { z: sz + 0.16, duration: GRAB_DURATION, ease: 'power2.out' }, 0);
      tl.to(g.rotation, { z: 0.16, x: -0.09, duration: GRAB_DURATION, ease: 'power2.out' }, 0);

      // Carry: arc it in to the reading spot in front of the player, leveling out.
      const carryStart = GRAB_DURATION;
      tl.to(
        g.position,
        { x: readPos.x, y: readPos.y, z: readPos.z, duration: CARRY_DURATION, ease: 'power2.inOut' },
        carryStart
      );
      tl.to(g.rotation, { x: 0, y: readRotY, z: 0, duration: CARRY_DURATION, ease: 'power2.inOut' }, carryStart);

      // Open: the closed book eases down as the two-page spread eases up in the same
      // spot, over the same window — one continuous transformation, not a pop-swap.
      const openStart = carryStart + CARRY_DURATION;
      const crossfadeDuration = 0.4;
      tl.to(
        closedWrap.current.scale,
        { x: HIDDEN_SCALE, y: HIDDEN_SCALE, z: HIDDEN_SCALE, duration: crossfadeDuration, ease: 'power2.inOut' },
        openStart
      );
      tl.to(
        openWrap.current.scale,
        { x: 1, y: 1, z: 1, duration: crossfadeDuration, ease: 'power2.inOut' },
        openStart
      );
      tl.to(openAmount.current, { value: 1, duration: OPEN_DURATION, ease: 'power2.out' }, openStart);
      return;
    }

    if (phase === 'closing') {
      if (reduced) {
        g.position.set(sx, sy, sz);
        g.rotation.set(0, baseRotY, 0);
        closedWrap.current.scale.setScalar(1);
        openWrap.current.scale.setScalar(HIDDEN_SCALE);
        openAmount.current.value = 0;
        return;
      }

      const tl = gsap.timeline();
      timeline.current = tl;

      // Total real time must not exceed CLOSE_DURATION — useBookInteraction
      // unmounts this on that exact schedule, so nothing may still be tweening after it.
      tl.to(openAmount.current, { value: 0, duration: CLOSE_DURATION * 0.45, ease: 'power2.inOut' }, 0);
      tl.to(openWrap.current.scale, { x: HIDDEN_SCALE, y: HIDDEN_SCALE, z: HIDDEN_SCALE, duration: 0.4, ease: 'power2.inOut' }, 0);
      tl.to(closedWrap.current.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.inOut' }, 0);
      tl.to(g.position, { x: sx, y: sy, z: sz, duration: CLOSE_DURATION, ease: 'power3.inOut' }, 0);
      tl.to(g.rotation, { x: 0, y: baseRotY, z: 0, duration: CLOSE_DURATION, ease: 'power3.inOut' }, 0);
    }
  }, [book, phase, reduced, camera, bookLayout]);

  if (!book || !phase) return null;

  return (
    <group ref={group}>
      <group ref={closedWrap}>
        <BookMesh data={book} quality={quality} />
      </group>
      <group ref={openWrap} scale={HIDDEN_SCALE}>
        <OpenBookSpread data={book} quality={quality} openRef={openAmount} />
      </group>
      <pointLight position={[0, 0.15, 0.35]} intensity={0.55} color="#f9efd6" distance={2.2} />
    </group>
  );
}
