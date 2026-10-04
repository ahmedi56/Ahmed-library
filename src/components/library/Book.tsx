import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BookData } from '../../data/books';
import type { BookState } from '../../hooks/useBookInteraction';
import { BookMesh } from './BookMesh';

export { BOOK_WIDTH, BOOK_HEIGHT, BOOK_DEPTH } from './BookMesh';

interface BookProps {
  data: BookData;
  position: [number, number, number];
  rotationY: number;
  state: BookState;
  reduced: boolean;
  quality?: 'high' | 'medium' | 'low';
}

const ACTIVE_STATES: BookState[] = ['selected', 'opening', 'opened', 'closing'];

/**
 * Purely state-driven now — hover/select used to come from onPointerOver/
 * onClick on this mesh, but that relies on the DOM cursor position, which
 * freezes once Pointer Lock engages. CrosshairInteraction.tsx now owns
 * hover/select detection (a camera-forward raycast) and drives `state` from
 * outside; this component just animates in response to it.
 */
export function Book({ data, position, rotationY, state, reduced, quality = 'high' }: BookProps) {
  const group = useRef<THREE.Group>(null);
  const isActive = ACTIVE_STATES.includes(state);

  const targetPullOut = state === 'hovered' ? 0.045 : 0;
  const targetTilt = state === 'hovered' && !reduced ? -0.1 : 0;

  useFrame((_, delta) => {
    if (!group.current) return;
    const g = group.current;
    const lerpSpeed = reduced ? 1 : Math.min(1, delta * 7);

    g.position.z = THREE.MathUtils.lerp(g.position.z, targetPullOut, lerpSpeed);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, rotationY + targetTilt, lerpSpeed);
  });

  // The moment a book is grabbed, the shelf copy disappears and BookPages
  // takes over the exact same transform — a single continuous handoff
  // instead of a cross-fade that would read as popping/teleporting.
  if (isActive) return null;

  return (
    <group ref={group} position={position}>
      <BookMesh data={data} quality={quality} />
    </group>
  );
}
