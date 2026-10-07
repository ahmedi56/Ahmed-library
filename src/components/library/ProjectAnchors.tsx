import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PROJECT_ANCHORS } from '../../data/projectAnchors';

interface ProjectAnchorsProps {
  /** Anchor the crosshair is on right now, or null. */
  targeted: string | null;
  /** Anchors already found, which stop advertising themselves. */
  discovered: ReadonlySet<string>;
  /** True once any project object has been found even once. */
  anyFound: boolean;
  /** Only alive once the visitor is actually in the room. */
  active: boolean;
}

const IDLE_OPACITY = 0.22;
const FOUND_OPACITY = 0.0;
const TARGET_OPACITY = 0.75;

/**
 * The visual half of the project objects: a soft glow around the TV, the
 * desk manuals and the phone, which brightens and swells when the
 * crosshair lands on one.
 *
 * A ring around the object rather than a glow over it. The first attempt
 * used a filled additive sphere, which at arm's length from the phone
 * covered the phone, the nightstand and the photo frame behind it — a
 * highlight that hid the thing it was highlighting. A thin ring, turned
 * to face the camera every frame, circles the object at any distance and
 * from any angle while leaving it completely visible.
 *
 * It also needs no refs reaching into the objects themselves, so the TV,
 * the nightstand and the desk stay exactly as they were built, and one
 * ring reads the same on all three despite their very different shapes.
 *
 * Hinting is deliberately almost absent. Exactly one object carries a
 * faint idle ring, and only until the visitor has found their first
 * project object — enough to teach that objects in this room respond,
 * and nothing more. After that first discovery no object advertises
 * itself again: rings appear only under the crosshair, so the rest of
 * the room has to be genuinely explored rather than followed like a
 * trail of markers.
 */
export function ProjectAnchors({ targeted, discovered, anyFound, active }: ProjectAnchorsProps) {
  const group = useRef<THREE.Group>(null);

  const materials = useMemo(
    () =>
      PROJECT_ANCHORS.map(
        () =>
          new THREE.MeshBasicMaterial({
            color: '#f2c87a',
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
      ),
    []
  );

  useFrame((state, delta) => {
    if (!group.current) return;
    const camera = state.camera;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.06;
    const step = Math.min(1, delta * 6);

    group.current.children.forEach((child, i) => {
      const anchor = PROJECT_ANCHORS[i];
      const material = materials[i];
      if (!anchor || !material) return;
      if (anchor.glowRadius === 0) {
        child.visible = false;
        return;
      }

      const isTarget = targeted === anchor.id;
      // The single teaching hint: the first anchor in the list, shown only
      // while nothing at all has been discovered yet.
      const isTeachingHint = !anyFound && i === 0 && !discovered.has(anchor.id);
      const goal = !active ? 0 : isTarget ? TARGET_OPACITY : isTeachingHint ? IDLE_OPACITY : FOUND_OPACITY;

      // Eased rather than snapped, so looking away fades out instead of
      // blinking off.
      material.opacity = THREE.MathUtils.lerp(material.opacity, goal, step);
      child.visible = material.opacity > 0.005;

      const scaleGoal = isTarget ? pulse * 1.1 : 1;
      const s = THREE.MathUtils.lerp(child.scale.x, scaleGoal, step);
      child.scale.setScalar(s);

      // Billboard: a flat ring is invisible edge-on, so it has to turn
      // with the viewer to stay a ring from wherever they are standing.
      if (child.visible) child.quaternion.copy(camera.quaternion);
    });
  });

  return (
    <group ref={group}>
      {PROJECT_ANCHORS.map((anchor, i) => (
        <mesh key={anchor.id} position={anchor.position} visible={false}>
          <ringGeometry args={[anchor.glowRadius * 0.88, anchor.glowRadius, 48]} />
          <primitive object={materials[i]} attach="material" />
        </mesh>
      ))}
    </group>
  );
}
