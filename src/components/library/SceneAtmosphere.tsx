import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { AtmosphereMix } from '../../hooks/useAtmosphereMix';

interface SceneAtmosphereProps {
  mix: React.RefObject<AtmosphereMix>;
}

const EXTERIOR_COLOR = new THREE.Color('#22303f');
const INTERIOR_COLOR = new THREE.Color('#efe6d3');

export function SceneAtmosphere({ mix }: SceneAtmosphereProps) {
  const { scene } = useThree();
  const blended = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const m = mix.current.value;
    blended.copy(EXTERIOR_COLOR).lerp(INTERIOR_COLOR, m);

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(blended);
    }
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(blended);
      scene.fog.near = THREE.MathUtils.lerp(4.5, 6, m);
      scene.fog.far = THREE.MathUtils.lerp(11, 14, m);
    }
  });

  return null;
}
