import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  DOOR_INTERACT_POINT,
  PC_INTERACT_POINT,
  LAMP_INTERACT_POINT,
} from './CrosshairInteraction';

interface HotspotsProps {
  /** Ids already discovered; a found hotspot stops advertising itself. */
  discovered: ReadonlySet<string>;
  /** Only shown once the visitor is actually in the room. */
  active: boolean;
}

/**
 * Faint markers on the three things in the room that interact but don't
 * look like they do: the door handle, the laptop and the light switch.
 *
 * The books are deliberately not marked. They already read as books on a
 * shelf, which is affordance enough — dotting eight more lights along the
 * shelf would turn a room into a checklist. These three had no cue at all
 * beyond walking close enough for the crosshair to notice them, which is
 * exactly the kind of thing a visitor leaves without ever finding.
 *
 * Each one fades out for good once found, so the room gets quieter the
 * more of it you've seen rather than nagging.
 */
const HOTSPOTS: { id: string; point: THREE.Vector3 }[] = [
  { id: 'door', point: DOOR_INTERACT_POINT },
  { id: 'pc', point: PC_INTERACT_POINT },
  { id: 'lamp', point: LAMP_INTERACT_POINT },
];

export function Hotspots({ discovered, active }: HotspotsProps) {
  const group = useRef<THREE.Group>(null);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#f2c87a',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  // One material shared by all three, so the pulse is a single uniform
  // update per frame rather than one per marker. Opacity is driven here
  // instead of through React state for the same reason: a 60 Hz pulse must
  // never become a 60 Hz re-render.
  useFrame((state) => {
    if (!group.current) return;
    const pulse = 0.35 + Math.sin(state.clock.elapsedTime * 2.2) * 0.18;
    material.opacity = active ? pulse : 0;

    for (const child of group.current.children) {
      const found = discovered.has(child.name);
      child.visible = active && !found;
    }
  });

  return (
    <group ref={group}>
      {HOTSPOTS.map(({ id, point }) => (
        <mesh key={id} name={id} position={point} visible={false}>
          <sphereGeometry args={[0.022, 10, 8]} />
          <primitive object={material} attach="material" />
        </mesh>
      ))}
    </group>
  );
}
