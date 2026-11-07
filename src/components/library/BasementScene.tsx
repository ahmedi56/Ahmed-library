import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useCustomization } from '../../hooks/useCustomization';
import { getBrickTexture, getWoodTexture } from '../../lib/textures';
import { paintPortrait } from '../../lib/paintedPortrait';
import { BASEMENT_HALF, BASEMENT_Z, hireStamp, PORTRAIT_POSITION, pressHireStamp } from '../../lib/secretRoom';
import { startHum } from '../../lib/sfx';
import { identity } from '../../data/books';
import { SPINE_FONT } from './BookMesh';

const FLOOR_Y = -2.05;
const CEILING_Y = 0.75;
const HEIGHT = CEILING_Y - FLOOR_Y;
const PORTRAIT_W = 0.84;
const PORTRAIT_H = 1.05;

/**
 * The secret basement (lib/secretRoom.ts): a small brick room lit by one
 * bare bulb, with a painted portrait of Ahmed on the far wall and the stairs
 * back up along the side. Mounted only while the visitor is down here —
 * behind the fade — so the room upstairs never pays for it.
 */
export function BasementScene({ quality }: { quality: 'high' | 'medium' | 'low' }) {
  // Room tone, for exactly as long as the basement exists.
  useEffect(() => startHum(), []);

  const brick = useMemo(() => {
    const t = getBrickTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(3, 1.4);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.BackSide });
  }, []);
  const floorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: quality === 'low' ? '#4a3626' : '#ffffff',
        map: quality === 'low' ? null : getWoodTexture('basementFloor', { base: '#4a3626', grain: '#2e2116', repeat: [4, 4] }),
        roughness: 0.8,
      }),
    [quality]
  );
  const beamMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.8 }), []);

  return (
    <group position={[0, 0, BASEMENT_Z]}>
      {/* Walls: one box seen from inside */}
      <mesh position={[0, FLOOR_Y + HEIGHT / 2, 0]} material={brick}>
        <boxGeometry args={[BASEMENT_HALF * 2, HEIGHT, BASEMENT_HALF * 2]} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} material={floorMat}>
        <planeGeometry args={[BASEMENT_HALF * 2, BASEMENT_HALF * 2]} />
      </mesh>
      {/* Ceiling beams */}
      {[-1.8, -0.6, 0.6, 1.8].map((z) => (
        <mesh key={z} position={[0, CEILING_Y - 0.09, z]} material={beamMat}>
          <boxGeometry args={[BASEMENT_HALF * 2, 0.18, 0.2]} />
        </mesh>
      ))}

      <Bulb />
      {quality !== 'low' && <BulbDust />}
      <Portrait />
      <ConsoleTable />
      <Stairs />

      {/* Rug */}
      <mesh position={[0, FLOOR_Y + 0.006, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 1.7]} />
        <meshStandardMaterial color="#7a3b2a" roughness={0.95} />
      </mesh>
    </group>
  );
}

/** One bare bulb on a cord, flickering very slightly like an old filament. */
function Bulb() {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!light.current) return;
    const t = clock.elapsedTime;
    light.current.intensity = 3.2 + Math.sin(t * 7.3) * 0.08 + Math.sin(t * 17.1) * 0.05;
  });
  return (
    <group position={[0, CEILING_Y, 0.4]}>
      <mesh position={[0, -0.25, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.5, 6]} />
        <meshStandardMaterial color="#1c140d" />
      </mesh>
      <mesh position={[0, -0.53, 0]}>
        <sphereGeometry args={[0.05, 14, 12]} />
        <meshBasicMaterial color="#ffd89a" toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, -0.6, 0]} intensity={3.2} color="#ffcf8a" distance={9} decay={1.4} />
    </group>
  );
}

