import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AtmosphereMix } from '../../hooks/useAtmosphereMix';

interface LightingProps {
  shadows: boolean;
  quality: 'high' | 'medium' | 'low';
  mix: React.RefObject<AtmosphereMix>;
}

const AMBIENT_MAX = 0.35;
const KEY_MAX = 1.1;
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

export function LibraryLighting({ shadows, quality, mix }: LightingProps) {
  const ambient = useRef<THREE.AmbientLight>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.SpotLight>(null);
  const exteriorAmbient = useRef<THREE.AmbientLight>(null);
  const porch = useRef<THREE.PointLight>(null);

  const mapSize = quality === 'high' ? 2048 : 1024;

  useFrame(() => {
    const m = mix.current.value;
    if (ambient.current) ambient.current.intensity = AMBIENT_MAX * m;
    if (key.current) key.current.intensity = KEY_MAX * m;
    if (fill.current) fill.current.intensity = FILL_MAX * m;
    if (rim.current) rim.current.intensity = RIM_MAX * m;
    if (exteriorAmbient.current) {
      exteriorAmbient.current.intensity = EXT_AMBIENT_MAX * (1 - m * 0.7);
    }
    if (porch.current) porch.current.intensity = PORCH_MAX * (1 - m * 0.6);
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0} color="#f2e6cf" />

      <directionalLight
        ref={key}
        position={[1.5, 3.5, 3]}
        intensity={0}
        color="#f6ddb0"
        castShadow={shadows}
        shadow-mapSize={[mapSize, mapSize]}
        // ±9, not ±4. A directional light's shadow camera is an ortho box
        // around its target (world origin here) in light space, and
        // anything outside it samples the shadow map's clamped edge — in
        // practice, reads as shadowed. This room is 9 wide, 8.3 deep and
        // 7.5 tall, so a ±4 box covered barely its middle: the entrance
        // wall, the light switch on it and the far corners were all being
        // darkened by geometry that was simply out of frustum, not by
        // anything actually occluding them. ±9 covers the room with margin
        // and still leaves 2048/18 ≈ 114 shadow texels per unit on high.
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        // Explicit near/far, replacing THREE's defaults (0.5/500) — this
        // room is ~9 units across, so 500 wasted nearly all the shadow
        // camera's depth precision on empty space past the walls. 15
        // comfortably covers the room's diagonal (~9.6 at its longest, from
        // this light's position) with margin — raised to 25 alongside the
        // widened ortho box below, which pushes the near plane further back.
        shadow-camera-near={0.5}
        shadow-camera-far={25}
        shadow-bias={-0.0015}
        shadow-normalBias={0.02}
      />

      <directionalLight ref={fill} position={[4, 1.5, -1]} intensity={0} color="#7fa3c4" />

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
