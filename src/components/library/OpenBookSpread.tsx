import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BookData } from '../../data/books';
import { getPageContentTexture, getPageEdgeTexture, getCoverGrainTexture } from '../../lib/textures';

interface OpenBookSpreadProps {
  data: BookData;
  quality: 'high' | 'medium' | 'low';
  /** 0 = pages lie flat together (just revealed) .. 1 = fanned open to reading angle. */
  openRef: React.RefObject<{ value: number }>;
  /** 0 = front cover shut over the pages .. 1 = swung open on the spine. */
  coverRef: React.RefObject<{ value: number }>;
  /** 0..1 through the riffle: a few loose pages flipping right to left. */
  riffleRef: React.RefObject<{ value: number }>;
}

const RIFFLE_PAGES = 3;
// Each riffled page starts this far (in riffle progress) after the last,
// and takes RIFFLE_SPAN of it to turn.
const RIFFLE_STAGGER = 0.2;
const RIFFLE_SPAN = 1 - RIFFLE_STAGGER * (RIFFLE_PAGES - 1);
// The front board sits behind the left page's deepest point (its fore-edge
// curl and paper edge), so when the cover is shut it lies over the right
// page without the folded left page poking through it.
const COVER_Z = -0.034;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Page size for a book, shared with BookPages so the closed book lines up. */
export function spreadPageSize(bookHeight: number) {
  const height = 0.26 * bookHeight;
  return { pageWidth: height * 0.76, pageHeight: height * 0.94 };
}

// Each page tilts ~18° off flat at t=1, cupped toward the camera — a small,
// deliberately conservative angle, driven by directly-verified geometry math
// rather than a large rotation sweep that's easy to get backwards.
const TENT_ANGLE = 0.32;
// Tips the whole spread's top edge away from the camera so we're looking
// down into the pages, like a book held up and tilted back to read.
export const TILT_X = -0.32;

function buildPageGeometry(pageWidth: number, pageHeight: number, bend: number, mirrored: boolean) {
  const geo = new THREE.PlaneGeometry(pageWidth, pageHeight, 10, 1);
  geo.translate(mirrored ? -pageWidth / 2 : pageWidth / 2, 0, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    // Fraction of the way from the spine (0) to the outer/fore-edge (1).
    const t = THREE.MathUtils.clamp((mirrored ? -x : x) / pageWidth, 0, 1);
    // Gentle concave curve: flat at the spine, recessed at the fore-edge.
    pos.setZ(i, -bend * t * t);
  }
  geo.computeVertexNormals();
  return geo;
}

