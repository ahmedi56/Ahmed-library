import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import * as THREE from 'three';
import type { EntrancePhase } from '../../hooks/useEntrance';
import { DOOR_OPEN_DURATION } from '../../hooks/useEntrance';

interface EntranceProps {
  phase: EntrancePhase;
  /** Whether the door leaf should be swung open — true for the whole entry
   *  sequence once it starts, then toggle-able afterward (see Home.tsx). */
  open: boolean;
  reduced: boolean;
  quality: 'high' | 'medium' | 'low';
}

export const DOOR_Z = 5.3;
// Frame posts sit at x = ±0.95 (width 0.2 each), so the clear opening
// between their inner edges is -0.85 to 0.85 (1.7 wide). The door leaf
// spans HINGE_X to HINGE_X + DOOR_WIDTH; the old values (-0.75, 1.5) left
// a 0.10-unit gap on BOTH sides when closed — a visible hole straight
// through to the void behind. These leave a small, realistic 0.02 gap
// instead: leaf spans -0.83 to 0.83.
const DOOR_WIDTH = 1.66;
const DOOR_HEIGHT = 2.6;
const DOOR_OPEN_ANGLE = -2.05;
const HINGE_X = -0.83;

/**
 * Opening is now triggered via CrosshairInteraction + CameraRig's interact
 * key (click/E while looking at the door), not a DOM onClick on the door
 * mesh — same reasoning as Book.tsx: DOM pointer events don't track where
 * you're looking once Pointer Lock engages.
 */
export function Entrance({ phase, open, reduced, quality }: EntranceProps) {
  const hinge = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);

  // Walnut, but two stops up from the '#3f2f22' this used to be. That
  // colour is ~0.05 linear reflectance — near-black — and the door is the
  // single object the whole opening shot is composed around, lit by one
  // porch light against a blue-hour exterior. There is no lighting fix for
  // it: the wall it sits in is '#efe7d8' (~0.85 reflectance), so any porch
  // light strong enough to make a 0.05-albedo leaf read at all blows the
  // surrounding wall out to white first. Raising the leaf's own
  // reflectance is the smaller change, and it keeps the warm-walnut read
  // the rest of the room is built on — the panels, brass handle and kick
  // plate are legible now instead of a black rectangle.
  const woodMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#6a4f34',
        roughness: 0.55,
        metalness: 0.05,
      }),
    []
  );

  const frameMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e8ddc8',
        roughness: 0.75,
      }),
    []
  );

  const brassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#c9a05c',
        metalness: 0.9,
        roughness: 0.25,
      }),
    []
  );

  useEffect(() => {
    if (!hinge.current) return;

    // Before the entry sequence starts, the door is force-closed regardless
    // of `open` — there's nothing to toggle yet from outside.
    if (phase === 'outside') {
      hinge.current.rotation.y = 0;
      return;
    }

    const targetAngle = open ? DOOR_OPEN_ANGLE : 0;

    if (reduced) {
      hinge.current.rotation.y = targetAngle;
      return;
    }

    gsap.to(hinge.current.rotation, {
      y: targetAngle,
      duration: DOOR_OPEN_DURATION,
      ease: 'power3.inOut',
    });
  }, [phase, open, reduced]);

  useFrame((_, delta) => {
    if (!glow.current) return;
    const mat = glow.current.material as THREE.MeshStandardMaterial;
    const target = phase === 'outside' ? 1 : 0;
    mat.emissiveIntensity = THREE.MathUtils.lerp(
      mat.emissiveIntensity,
      target,
      Math.min(1, delta * 3)
    );
  });

  return (
    <group position={[0, -2.05, DOOR_Z]}>
      {/* Threshold step */}
      {quality !== 'low' && (
        <mesh position={[0, 0.04, 0.25]} receiveShadow castShadow>
          <boxGeometry args={[2.2, 0.08, 0.5]} />
          <meshStandardMaterial color="#8b7a5e" roughness={0.9} />
        </mesh>
      )}

      {/* Door frame - left, right, top */}
      <mesh position={[-0.95, DOOR_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[0.2, DOOR_HEIGHT + 0.2, 0.28]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      <mesh position={[0.95, DOOR_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[0.2, DOOR_HEIGHT + 0.2, 0.28]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      <mesh position={[0, DOOR_HEIGHT + 0.1, 0]} castShadow>
        <boxGeometry args={[2.1, 0.2, 0.28]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      {/* Arched fanlight header */}
      <mesh position={[0, DOOR_HEIGHT + 0.1, 0.14]} castShadow>
        <circleGeometry args={[1.05, 24, 0, Math.PI]} />
        <primitive object={frameMat} attach="material" />
      </mesh>

      {/* Warm glow bleeding from under the door */}
      <mesh ref={glow} position={[0, 0.02, 0.16]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.35, 0.14]} />
        <meshStandardMaterial
          color="#f2c87a"
          emissive="#f2c87a"
          emissiveIntensity={0}
          roughness={1}
        />
      </mesh>

      {/* Hinge pivot + door leaf */}
      <group ref={hinge} position={[HINGE_X, 0, 0]}>
        <group position={[DOOR_WIDTH / 2, DOOR_HEIGHT / 2, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[DOOR_WIDTH, DOOR_HEIGHT, 0.09]} />
            <primitive object={woodMat} attach="material" />
          </mesh>
          {/* Panel grooves */}
          <mesh position={[0, DOOR_HEIGHT * 0.22, 0.046]}>
            <boxGeometry args={[DOOR_WIDTH * 0.62, DOOR_HEIGHT * 0.32, 0.015]} />
            <meshStandardMaterial color="#543d27" roughness={0.7} />
          </mesh>
          <mesh position={[0, -DOOR_HEIGHT * 0.22, 0.046]}>
            <boxGeometry args={[DOOR_WIDTH * 0.62, DOOR_HEIGHT * 0.32, 0.015]} />
            <meshStandardMaterial color="#543d27" roughness={0.7} />
          </mesh>
          {/* Brass handle */}
          <mesh position={[DOOR_WIDTH / 2 - 0.18, 0, 0.09]} castShadow>
            <sphereGeometry args={[0.045, 16, 16]} />
            <primitive object={brassMat} attach="material" />
          </mesh>
          <mesh
            position={[DOOR_WIDTH / 2 - 0.18, 0, 0.05]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.012, 0.012, 0.06, 10]} />
            <primitive object={brassMat} attach="material" />
          </mesh>
          {/* Brass kick plate */}
          <mesh position={[0, -DOOR_HEIGHT / 2 + 0.16, 0.048]}>
            <boxGeometry args={[DOOR_WIDTH * 0.86, 0.22, 0.012]} />
            <primitive object={brassMat} attach="material" />
          </mesh>
        </group>
      </group>
    </group>
  );
}
