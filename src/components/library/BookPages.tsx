import { useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';
import * as THREE from 'three';
import type { BookData } from '../../data/books';
import type { BookState } from '../../hooks/useBookInteraction';
import { getBookWorldPosition, computeBookLayout } from '../../lib/bookLayout';
import { useBooks } from '../../hooks/useBooks';
import { BookMesh, BOOK_DEPTH, BOOK_HEIGHT } from './BookMesh';
import { OpenBookSpread, TILT_X } from './OpenBookSpread';
import { GRAB_DURATION, CARRY_DURATION, OPEN_DURATION, CLOSE_DURATION } from '../../lib/bookAnimation';
import { playBookClose, playPageFlip, playRiffle } from '../../lib/sfx';

interface BookPagesProps {
  book: BookData | null;
  phase: BookState | null;
  reduced: boolean;
  quality: 'high' | 'medium' | 'low';
}

const READING_DISTANCE = 1.1;
const READING_Y_OFFSET = -0.15;
// The room behind the book darkens while it's being read: a black sheet
// this far behind the reading spot, faded up to this opacity.
const DIM_BEHIND = 0.45;
const DIM_OPACITY = 0.38;

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

  return { position, rotationY: yaw + Math.PI, yaw };
}

export function BookPages({ book, phase, reduced, quality }: BookPagesProps) {
  const { camera } = useThree();
  const { books } = useBooks();
  const bookLayout = useMemo(() => computeBookLayout(books), [books]);
  const group = useRef<THREE.Group>(null);
  const closedWrap = useRef<THREE.Group>(null);
  const openWrap = useRef<THREE.Group>(null);
  const dim = useRef<THREE.Mesh>(null);
  const openAmount = useRef({ value: 0 });
  const coverAmount = useRef({ value: 0 });
  const riffleAmount = useRef({ value: 0 });
  const dimAmount = useRef({ value: 0 });
  const timeline = useRef<gsap.core.Timeline | null>(null);
  // Snapshotted once per grab, not tracked continuously — the book shouldn't
  // chase the player around if they keep walking after opening it.
  const readingTransform = useRef(computeReadingTransform(camera));

  const dimMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0, depthWrite: false, fog: false }),
    []
  );

  useLayoutEffect(() => {
    if (!book || !phase || !group.current || !closedWrap.current || !openWrap.current || !dim.current) return;
    const g = group.current;
    const closed = closedWrap.current;
    const open = openWrap.current;
    const dimMesh = dim.current;
    const [sx, sy, sz] = getBookWorldPosition(bookLayout, book.id);
    const baseRotY = bookLayout.find((s) => s.id === book.id)?.rotationY ?? 0;
    const halfHeight = (BOOK_HEIGHT * book.height) / 2;

    const swap = (showOpen: boolean) => {
      closed.visible = !showOpen;
      open.visible = showOpen;
    };
    // Turns the closed book from its shelf pose (spine to the room) to face
    // the reader the way the shut spread does: a quarter turn so a cover
    // faces forward with the spine on the left, tilted back like the spread,
    // and shifted over the spread's right half, where its shut cover lies.
    // Handing over from one to the other is then a swap of matching shapes.
    const present = { rx: TILT_X, ry: -Math.PI / 2, x: BOOK_DEPTH / 2, z: 0.01 };
    const applyDim = () => {
      dimMat.opacity = dimAmount.current.value * DIM_OPACITY;
      dimMesh.visible = dimAmount.current.value > 0.001;
    };

    // 'opened' arrives on a timer (useBookInteraction), and on a slow
    // device the animation can still be running then. Killing it left the
    // book frozen half-open behind the panel; finishing it lands every
    // part where it belongs.
    if (phase === 'opened') {
      timeline.current?.progress(1);
      return;
    }

    timeline.current?.kill();

    if (phase === 'opening') {
      readingTransform.current = computeReadingTransform(camera);
      const { position: readPos, rotationY: readRotY, yaw } = readingTransform.current;
      dimMesh.position.set(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(DIM_BEHIND).add(readPos);
      dimMesh.rotation.set(0, readRotY, 0);

      if (reduced) {
        g.position.copy(readPos);
        g.rotation.set(0, readRotY, 0);
        swap(true);
        coverAmount.current.value = 1;
        riffleAmount.current.value = 1;
        openAmount.current.value = 1;
        dimAmount.current.value = 1;
        applyDim();
        playPageFlip();
        return;
      }

      g.position.set(sx, sy, sz);
      g.rotation.set(0, baseRotY, 0);
      closed.rotation.set(0, 0, 0);
      closed.position.set(0, 0, 0);
      swap(false);
      coverAmount.current.value = 0;
      riffleAmount.current.value = 0;
      openAmount.current.value = 0;
      dimAmount.current.value = 0;
      applyDim();

      const tl = gsap.timeline();
      timeline.current = tl;
      tl.call(playPageFlip, undefined, 0);

      // Grab, in two beats. Tip it out by the top of the spine, the way a
      // hand takes a book off a shelf: it pivots on its bottom edge, so the
      // centre comes forward by half the height times the tilt.
      const tip = 0.2;
      const tipEnd = GRAB_DURATION * 0.42;
      tl.to(g.rotation, { x: tip, duration: tipEnd, ease: 'power2.out' }, 0);
      tl.to(g.position, { z: sz + halfHeight * Math.sin(tip), duration: tipEnd, ease: 'power2.out' }, 0);
      // Then slide it off the shelf, levelling a little, turned in the hand.
      tl.to(g.position, { z: sz + 0.2, duration: GRAB_DURATION - tipEnd, ease: 'power2.inOut' }, tipEnd);
      tl.to(g.rotation, { x: 0.08, z: 0.12, duration: GRAB_DURATION - tipEnd, ease: 'power2.inOut' }, tipEnd);

      // Carry: arc it in to the reading spot in front of the player,
      // turning it on the way so it arrives cover first.
      const carryStart = GRAB_DURATION;
      const carry = { duration: CARRY_DURATION, ease: 'power2.inOut' };
      tl.to(g.position, { x: readPos.x, y: readPos.y, z: readPos.z, ...carry }, carryStart);
      tl.to(g.rotation, { x: 0, y: readRotY, z: 0, ...carry }, carryStart);
      tl.to(closed.rotation, { x: present.rx, y: present.ry, ...carry }, carryStart);
      tl.to(closed.position, { x: present.x, z: present.z, ...carry }, carryStart);
      tl.to(
        dimAmount.current,
        { value: 1, duration: 0.6, ease: 'power1.inOut', onUpdate: applyDim },
        carryStart + CARRY_DURATION * 0.4
      );

      // Open: the shut spread takes the closed book's place, the cover
      // swings over on its spine, a few pages riffle after it, and the
      // pages settle into their reading curve.
      const openStart = carryStart + CARRY_DURATION;
      tl.call(() => swap(true), undefined, openStart);
      tl.to(coverAmount.current, { value: 1, duration: 0.5, ease: 'power2.inOut' }, openStart);
      tl.call(() => playRiffle(), undefined, openStart + 0.3);
      tl.to(riffleAmount.current, { value: 1, duration: 0.5, ease: 'none' }, openStart + 0.28);
      tl.to(openAmount.current, { value: 1, duration: OPEN_DURATION - 0.65, ease: 'power2.out' }, openStart + 0.65);
      return;
    }

    if (phase === 'closing') {
      if (reduced) {
        g.position.set(sx, sy, sz);
        g.rotation.set(0, baseRotY, 0);
        closed.rotation.set(0, 0, 0);
        closed.position.set(0, 0, 0);
        swap(false);
        dimAmount.current.value = 0;
        applyDim();
        playBookClose();
        return;
      }

      const tl = gsap.timeline();
      timeline.current = tl;

      // Total real time must not exceed CLOSE_DURATION — useBookInteraction
      // unmounts this on that exact schedule, so nothing may still be tweening after it.
      riffleAmount.current.value = 1;
      tl.to(openAmount.current, { value: 0, duration: 0.15, ease: 'power2.in' }, 0);
      tl.to(coverAmount.current, { value: 0, duration: 0.38, ease: 'power2.inOut' }, 0.06);
      tl.call(() => swap(false), undefined, 0.44);
      tl.to(dimAmount.current, { value: 0, duration: 0.5, ease: 'power1.inOut', onUpdate: applyDim }, 0);

      // Fly back to just in front of its slot, turning spine-out again...
      const flyStart = 0.4;
      const seat = CLOSE_DURATION - 0.22;
      const fly = { duration: seat - flyStart, ease: 'power3.inOut' };
      tl.to(g.position, { x: sx, y: sy, z: sz + 0.06, ...fly }, flyStart);
      tl.to(g.rotation, { x: 0, y: baseRotY, z: 0, ...fly }, flyStart);
      tl.to(closed.rotation, { x: 0, y: 0, ...fly }, flyStart);
      tl.to(closed.position, { x: 0, z: 0, ...fly }, flyStart);
      // ...then push it home, with a soft thump as it seats.
      tl.to(g.position, { z: sz, duration: 0.18, ease: 'power3.out' }, seat);
      tl.call(playBookClose, undefined, seat + 0.1);
    }
  }, [book, phase, reduced, camera, bookLayout, dimMat]);

  if (!book || !phase) return null;

  return (
    <>
      <group ref={group}>
        <group ref={closedWrap}>
          <BookMesh data={book} quality={quality} />
        </group>
        <group ref={openWrap} visible={false}>
          <OpenBookSpread
            data={book}
            quality={quality}
            openRef={openAmount}
            coverRef={coverAmount}
            riffleRef={riffleAmount}
          />
        </group>
        <pointLight position={[0, 0.15, 0.35]} intensity={0.55} color="#f9efd6" distance={2.2} />
      </group>
      <mesh ref={dim} visible={false} material={dimMat}>
        <planeGeometry args={[8, 5]} />
      </mesh>
    </>
  );
}