export function OpenBookSpread({ data, quality, openRef, coverRef, riffleRef }: OpenBookSpreadProps) {
  const { pageWidth, pageHeight } = spreadPageSize(data.height);
  const bend = pageWidth * 0.09;

  const leftHinge = useRef<THREE.Group>(null);
  const rightHinge = useRef<THREE.Group>(null);
  // The front cover, carrying the left page with it (the left page of the
  // first spread is the inside of the cover): shut, it's folded over onto
  // the right half; open, it lies flat on the left.
  const coverHinge = useRef<THREE.Group>(null);
  const riffle = useRef<(THREE.Group | null)[]>([]);

  const leftGeo = useMemo(() => buildPageGeometry(pageWidth, pageHeight, bend, true), [pageWidth, pageHeight, bend]);
  const rightGeo = useMemo(() => buildPageGeometry(pageWidth, pageHeight, bend, false), [pageWidth, pageHeight, bend]);

  const leftMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: getPageContentTexture(`spread-left-${data.id}`, { lines: 16 }),
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
    [data.id]
  );
  const rightMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: getPageContentTexture(`spread-right-${data.id}`, { title: data.title, lines: 11 }),
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
    [data.id, data.title]
  );

  const edgeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: getPageEdgeTexture(), roughness: 0.95 }),
    []
  );

  const backingMat = useMemo(() => {
    const grain = quality === 'low' ? null : getCoverGrainTexture();
    return new THREE.MeshStandardMaterial({
      color: data.coverColor,
      map: grain,
      roughness: 0.6,
      metalness: 0.04,
    });
  }, [data.coverColor, quality]);

  const sheetMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.9, side: THREE.DoubleSide }),
    []
  );

  useFrame(() => {
    const t = openRef.current?.value ?? 0;
    if (leftHinge.current) leftHinge.current.rotation.y = THREE.MathUtils.lerp(0, TENT_ANGLE, t);
    if (rightHinge.current) rightHinge.current.rotation.y = THREE.MathUtils.lerp(0, -TENT_ANGLE, t);
    // Rotating -π about the spine swings the right half up toward the
    // reader and over to the left, the way a cover opens.
    const cover = coverRef.current?.value ?? 1;
    if (coverHinge.current) coverHinge.current.rotation.y = -Math.PI * (1 - cover);

    const r = riffleRef.current?.value ?? 0;
    riffle.current.forEach((sheet, k) => {
      if (!sheet) return;
      const p = THREE.MathUtils.clamp((r - k * RIFFLE_STAGGER) / RIFFLE_SPAN, 0, 1);
      sheet.visible = p > 0 && p < 1;
      sheet.rotation.y = -Math.PI * easeInOut(p);
    });
  });

  return (
    <group rotation={[TILT_X, 0, 0]}>
      {/* Back board, peeking around the right page */}
      <mesh position={[pageWidth * 0.525, 0, -0.014]}>
        <planeGeometry args={[pageWidth * 1.05, pageHeight * 1.08]} />
        <primitive object={backingMat} attach="material" />
      </mesh>

      {/* Spine gutter: pages don't lie flush at the binding, they lift into a
          small ridge — two thin angled slivers meeting at a peak read as that gap. */}
      <mesh position={[-0.006, 0, -0.001]} rotation={[0, TENT_ANGLE * 0.9, 0]}>
        <boxGeometry args={[0.014, pageHeight, 0.004]} />
        <meshStandardMaterial color="#2a2018" roughness={0.85} />
      </mesh>
      <mesh position={[0.006, 0, -0.001]} rotation={[0, -TENT_ANGLE * 0.9, 0]}>
        <boxGeometry args={[0.014, pageHeight, 0.004]} />
        <meshStandardMaterial color="#2a2018" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.003]}>
        <boxGeometry args={[0.007, pageHeight, 0.008]} />
        <meshStandardMaterial color="#15100b" roughness={0.9} />
      </mesh>

      <group ref={coverHinge}>
        {/* Front board: shut, its outside faces the reader */}
        <mesh position={[-pageWidth * 0.525, 0, COVER_Z]}>
          <boxGeometry args={[pageWidth * 1.05, pageHeight * 1.08, 0.006]} />
          <primitive object={backingMat} attach="material" />
        </mesh>
        <group ref={leftHinge}>
          <mesh geometry={leftGeo} material={leftMat} castShadow receiveShadow />
          {/* Stacked-paper fore-edge */}
          <mesh position={[-pageWidth - 0.006, 0, -bend * 0.4]} castShadow>
            <boxGeometry args={[0.012, pageHeight, bend + 0.024]} />
            <primitive object={edgeMat} attach="material" />
          </mesh>
        </group>
      </group>

      {/* Riffle: loose pages turning over from the right, only while moving */}
      {Array.from({ length: RIFFLE_PAGES }, (_, k) => (
        <group key={k} ref={(el) => void (riffle.current[k] = el)} visible={false} position={[0, 0, 0.002 + k * 0.001]}>
          <mesh position={[pageWidth * 0.49, 0, 0]} material={sheetMat}>
            <planeGeometry args={[pageWidth * 0.98, pageHeight * 0.99]} />
          </mesh>
        </group>
      ))}

      <group ref={rightHinge}>
        <mesh geometry={rightGeo} material={rightMat} castShadow receiveShadow />
        <mesh position={[pageWidth + 0.006, 0, -bend * 0.4]} castShadow>
          <boxGeometry args={[0.012, pageHeight, bend + 0.024]} />
          <primitive object={edgeMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}
