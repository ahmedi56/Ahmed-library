import { useMemo } from 'react';
import * as THREE from 'three';
import { useDataUrlTexture } from '../../hooks/useDataUrlTexture';

interface PictureFrameProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  width: number;
  height: number;
  image: string | null;
  frameColor?: string;
  matColor?: string;
  frameThickness?: number;
  depth?: number;
  castShadow?: boolean;
}

/**
 * A physical wall/table frame built from real geometry (wood border + mat +
 * glass sheen), not a DOM overlay — so it reads as part of the room instead
 * of a floating UI card. With no image set it still reads as an intentional
 * empty frame (mat + glass), not a broken/missing texture.
 */
export function PictureFrame({
  position,
  rotation = [0, 0, 0],
  width,
  height,
  image,
  frameColor = '#3a2e22',
  matColor = '#f3ead4',
  frameThickness = 0.045,
  depth = 0.035,
  castShadow = true,
}: PictureFrameProps) {
  const texture = useDataUrlTexture(image);

  const frameMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.55, metalness: 0.15 }),
    [frameColor]
  );
  const matMat = useMemo(() => new THREE.MeshStandardMaterial({ color: matColor, roughness: 0.92 }), [matColor]);
  const glassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#dce8ef',
        roughness: 0.1,
        metalness: 0.05,
        transparent: true,
        opacity: 0.1,
      }),
    []
  );

  const outerW = width + frameThickness * 2;
  const outerH = height + frameThickness * 2;

  return (
    <group position={position} rotation={rotation}>
      {/* Wood border, 4 bars around a real hole so the mat/photo sits recessed behind it */}
      <mesh position={[0, outerH / 2 - frameThickness / 2, 0]} castShadow={castShadow}>
        <boxGeometry args={[outerW, frameThickness, depth]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      <mesh position={[0, -outerH / 2 + frameThickness / 2, 0]} castShadow={castShadow}>
        <boxGeometry args={[outerW, frameThickness, depth]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      <mesh position={[-outerW / 2 + frameThickness / 2, 0, 0]} castShadow={castShadow}>
        <boxGeometry args={[frameThickness, outerH, depth]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      <mesh position={[outerW / 2 - frameThickness / 2, 0, 0]} castShadow={castShadow}>
        <boxGeometry args={[frameThickness, outerH, depth]} />
        <primitive object={frameMat} attach="material" />
      </mesh>

      {/* Mat backing, recessed a hair behind the frame's front face */}
      <mesh position={[0, 0, -depth * 0.15]} receiveShadow>
        <planeGeometry args={[width, height]} />
        <primitive object={matMat} attach="material" />
      </mesh>

      {/* The certificate/photo itself, inset within the mat */}
      {texture && (
        <mesh position={[0, 0, -depth * 0.08]}>
          <planeGeometry args={[width * 0.86, height * 0.86]} />
          <meshStandardMaterial map={texture} roughness={0.55} />
        </mesh>
      )}

      {/* Glass, proud of everything else, catching a faint reflection */}
      <mesh position={[0, 0, depth * 0.05]}>
        <planeGeometry args={[width, height]} />
        <primitive object={glassMat} attach="material" />
      </mesh>
    </group>
  );
}
