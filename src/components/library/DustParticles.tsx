import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WINDOW_X, WINDOW_W, BACK_WALL_Z } from '../../lib/roomLayout';

interface DustProps {
  count: number;
}

export function DustParticles({ count }: DustProps) {
  const points = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    // Only inside the window's light shaft, like dust caught in a sunbeam.
    // Spread through the middle of the room, the specks drifted in front
    // of the TV and the books and read as dead pixels.
    for (let i = 0; i < count; i++) {
      pos[i * 3] = WINDOW_X + (Math.random() - 0.5) * WINDOW_W * 0.8;
      pos[i * 3 + 1] = Math.random() * 3 - 1;
      pos[i * 3 + 2] = BACK_WALL_Z + 0.3 + Math.random() * 1.8;
      spd[i] = 0.0004 + Math.random() * 0.0009;
    }
    return { positions: pos, speeds: spd };
  }, [count]);

  useFrame((state) => {
    if (!points.current) return;
    const posAttr = points.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const y = posAttr.getY(i) + speeds[i];
      posAttr.setY(i, y > 2 ? -1 : y);
    }
    posAttr.needsUpdate = true;

    const mat = points.current.material as THREE.PointsMaterial;
    mat.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 0.55) * 0.07;
  });

  if (count === 0) return null;

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.017}
        sizeAttenuation
        color="#f2e3c4"
        transparent
        opacity={0.32}
        depthWrite={false}
      />
    </points>
  );
}
