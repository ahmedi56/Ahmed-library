import { useMemo } from 'react';
import * as THREE from 'three';
import { Book } from './Book';
import { useBooks } from '../../hooks/useBooks';
import { getWoodTexture } from '../../lib/textures';
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
} from '../../lib/bookLayout';
import type { BookState } from '../../hooks/useBookInteraction';

interface BookshelfProps {
  stateFor: (id: string) => BookState;
  reduced: boolean;
  quality?: 'high' | 'medium' | 'low';
}

export function Bookshelf({ stateFor, reduced, quality = 'high' }: BookshelfProps) {
  const { books } = useBooks();
  const bookLayout = useMemo(() => computeBookLayout(books), [books]);
  const frameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2c2114',
        map: quality === 'low' ? null : getWoodTexture('shelf', { base: '#2c2114', grain: '#150f09', repeat: [3, 1] }),
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
        color: quality === 'low' ? '#76593c' : '#ffffff',
        map: quality === 'low' ? null : getWoodTexture('shelfBack3', { base: '#76593c', grain: '#5a4129', repeat: [3, 2] }),
        emissive: '#3d2a17',
        emissiveIntensity: 0.45,
        roughness: 0.8,
      }),
    [quality]
  );

  const brassMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c9a05c', metalness: 0.85, roughness: 0.22 }),
    []
  );

  const caseCenterY = SHELF_BOTTOM + CASE_HEIGHT / 2;
  const postX = CASE_WIDTH / 2 - 0.03;
  const caseTopY = SHELF_BOTTOM + CASE_HEIGHT;

  return (
    <group position={[SHELF_GROUP_OFFSET_X, 0, SHELF_GROUP_OFFSET_Z]} rotation={[0, SHELF_GROUP_ROTATION_Y, 0]}>
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
    </group>
  );
}

