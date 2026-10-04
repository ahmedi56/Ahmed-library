import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { BookData } from '../../data/books';
import { getCoverGrainTexture, getCoverBumpTexture, getPageEdgeTexture } from '../../lib/textures';

// Realistic hardcover proportions in meters (1 scene unit = 1 meter).
// X = thickness (spine width, faces along the shelf row)
// Y = height (vertical)
// Z = depth (spine-to-fore-edge; spine sits at +Z, facing the room)
export const BOOK_WIDTH = 0.045;
export const BOOK_HEIGHT = 0.26;
export const BOOK_DEPTH = 0.19;

const SPINE_FONT = 'https://cdn.jsdelivr.net/fontsource/fonts/fraunces@latest/latin-600-normal.woff';

interface BookMeshProps {
  data: BookData;
  quality?: 'high' | 'medium' | 'low';
  showLabel?: boolean;
}

/** The closed book: used on the shelf, and while it's being grabbed/carried. */
export function BookMesh({ data, quality = 'high', showLabel = true }: BookMeshProps) {
  const width = BOOK_WIDTH * data.thickness;
  const height = BOOK_HEIGHT * data.height;
  const depth = BOOK_DEPTH;

  const spineRadius = width / 2;
  const coverThickness = Math.max(0.005, width * 0.1);
  // Z where the rounded spine meets the flat covers (its tangent line).
  const spineFlatZ = depth / 2 - spineRadius;
  const foreEdgeOverhang = 0.012;
  const headTailOverhang = 0.009;

  // Page block sits flush against the spine and stops short of the cover's
  // fore-edge overhang.
  const pageNearZ = spineFlatZ - 0.002;
  const pageFarZ = -depth / 2 + foreEdgeOverhang * 1.4;
  const pageDepth = Math.max(0.02, pageNearZ - pageFarZ);
  const pageZ = (pageNearZ + pageFarZ) / 2;

  // Covers are flush with the spine and overhang past the pages on the
  // fore-edge (and top/bottom, via their own height).
  const coverFarZ = pageFarZ - foreEdgeOverhang;
  const coverDepth = spineFlatZ - coverFarZ;
  const coverZ = (spineFlatZ + coverFarZ) / 2;
  const coverHeight = height + headTailOverhang * 2;

  const grain = quality === 'low' ? null : getCoverGrainTexture();
  const bump = quality === 'high' ? getCoverBumpTexture() : null;

  const coverMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: data.coverColor,
        map: grain,
        bumpMap: bump,
        bumpScale: bump ? 0.0012 : 0,
        roughness: 0.52,
        metalness: 0.05,
      }),
    [data.coverColor, grain, bump]
  );

  const bandMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: data.accentColor, metalness: 0.45, roughness: 0.35 }),
    [data.accentColor]
  );

  const pageMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: getPageEdgeTexture(),
        roughness: 0.92,
      }),
    []
  );

  // three.js CylinderGeometry parametrizes theta as x = r*sin(theta), z = r*cos(theta),
  // so a half-sweep centered on theta=0 (i.e. thetaStart = -PI/2) bulges toward +Z —
  // apex facing the camera — with its flat tangent edges at x = ±radius, z = 0.
  const spineTheta: [number, number] = [-Math.PI / 2, Math.PI];

  return (
    <group>
      {/* Page block, resting flush against the spine */}
      <mesh position={[0, 0, pageZ]} material={pageMat} castShadow receiveShadow>
        <boxGeometry args={[width - coverThickness * 1.9, height - headTailOverhang, pageDepth]} />
      </mesh>
      {/* Spine crease groove where the pages meet the binding */}
      <mesh position={[0, 0, spineFlatZ - 0.0015]}>
        <boxGeometry args={[width - coverThickness * 1.3, height - headTailOverhang * 0.6, 0.003]} />
        <meshStandardMaterial color="#1c150e" roughness={0.9} />
      </mesh>

      {/* Rounded spine, wraps from cover edge to cover edge, apex faces the room */}
      <mesh position={[0, 0, spineFlatZ]} castShadow receiveShadow>
        <cylinderGeometry args={[spineRadius, spineRadius, height, 20, 1, true, spineTheta[0], spineTheta[1]]} />
        <primitive object={coverMat} attach="material" />
      </mesh>
      {/* Head + tail bands (bookbinding detail) */}
      <mesh position={[0, height / 2 - 0.003, spineFlatZ]}>
        <cylinderGeometry
          args={[spineRadius * 1.02, spineRadius * 1.02, 0.007, 20, 1, true, spineTheta[0], spineTheta[1]]}
        />
        <primitive object={bandMat} attach="material" />
      </mesh>
      <mesh position={[0, -height / 2 + 0.003, spineFlatZ]}>
        <cylinderGeometry
          args={[spineRadius * 1.02, spineRadius * 1.02, 0.007, 20, 1, true, spineTheta[0], spineTheta[1]]}
        />
        <primitive object={bandMat} attach="material" />
      </mesh>

      {/* Spine label, running vertically along the spine apex */}
      {showLabel && (
        <Text
          position={[0, 0, depth / 2 + 0.0008]}
          rotation={[0, 0, -Math.PI / 2]}
          font={SPINE_FONT}
          fontSize={0.019}
          color={data.accentColor}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.04}
          maxWidth={height * 0.82}
          sdfGlyphSize={128}
          outlineWidth={0.001}
          outlineColor={data.accentColor}
          outlineOpacity={0.3}
        >
          {data.spineLabel}
        </Text>
      )}

      {/* Front cover, wraps the pages: flush at the spine, overhangs at the fore-edge */}
      <mesh position={[-(width / 2 - coverThickness / 2), 0, coverZ]} castShadow receiveShadow>
        <boxGeometry args={[coverThickness, coverHeight, coverDepth]} />
        <primitive object={coverMat} attach="material" />
      </mesh>
      {/* Back cover */}
      <mesh position={[width / 2 - coverThickness / 2, 0, coverZ]} castShadow receiveShadow>
        <boxGeometry args={[coverThickness, coverHeight, coverDepth]} />
        <primitive object={coverMat} attach="material" />
      </mesh>
    </group>
  );
}