/** The painted portrait (lib/paintedPortrait.ts) in a gold frame, with a name plate. */
function Portrait() {
  const { photo } = useCustomization();
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const initials = identity.name
      .split(/\s+/)
      .map((w) => w[0])
      .join('');
    void paintPortrait(photo, initials).then((canvas) => {
      if (cancelled) return;
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      setTexture(t);
    });
    return () => {
      cancelled = true;
    };
  }, [photo]);
  useEffect(() => () => texture?.dispose(), [texture]);

  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b8893c', metalness: 0.8, roughness: 0.3 }), []);
  const border = 0.07;

  return (
    // PORTRAIT_POSITION is in world space; this group sits inside the
    // basement's own, at BASEMENT_Z.
    <group position={[PORTRAIT_POSITION[0], PORTRAIT_POSITION[1], PORTRAIT_POSITION[2] - BASEMENT_Z]}>
      <mesh position={[0, 0, -0.02]} material={gold}>
        <boxGeometry args={[PORTRAIT_W + border * 2, PORTRAIT_H + border * 2, 0.05]} />
      </mesh>
      {/* Keyed on the texture: a material compiled without a map doesn't
          pick one up when it arrives later, it just turns white. */}
      <mesh key={texture ? 'painted' : 'blank'} position={[0, 0, 0.007]}>
        <planeGeometry args={[PORTRAIT_W, PORTRAIT_H]} />
        <meshStandardMaterial map={texture} color={texture ? '#ffffff' : '#3a2616'} roughness={0.75} />
      </mesh>
      {/* A small picture light over the frame */}
      <mesh position={[0, PORTRAIT_H / 2 + border + 0.04, 0.08]} material={gold}>
        <boxGeometry args={[0.36, 0.03, 0.06]} />
      </mesh>
      <spotLight
        position={[0, PORTRAIT_H / 2 + 0.1, 0.35]}
        intensity={0.7}
        angle={0.7}
        penumbra={0.7}
        distance={2.5}
        color="#ffe2b3"
      >
        <PictureLightTarget />
      </spotLight>
      {/* Name plate */}
      <mesh position={[0, -PORTRAIT_H / 2 - border - 0.09, 0.01]} material={gold}>
        <boxGeometry args={[0.62, 0.09, 0.012]} />
      </mesh>
      <Text
        position={[0, -PORTRAIT_H / 2 - border - 0.09, 0.019]}
        font={SPINE_FONT}
        fontSize={0.03}
        letterSpacing={0.06}
        color="#2a1a0d"
        anchorX="center"
        anchorY="middle"
      >
        {`${identity.name} · HEAD LIBRARIAN`}
      </Text>
    </group>
  );
}

function PictureLightTarget() {
  const target = useRef<THREE.Object3D>(null);
  useEffect(() => {
    const t = target.current;
    const light = t?.parent as THREE.SpotLight | undefined;
    if (t && light) light.target = t;
  }, []);
  return <object3D ref={target} position={[0, -0.6, -0.34]} />;
}

/** A narrow table under the portrait, with a candle and a closed book. */
function ConsoleTable() {
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 0.6 }), []);
  const z = PORTRAIT_POSITION[2] + 0.25;
  const top = -1.2;
  return (
    <group position={[0, 0, z - BASEMENT_Z]}>
      <mesh position={[0, top, 0]} material={wood} castShadow>
        <boxGeometry args={[1.3, 0.05, 0.36]} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, (top + FLOOR_Y) / 2, 0]} material={wood}>
          <boxGeometry args={[0.05, top - FLOOR_Y, 0.3]} />
        </mesh>
      ))}
      <mesh position={[-0.4, top + 0.09, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.14, 12]} />
        <meshStandardMaterial color="#efe6d2" roughness={0.8} />
      </mesh>
      <mesh position={[-0.4, top + 0.18, 0]}>
        <sphereGeometry args={[0.014, 8, 8]} />
        <meshBasicMaterial color="#ffc46b" toneMapped={false} />
      </mesh>
      <mesh position={[0.35, top + 0.045, 0]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.24, 0.04, 0.17]} />
        <meshStandardMaterial color="#6b2d2a" roughness={0.6} />
      </mesh>
      <HireStamp position={[0.05, top + 0.025, 0.02]} />
    </group>
  );
}

/**
 * A red rubber stamp reading HIRE ME. Clicking it presses it (and the
 * visitor's borrower's card), and opens an email — see pressHireStamp.
 */
