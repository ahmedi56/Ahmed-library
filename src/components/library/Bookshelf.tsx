import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Book } from './Book';
import { BookMesh } from './BookMesh';
import { useBooks } from '../../hooks/useBooks';
import { getNicheGlowTexture, getWoodTexture } from '../../lib/textures';
import {
  computeBookLayout,
  SHELF_BOTTOM,
  SHELF_BOARD_THICKNESS,
  CASE_WIDTH,
  CASE_HEIGHT,
  CASE_DEPTH,
  SHELF_GROUP_OFFSET_X,
  SHELF_GROUP_OFFSET_Z,
  SHELF_GROUP_ROTATION_Y,
  SHELF_SURFACE_Y,
  UPPER_SHELF_Y,
  computeShelfDecor,
  SECRET_BOOK_HEIGHT,
  SECRET_BOOK_LOCAL_X,
} from '../../lib/bookLayout';
import type { BookData } from '../../data/books';
import type { BookState } from '../../hooks/useBookInteraction';
import type { FillerSlot } from '../../lib/bookLayout';

interface BookshelfProps {
  stateFor: (id: string) => BookState;
  reduced: boolean;
  quality?: 'high' | 'medium' | 'low';
  /** Everything in the room found: the secret book glows (lib/secretRoom.ts). */
  secretUnlocked?: boolean;
  /** The crosshair or cursor is on the secret book. */
  secretHovered?: boolean;
  /** Pulled: the book tips like a lever and the bookcase swings open. */
  secretOpen?: boolean;
}

// How far the bookcase swings open on its hinge (the right-hand back
// edge), in radians. Enough to show the warm light behind it without the
// free end sweeping into someone standing at the shelf.
const SWING_OPEN = 0.4;

