import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AtmosphereMix } from '../../hooks/useAtmosphereMix';
import { timePalette as tp } from '../../lib/timeOfDay';

interface LightingProps {
  shadows: boolean;
  quality: 'high' | 'medium' | 'low';
  mix: React.RefObject<AtmosphereMix>;
}

const AMBIENT_MAX = 0.35;
const KEY_MAX = 0.9;
const FILL_MAX = 0.35;
const RIM_MAX = 0.6;
const EXT_AMBIENT_MAX = 0.8;
// The exterior is the very first thing anyone sees, and it was arriving as
// a near-black rectangle: the door leaf's walnut (#3f2f22, ~0.05 linear
// reflectance) lit only by a dim blue ambient and a 1.1-candela point light
// sitting at y = 0.4, z = 6.9 — level with the camera and *behind* the
// spawn point, so it grazed the door instead of washing it. Nothing of the
// invitation (panels, brass handle, kick plate) was legible.
//
// Moved to where a porch light actually lives — above the door, on the
// outside — and given the intensity that position needs. Because it now
// hangs above the header rather than level with it, the falloff still
// leaves the wall strip over the door dimmer than the door face itself,
// which was the constraint the old low position was chosen for.
const PORCH_MAX = 5.5;
const PORCH_POSITION: [number, number, number] = [0, 0.95, 6.25];

// The ceiling pendant: the room's one shadow-casting light. Shadows used to
// come from a directional "sun" placed inside the room, high and to the
// front-right, with no source anyone could see — so the floating shelf
// threw a big dark slab down the wall beneath it and the desk lamp's pole
// drew a long diagonal stripe up the side wall. From a fixture hanging over
// the middle of the room, shadows fall short and down, under the shelf,
// the desk and the bed, the way they do in a real room.
const CEILING_Y = 5.4;
const PENDANT_POSITION: [number, number, number] = [0, 2.55, 0.9];
const PENDANT_MAX = 7;

export function LibraryLighting({ shadows, quality, mix }: LightingProps) {
  const ambient = useRef<THREE.AmbientLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.SpotLight>(null);
  const pendant = useRef<THREE.SpotLight>(null);
  const exteriorAmbient = useRef<THREE.AmbientLight>(null);
  const porch = useRef<THREE.PointLight>(null);

  const mapSize = quality === 'high' ? 2048 : 1024;

  useFrame(() => {
    const m = mix.current.value;
    // Scaled by the visitor's time of day; all 1 at dusk (lib/timeOfDay.ts).
    if (ambient.current) ambient.current.intensity = AMBIENT_MAX * m * tp.ambientScale;
    if (key.current) key.current.intensity = KEY_MAX * m * tp.keyScale;
    if (fill.current) fill.current.intensity = FILL_MAX * m * tp.fillScale;
    if (rim.current) rim.current.intensity = RIM_MAX * m;
    // An indoor light: the same at any hour, so it carries more of the room
    // as the window darkens.
    if (pendant.current) pendant.current.intensity = PENDANT_MAX * m;
    if (exteriorAmbient.current) {
      exteriorAmbient.current.intensity = EXT_AMBIENT_MAX * (1 - m * 0.7) * tp.exteriorAmbientScale;
    }
    if (porch.current) porch.current.intensity = PORCH_MAX * (1 - m * 0.6) * tp.porchScale;
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0} color="#f2e6cf" />

      {/* Daylight through the window (right wall, lib/roomLayout.ts):
          shapes the room, casts nothing — see PENDANT_POSITION. */}
      <directionalLight ref={key} position={[4.5, 2.8, 1.15]} intensity={0} color="#f6ddb0" />

      <Pendant />
      <spotLight
        ref={pendant}
        position={PENDANT_POSITION}
        intensity={0}
        color="#ffe2b3"
        // Wide and soft: lights most of the room, edge falling off into
        // the corners. decay 1 rather than the physical 2, so the floor
        // 4.6 m below isn't dark while the cord is blinding.
        angle={1.2}
        penumbra={1}
        decay={1}
        distance={14}
        castShadow={shadows}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-near={0.2}
        shadow-camera-far={14}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      >
        <PendantTarget />
      </spotLight>

      {/* Soft fill from the entrance side, so faces turned away from the
          window aren't flat black. */}
      <directionalLight ref={fill} position={[-1.5, 2.5, 7]} intensity={0} color={tp.fillColor} />

      <spotLight
        ref={rim}
        position={[-1, 2.5, 2]}
        angle={0.5}
        penumbra={0.8}
        intensity={0}
        color="#f2c87a"
      />

      {/* Exterior blue-hour wash, fades out as the door is passed */}
      <ambientLight ref={exteriorAmbient} intensity={EXT_AMBIENT_MAX} color="#2f4258" />
      <pointLight
        ref={porch}
        position={PORCH_POSITION}
        intensity={PORCH_MAX}
        color="#a9c4de"
        distance={4.6}
      />
    </>
  );
}

/** Points the pendant's spotlight straight down at the floor below it. */
function PendantTarget() {
  const target = useRef<THREE.Object3D>(null);
  useEffect(() => {
    const t = target.current;
    const light = t?.parent as THREE.SpotLight | undefined;
    if (t && light) light.target = t;
  }, []);
  // Local to the light: straight down to the floor (y = -2.05).
  return <object3D ref={target} position={[0, -2.05 - PENDANT_POSITION[1], 0]} />;
}

/** The fixture itself: a cord from the ceiling and a linen drum shade. */
function Pendant() {
  const [x, y, z] = PENDANT_POSITION;
  const cordLength = CEILING_Y - y;
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, cordLength / 2 + 0.1, 0]}>
        <cylinderGeometry args={[0.006, 0.006, cordLength - 0.2, 6]} />
        <meshStandardMaterial color="#2a2018" roughness={0.6} />
      </mesh>
      <mesh position={[0, cordLength - 0.02, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.04, 16]} />
        <meshStandardMaterial color="#c9a05c" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Drum shade, lit from inside */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.3, 0.34, 0.26, 32, 1, true]} />
        <meshStandardMaterial
          color="#efe2c8"
          emissive="#ffd9a0"
          emissiveIntensity={0.9}
          roughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Diffuser across the bottom: the bright disc you see from below */}
      <mesh position={[0, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.33, 32]} />
        <meshBasicMaterial color="#fff1d6" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.19, 0]}>
        <torusGeometry args={[0.3, 0.008, 6, 32]} />
        <meshStandardMaterial color="#c9a05c" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}