function HireStamp({ position }: { position: [number, number, number] }) {
  const handle = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  useFrame(() => {
    if (!handle.current) return;
    // Down and back up over 0.5 s after a press; a small lift on hover.
    const since = (performance.now() - hireStamp.pressedAt) / 1000;
    const press = hireStamp.pressedAt >= 0 && since < 0.5 ? Math.sin((since / 0.5) * Math.PI) : 0;
    handle.current.position.y = (hovered ? 0.015 : 0) - press * 0.03;
  });
  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  return (
    <group position={position}>
      {/* Ink pad */}
      <mesh position={[0.11, 0.008, 0]}>
        <boxGeometry args={[0.12, 0.016, 0.08]} />
        <meshStandardMaterial color="#2a1a14" roughness={0.6} />
      </mesh>
      <group
        ref={handle}
        onClick={(e) => {
          e.stopPropagation();
          pressHireStamp();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <mesh position={[0, 0.012, 0]}>
          <boxGeometry args={[0.1, 0.024, 0.06]} />
          <meshStandardMaterial color="#8a1f1a" roughness={0.5} emissive="#8a1f1a" emissiveIntensity={hovered ? 0.35 : 0} />
        </mesh>
        <mesh position={[0, 0.045, 0]}>
          <cylinderGeometry args={[0.012, 0.016, 0.045, 12]} />
          <meshStandardMaterial color="#5a3a26" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <sphereGeometry args={[0.024, 14, 12]} />
          <meshStandardMaterial color="#5a3a26" roughness={0.5} />
        </mesh>
        <Text
          position={[0, 0.0245, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          font={SPINE_FONT}
          fontSize={0.017}
          color="#f5efe4"
          anchorX="center"
          anchorY="middle"
        >
          HIRE ME
        </Text>
      </group>
    </group>
  );
}

/** Dust turning slowly in the bulb's light. */
function BulbDust() {
  const count = 70;
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // A loose cone under the bulb.
      const y = Math.random();
      const r = 0.2 + y * 0.9;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r * Math.random();
      pos[i * 3 + 1] = CEILING_Y - 0.6 - y * 2;
      pos[i * 3 + 2] = 0.4 + Math.sin(a) * r * Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame(({ clock }) => {
    if (points.current) points.current.rotation.y = clock.elapsedTime * 0.03;
  });
  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial color="#fff1d6" size={0.012} transparent opacity={0.55} depthWrite={false} />
    </points>
  );
}

/** The way back up, along the left wall. */
function Stairs() {
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 0.7 }), []);
  const steps = 9;
  const rise = HEIGHT / (steps + 1);
  const run = 0.3;
  const brass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b8893c', metalness: 0.8, roughness: 0.3 }), []);
  // The rail runs from above the bottom step to above the top one, 0.9 m up.
  const railRise = rise * (steps - 1);
  const railRun = run * (steps - 1);
  const railLength = Math.hypot(railRise, railRun);
  const railAngle = Math.atan2(railRise, railRun);
  return (
    <group position={[-BASEMENT_HALF + 0.5, FLOOR_Y, 1.9]}>
      <mesh
        position={[0.45, rise + 0.9 + railRise / 2, -railRun / 2]}
        // Tipped from upright to the stairs' slope, rising toward the back.
        rotation={[railAngle - Math.PI / 2, 0, 0]}
        material={brass}
      >
        <cylinderGeometry args={[0.018, 0.018, railLength, 10]} />
      </mesh>
      {[0, Math.floor(steps / 2), steps - 1].map((i) => (
        <mesh key={i} position={[0.45, rise * (i + 1) + 0.45, -i * run]} material={brass}>
          <cylinderGeometry args={[0.012, 0.012, 0.9, 8]} />
        </mesh>
      ))}
      {/* Each step solid down to the floor, so the flight reads as one block */}
      {Array.from({ length: steps }, (_, i) => (
        <mesh key={i} position={[0, (rise * (i + 1)) / 2, -i * run]} material={wood}>
          <boxGeometry args={[0.9, rise * (i + 1), run]} />
        </mesh>
      ))}
    </group>
  );
}