export function Bookshelf({
  stateFor,
  reduced,
  quality = 'high',
  secretUnlocked = false,
  secretHovered = false,
  secretOpen = false,
}: BookshelfProps) {
  const hinge = useRef<THREE.Group>(null);
  const secretBook = useRef<THREE.Group>(null);
  const glowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffc87a', transparent: true, opacity: 0, toneMapped: false }),
    []
  );
  // The lever pull first, then the case: the book tips at once, the case
  // follows a beat later, slowly, like something heavy on an old hinge.
  const openedAt = useRef<number | null>(null);
  useFrame(({ clock }, delta) => {
    if (secretOpen && openedAt.current === null) openedAt.current = clock.elapsedTime;
    if (!secretOpen) openedAt.current = null;
    const since = openedAt.current === null ? 0 : clock.elapsedTime - openedAt.current;
    const k = reduced ? 1 : Math.min(1, delta * 1.6);
    if (hinge.current) {
      const target = secretOpen && (reduced || since > 0.45) ? SWING_OPEN : 0;
      // Closing happens behind the fade on the way back up: snap it.
      hinge.current.rotation.y = secretOpen ? THREE.MathUtils.lerp(hinge.current.rotation.y, target, k) : 0;
      glowMat.opacity = Math.min(1, hinge.current.rotation.y / SWING_OPEN);
    }
    if (secretBook.current) {
      const tip = secretOpen ? 0.32 : secretHovered ? 0.06 : 0;
      secretBook.current.rotation.x = THREE.MathUtils.lerp(secretBook.current.rotation.x, tip, reduced ? 1 : Math.min(1, delta * 8));
    }
  });
  const { books } = useBooks();
  const bookLayout = useMemo(() => computeBookLayout(books), [books]);
  const frameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        // Walnut, not near-black: the near-black frame read as a dark hole
        // in the wall around the lit back.
        color: quality === 'low' ? '#5a3d24' : '#ffffff',
        map: quality === 'low' ? null : getWoodTexture('shelfWalnut', { base: '#5a3d24', grain: '#3b2716', repeat: [3, 1] }),
        // A touch of self-light so the inner faces of the posts, which the
        // mantel keeps in shadow, read as wood rather than black.
        emissive: '#2a1a0d',
        emissiveIntensity: 0.6,
        roughness: 0.55,
        metalness: 0.12,
      }),
    [quality]
  );

  const backMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        // A lighter, warmer back than the frame, softly lit from within like
        // a display shelf, so the dark spines read as silhouettes against
        // it. It was near-black and sat in the mantel's shadow, and the
        // books — the site's main navigation — disappeared into it.
        // (The colour multiplies the texture, so it stays neutral and the
        // texture carries the wood tone.) Emissive, not a light: free.
        // The first pass (tan #8a6a48 + strong orange emissive) overshot: the
        // whole back glowed flat orange like a lit display box. A mid walnut
        // with a faint glow still separates the spines without the glare.
        // Light oak, the "warm lit niche" look: the section books are dark
        // cloth with gold lettering, so they read as silhouettes against it.
        // The mid-walnut back before this still sank into shadow and the
        // shelf looked like a dark box with eight specks in it. The glow
        // comes from the light strip under the top board, not from the
        // back itself (a glowing back looked like a flat orange display box).
        color: quality === 'low' ? '#c49a6c' : '#ffffff',
        map: quality === 'low' ? null : getWoodTexture('shelfOak', { base: '#c49a6c', grain: '#a57c4f', repeat: [3, 2] }),
        // Lit from the strip above: brightest under the top board, fading
        // toward the bottom row. A gradient emissive map fakes that falloff
        // for free; a real light in the niche would cost a light per pixel.
        emissive: '#e0b07a',
        emissiveMap: getNicheGlowTexture((UPPER_SHELF_Y - SHELF_BOTTOM) / CASE_HEIGHT),
        emissiveIntensity: 0.55,
        roughness: 0.8,
      }),
    [quality]
  );

  const brassMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c9a05c', metalness: 0.85, roughness: 0.22 }),
    []
  );

  // Warm strip light under the top board. Emissive, not a real light: it
  // costs nothing, and the fill comes from the oak back being light.
  const stripMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffe0a6', toneMapped: false }),
    []
  );

  const decor = useMemo(() => computeShelfDecor(bookLayout), [bookLayout]);

  const caseCenterY = SHELF_BOTTOM + CASE_HEIGHT / 2;
  const postX = CASE_WIDTH / 2 - 0.03;
  const caseTopY = SHELF_BOTTOM + CASE_HEIGHT;

  return (
    <group position={[SHELF_GROUP_OFFSET_X, 0, SHELF_GROUP_OFFSET_Z]} rotation={[0, SHELF_GROUP_ROTATION_Y, 0]}>
      {/* Warm light from the passage behind, seen as the case swings open */}
      {/* Wider than the case on the free (left) side, so some spills past
          its swung-out edge instead of staying hidden behind it. */}
      <mesh position={[-0.35, caseCenterY, -CASE_DEPTH / 2 - 0.012]} material={glowMat}>
        <planeGeometry args={[CASE_WIDTH + 0.6, CASE_HEIGHT + 0.1]} />
      </mesh>
      {/* The hinge: the right-hand back edge of the case */}
      <group ref={hinge} position={[CASE_WIDTH / 2, 0, -CASE_DEPTH / 2]}>
      <group position={[-CASE_WIDTH / 2, 0, CASE_DEPTH / 2]}>
      {/* Shelf frame */}
      <mesh position={[0, SHELF_BOTTOM, 0]} receiveShadow castShadow material={frameMat}>
        <boxGeometry args={[CASE_WIDTH, SHELF_BOARD_THICKNESS, CASE_DEPTH]} />
      </mesh>
      <mesh position={[0, caseTopY, 0]} receiveShadow castShadow material={frameMat}>
        <boxGeometry args={[CASE_WIDTH, SHELF_BOARD_THICKNESS, CASE_DEPTH]} />
      </mesh>
      <mesh position={[0, caseCenterY, -CASE_DEPTH / 2]} receiveShadow material={backMat}>
        <boxGeometry args={[CASE_WIDTH, CASE_HEIGHT, 0.03]} />
      </mesh>
      <mesh position={[-postX, caseCenterY, 0]} receiveShadow castShadow material={frameMat}>
        <boxGeometry args={[0.06, CASE_HEIGHT, CASE_DEPTH]} />
      </mesh>
      <mesh position={[postX, caseCenterY, 0]} receiveShadow castShadow material={frameMat}>
        <boxGeometry args={[0.06, CASE_HEIGHT, CASE_DEPTH]} />
      </mesh>
      {/* Brass trim line */}
      <mesh position={[0, SHELF_BOTTOM + 0.05, CASE_DEPTH / 2]} material={brassMat}>
        <boxGeometry args={[CASE_WIDTH - 0.1, 0.012, 0.012]} />
      </mesh>

      <mesh position={[0, caseTopY - SHELF_BOARD_THICKNESS / 2 - 0.008, CASE_DEPTH / 2 - 0.05]} material={stripMat}>
        <boxGeometry args={[CASE_WIDTH - 0.16, 0.012, 0.02]} />
      </mesh>

      <mesh position={[0, UPPER_SHELF_Y, 0]} receiveShadow castShadow material={frameMat}>
        <boxGeometry args={[CASE_WIDTH - 0.12, SHELF_BOARD_THICKNESS, CASE_DEPTH - 0.03]} />
      </mesh>
      {/* A second strip under the middle board, for the section books' row. */}
      <mesh position={[0, UPPER_SHELF_Y - SHELF_BOARD_THICKNESS / 2 - 0.008, CASE_DEPTH / 2 - 0.06]} material={stripMat}>
        <boxGeometry args={[CASE_WIDTH - 0.2, 0.012, 0.02]} />
      </mesh>

      <FillerBooks slots={decor.fillers} />
      <Bookend x={decor.bookendX} material={brassMat} />

      {bookLayout.map(({ id, position, rotationY }) => {
        const book = books.find((b) => b.id === id);
        if (!book) return null;
        return (
          <Book
            key={id}
            data={book}
            position={position}
            rotationY={rotationY}
            state={stateFor(id)}
            reduced={reduced}
            quality={quality}
          />
        );
      })}

      {/* The secret book: no title, a little dusty until the room is found */}
      <group position={[SECRET_BOOK_LOCAL_X, SHELF_SURFACE_Y, 0]}>
        <group ref={secretBook}>
          <group position={[0, (0.26 * SECRET_BOOK_HEIGHT) / 2, 0]}>
            <BookMesh
              data={secretUnlocked ? SECRET_BOOK_UNLOCKED : SECRET_BOOK_LOCKED}
              quality={quality}
              showLabel={false}
              glow={secretUnlocked}
            />
          </group>
        </group>
      </group>
      </group>
      </group>
    </group>
  );
}

const SECRET_BOOK_BASE = {
  id: 'secret',
  category: 'about',
  title: '',
  subtitle: '',
  spineLabel: '',
  description: '',
  status: 'ready',
  thickness: 1.25,
  height: SECRET_BOOK_HEIGHT,
} as const;
// Shelf books are all BookData; this one never appears in a list.
const SECRET_BOOK_LOCKED = { ...SECRET_BOOK_BASE, coverColor: '#5e5850', accentColor: '#7a7266' } as BookData;
const SECRET_BOOK_UNLOCKED = { ...SECRET_BOOK_BASE, coverColor: '#3a2416', accentColor: '#e0b45c' } as BookData;


const FILLER_COLORS = ['#d9c9a8', '#a8b59a', '#c98f6b', '#8fa3b0', '#e4d8bf', '#b9a07a', '#9c7b6a'];

/**
 * The shelf's quiet extras: plain books in pale linen and clay tones that
 * fill the gaps between the eight section books, so the shelf looks lived in
 * rather than sparse. Pale against dark, and no lettering, so the section
 * books still stand out as the ones to pick. One instanced mesh: a single
 * draw call however many there are. Not interactive — the crosshair and the
 * cursor only test the section books' slots.
 */
function FillerBooks({ slots }: { slots: FillerSlot[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  // No cover-grain map: it darkens whatever it multiplies, and these are
  // meant to stay pale so the dark section books stand out among them.
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.75 }), []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const color = new THREE.Color();
    slots.forEach((slot, i) => {
      rotation.setFromEuler(new THREE.Euler(0, 0, slot.lean));
      matrix.compose(
        new THREE.Vector3(slot.x, slot.y, slot.z),
        rotation,
        new THREE.Vector3(slot.width, slot.height, slot.depth)
      );
      m.setMatrixAt(i, matrix);
      m.setColorAt(i, color.set(FILLER_COLORS[slot.colorIndex % FILLER_COLORS.length]));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [slots]);

  return (
    <instancedMesh
      // Keyed on the count: an instanced mesh's capacity is fixed at creation.
      key={slots.length}
      ref={mesh}
      args={[undefined, undefined, slots.length]}
      material={material}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

/** A brass L-bookend propping up the row's first stack. */
function Bookend({ x, material }: { x: number; material: THREE.Material }) {
  return (
    <group position={[x, SHELF_SURFACE_Y, 0]}>
      <mesh position={[0, 0.09, 0]} material={material} castShadow>
        <boxGeometry args={[0.008, 0.18, 0.12]} />
      </mesh>
      <mesh position={[0.04, 0.004, 0]} material={material}>
        <boxGeometry args={[0.08, 0.008, 0.12]} />
      </mesh>
    </group>
  );
}
