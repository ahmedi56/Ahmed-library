import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  getRugTexture,
  getWallGradientTexture,
  getWoodTexture,
  getKeyboardTexture,
  getLightShaftTexture,
  getPhoneFinanceTexture,
} from '../../lib/textures';
import { DOOR_Z } from './Entrance';
import { PictureFrame } from './PictureFrame';
import { useCustomization } from '../../hooks/useCustomization';
import { usePCSearch, type SearchResult } from '../../hooks/usePCSearch';
import { useProjectShowcase } from '../../hooks/useProjectShowcase';
import {
  SHELF_GROUP_OFFSET_X,
  SHELF_GROUP_OFFSET_Z,
  SHELF_GROUP_ROTATION_Y,
  SHELF_BOTTOM,
  CASE_WIDTH,
  CASE_HEIGHT,
  CASE_DEPTH,
} from '../../lib/bookLayout';

interface EnvironmentProps {
  quality: 'high' | 'medium' | 'low';
  /** Whether the player has switched the entrance wall lamp on (see DoorLamp). */
  lampOn: boolean;
}

// Shared between the back-wall cutout and the window itself so the two stay
// perfectly aligned — the whole opening is defined once, here. Restored to
// centered now that the bookshelf/mantel has moved back to the right wall
// (it was briefly shifted off-center to stay clear of a back-wall mantel).
const WINDOW_X = -0.18;
const WINDOW_Y = 0.65;
const WINDOW_W = 1.8;
const WINDOW_H = 2.6;
const WINDOW_OPEN_HALF_W = WINDOW_W / 2 + 0.03;
const WINDOW_OPEN_HALF_H = WINDOW_H / 2 + 0.03;

export function LibraryEnvironment({ quality, lampOn }: EnvironmentProps) {
  const floorMat = useMemo(() => {
    const map =
      quality === 'low' ? null : getWoodTexture('floor', { base: '#c8b79a', grain: '#8f7752', repeat: [7, 5] });
    return new THREE.MeshStandardMaterial({
      color: '#c8b79a',
      map,
      roughness: 0.75,
      metalness: 0.02,
    });
  }, [quality]);

  const wallMat = useMemo(() => {
    const map = quality === 'low' ? null : getWallGradientTexture();
    return new THREE.MeshStandardMaterial({
      color: '#efe7d8',
      map,
      roughness: 0.92,
    });
  }, [quality]);

  const baseboardMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#3a2e22', roughness: 0.6 }),
    []
  );

  return (
    <group>
      {/* Floor — deep enough to reach past the entrance spawn point (z = 6.8)
          and the room's own collision bound (z = 7.5); it used to stop at
          z = 6, leaving the player standing on empty void at spawn. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.05, 2]} receiveShadow>
        <planeGeometry args={[14, 12]} />
        <primitive object={floorMat} attach="material" />
      </mesh>

      {/* Ceiling, closing the room from above — was missing entirely, so
          looking up (or from any angle that caught the wall tops) showed
          the scene's raw background instead of a room. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 5.4, 2]} receiveShadow>
        <planeGeometry args={[14, 12]} />
        <primitive object={wallMat} attach="material" />
      </mesh>

      {/* Back wall, with a real rectangular opening left for the window —
          a solid unbroken plane there would occlude the recessed glass entirely. */}
      <BackWall wallMat={wallMat} quality={quality} />
      <mesh position={[0, -1.98, -2.98]}>
        <boxGeometry args={[14, 0.14, 0.03]} />
        <primitive object={baseboardMat} attach="material" />
      </mesh>

      {/* Front wall, carrying the entrance doorway — previously just the bare
          door frame floating with no wall around it, so the whole entrance
          side of the room was an open gap straight into the void. */}
      <FrontWall />

      {/* Porch backdrop, closing the far end of the entrance vestibule.
          Floor/ceiling/side walls all run out to z = 8, but nothing ever
          capped that end: standing inside and looking out through the open
          door put a horizontal ray straight past every surface in the
          scene, so the doorway framed a flat rectangle of raw clear-colour
          (blown-out paper white once the interior mix ramps up) instead of
          an exterior. Same problem when turning around at the spawn point.
          One plane, facing back toward the door, is all that's missing. */}
      <mesh position={[0, 1.5, 7.85]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[9, 8]} />
        <meshStandardMaterial color="#2b3a4a" roughness={0.95} />
      </mesh>

      {/* Wall sconce + switch beside the entrance — the room reads dark right
          after stepping in, before the atmosphere mix ramps daylight up, so
          this gives the player their own light source independent of that. */}
      <DoorLamp on={lampOn} />

      {/* Framed wall panels ("murs cadre") — wainscoting on the back wall,
          freed up now that the shelf lives on the right wall instead. */}
      <FramedWallPanels />

      {/* Side wall (subtle, camera-left) — extended to z = 8 to match the
          floor/ceiling's new depth, past the entrance. */}
      <mesh position={[-4.5, 1.5, 2]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      <mesh position={[-4.48, -1.98, 2]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[12, 0.14, 0.03]} />
        <primitive object={baseboardMat} attach="material" />
      </mesh>

      {/* Side wall (camera-right), encloses the room behind the window */}
      <mesh position={[4.5, 1.5, 2]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      <mesh position={[4.48, -1.98, 2]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[12, 0.14, 0.03]} />
        <primitive object={baseboardMat} attach="material" />
      </mesh>

      {/* Window (camera-right), blue-hour glow */}
      <Window quality={quality} />

      {/* Exactly two frames flanking the (one, unchanged) window — left and
          right only, never above/below it. */}
      <WindowFrames />

      {/* Bed, against the left wall, clear of the shelf/nook/door */}
      <Bed quality={quality} />
      <Nightstand quality={quality} />

      {/* Fireplace surround dressing the (interactive) bookshelf on the right wall */}
      <FireplaceMantel quality={quality} />

      {/* Wall-mounted TV, centered above the mantel/bookshelf */}
      <WallTV quality={quality} />

      {/* Certificate/diploma frames — content is user-configured (Settings panel) */}
      <CertificateWall />

      {/* Cleaning set by the entrance — the object that stands for
          Freshly, a cleaning-services marketplace. Household things live
          near a door, so a bottle and a folded cloth read as something
          set down rather than a prop. See data/projectAnchors.ts. */}
      <CleaningSet />

      {/* Desk */}
      <Desk quality={quality} />

      {/* Rug, under the desk + chair */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.6, -2.03, 2.0]} receiveShadow>
        <circleGeometry args={[1.4, 32]} />
        <meshStandardMaterial map={getRugTexture()} color="#ffffff" roughness={0.95} />
      </mesh>
    </group>
  );
}

const BACK_WALL_BOTTOM = -2.5;
const BACK_WALL_TOP = 5.5;

/**
 * Back wall built from 4 strips around a real rectangular hole for the window.
 *
 * Each strip is its own plane, and a plane's UVs always run 0..1 over its
 * own height — so handing all four the one shared wall material meant each
 * strip replayed the *entire* top-to-bottom wall gradient across its own
 * (much shorter) span. The result was a hard tonal step wherever two strips
 * met: a horizontal line running the full width of the room at the window's
 * top edge, and a vertical one down each side of the window. Every other
 * wall in the room is a single plane spanning the same -2.5..5.5 band, so
 * they were all correct and only this one broke.
 *
 * Fix: give each strip its own clone of the gradient texture (clones share
 * the image, so this costs nothing in memory) with repeat/offset set to the
 * slice of the full wall height that strip actually occupies. The gradient
 * then reads as one continuous wall again — and lines up with the side
 * walls, which span exactly the same range.
 */
function BackWall({ wallMat, quality }: { wallMat: THREE.Material; quality: 'high' | 'medium' | 'low' }) {
  const wallLeft = -7;
  const wallRight = 7;
  const wallBottom = BACK_WALL_BOTTOM;
  const wallTop = BACK_WALL_TOP;
  const wallZ = -3;

  const holeLeft = WINDOW_X - WINDOW_OPEN_HALF_W;
  const holeRight = WINDOW_X + WINDOW_OPEN_HALF_W;
  const holeBottom = WINDOW_Y - WINDOW_OPEN_HALF_H;
  const holeTop = WINDOW_Y + WINDOW_OPEN_HALF_H;

  const slices = useMemo(() => {
    if (quality === 'low') return null;
    const base = getWallGradientTexture();
    const span = wallTop - wallBottom;
    const slice = (y0: number, y1: number) => {
      const tex = base.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, (y1 - y0) / span);
      tex.offset.set(0, (y0 - wallBottom) / span);
      return new THREE.MeshStandardMaterial({ color: '#efe7d8', map: tex, roughness: 0.92 });
    };
    return {
      above: slice(holeTop, wallTop),
      below: slice(wallBottom, holeBottom),
      band: slice(holeBottom, holeTop),
    };
  }, [quality, wallBottom, wallTop, holeBottom, holeTop]);

  const above = slices?.above ?? wallMat;
  const below = slices?.below ?? wallMat;
  const band = slices?.band ?? wallMat;

  return (
    <group>
      {/* Above the opening, full width */}
      <mesh position={[0, (holeTop + wallTop) / 2, wallZ]} receiveShadow>
        <planeGeometry args={[wallRight - wallLeft, wallTop - holeTop]} />
        <primitive object={above} attach="material" />
      </mesh>
      {/* Below the opening, full width */}
      <mesh position={[0, (wallBottom + holeBottom) / 2, wallZ]} receiveShadow>
        <planeGeometry args={[wallRight - wallLeft, holeBottom - wallBottom]} />
        <primitive object={below} attach="material" />
      </mesh>
      {/* Left of the opening, spanning just its height band */}
      <mesh position={[(wallLeft + holeLeft) / 2, WINDOW_Y, wallZ]} receiveShadow>
        <planeGeometry args={[holeLeft - wallLeft, holeTop - holeBottom]} />
        <primitive object={band} attach="material" />
      </mesh>
      {/* Right of the opening, spanning just its height band */}
      <mesh position={[(holeRight + wallRight) / 2, WINDOW_Y, wallZ]} receiveShadow>
        <planeGeometry args={[wallRight - holeRight, holeTop - holeBottom]} />
        <primitive object={band} attach="material" />
      </mesh>
    </group>
  );
}

/**
 * Front wall around the entrance doorway (its hole sized to Entrance.tsx's
 * door frame, arched fanlight included) — built from real BoxGeometry, not
 * thin planes. Every other wall in this room (BackWall, the side walls) is
 * a plane because they only ever need to be seen from one side; this one
 * doesn't have that luxury — the player spawns on its far side (the porch,
 * z > DOOR_Z) and looks back at the door before ever entering, then walks
 * past to see it from the interior (z < DOOR_Z) too. A plane, even a
 * double-sided one, is still a single infinitely-thin sheet — this went
 * through three rounds of material/lighting tweaks trying to make that
 * sheet read as solid from both sides and it kept coming back as a
 * "hole" from one angle or another. A box has no such ambiguity: each of
 * its 6 faces is real geometry with its own outward normal, so it's
 * genuinely opaque from every direction without relying on a shader trick.
 *
 * Thickness (0.4) is deliberately bigger than the door frame's own depth
 * (0.28, see Entrance.tsx) so the wall's front and back faces sit clearly
 * outside the frame's own faces on both sides — no shared coordinate close
 * enough to z-fight, and the frame reads as trim set into a thicker wall,
 * which is how real construction works anyway.
 */
function FrontWall() {
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#efe7d8', roughness: 0.92 }), []);

  const wallLeft = -4.5;
  const wallRight = 4.5;
  // Padded from the door's actual bounds (ceiling at y = 5.4) so there's
  // overlap, not just a flush edge, at the top seam.
  const wallTop = 5.6;
  const wallZ = DOOR_Z;
  const thickness = 0.4;
  // The door frame's posts (Entrance.tsx) span x = ±0.85..±1.05. This hole
  // used to be ±1.1 — 0.05 wider than the frame on each side — which left a
  // pair of full-height slits between the frame's outer edge and the wall's
  // own edge, straight through to the void behind: the thin "empty line"
  // beside the doorway. Tucking the hole edge to ±1.02 puts it *behind* the
  // post (which covers out to ±1.05) with 0.03 of overlap, so the frame
  // reads as trim set into the wall with no line of sight past it.
  const holeLeft = -1.02;
  const holeRight = 1.02;
  const holeBottom = -2.55;
  // The real bug, found by scripts/verify-front-wall.mjs: this used to be
  // 1.75, matching the fanlight ARCH's peak (world y ≈ 1.70) — but the arch
  // is a semicircle, not a rectangle. It only reaches that height at its
  // exact center; everywhere else it curves down toward the frame's top bar
  // (world y ≈ 0.75). The rectangular gap between that curve and a flat
  // holeTop of 1.75 — the spandrel space on either side of the arch — was
  // never covered by ANY geometry: not the arch (curved, doesn't fill its
  // own bounding box), not this "above" panel (which started higher than
  // that). Every previous fix only ever touched the region above 1.75,
  // which was never where the actual hole was. Dropping this to the frame
  // top bar's own height (world y = 0.75, see Entrance.tsx) — with a small
  // overlap margin — means the "above" wall panel now starts low enough to
  // cover that whole spandrel region itself, arch included: the arch is
  // just decorative trim proud of solid wall now, not the only thing
  // between the doorway and open space.
  const holeTop = 0.7;
  const holeMidY = (holeBottom + holeTop) / 2;

  return (
    <group>
      {/* Above the opening, full width — the section repeatedly reported as
          an empty hole; see the component doc comment for what changed. */}
      <mesh position={[0, (holeTop + wallTop) / 2, wallZ]} receiveShadow castShadow>
        <boxGeometry args={[wallRight - wallLeft, wallTop - holeTop, thickness]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      {/* Left of the opening */}
      <mesh position={[(wallLeft + holeLeft) / 2, holeMidY, wallZ]} receiveShadow castShadow>
        <boxGeometry args={[holeLeft - wallLeft, holeTop - holeBottom, thickness]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      {/* Right of the opening */}
      <mesh position={[(holeRight + wallRight) / 2, holeMidY, wallZ]} receiveShadow castShadow>
        <boxGeometry args={[wallRight - holeRight, holeTop - holeBottom, thickness]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
    </group>
  );
}

// Kept in sync with LAMP_INTERACT_POINT in CrosshairInteraction.tsx — that
// file does a point test against the camera's forward ray rather than real
// mesh raycasting (same approach already used there for the door and PC),
// so the two positions have to be updated together if this one ever moves.
// Placed on the interior wall just right of the doorway (door opening spans
// x = -1.1..1.1 at wallZ = DOOR_Z). The wall's interior (room-side) face is
// at z = DOOR_Z - 0.2 = 5.1 — this puts DoorLamp's own group origin (and so
// its backplate, see below) right at that face, not floating off it.
const LAMP_X = 1.75;
const LAMP_Y = 0.35;
const LAMP_Z = DOOR_Z - 0.235;

/**
 * Wall sconce beside the entrance door with its own light switch below it —
 * a player-controlled light, separate from the atmosphere/porch lighting,
 * so the entrance area doesn't have to stay dark until daylight ramps up.
 * The switch (not the sconce itself) is the interactive target;
 * CrosshairInteraction fires onToggleLamp when the player looks at it and
 * presses E/click, same pattern as the door and PC.
 *
 * Split into a real fixture (mounting arm + metal rings + fabric shade +
 * visible bulb) and a real household switch (wall plate, screws, and a
 * rocker that visibly tilts) rather than the single cone-on-a-box/plain-nub
 * placeholder this started as.
 *
 * The whole group is rotated 180° about Y. Every child mesh here (arm,
 * shade, switch faceplate/rocker/bezel) was authored assuming "+local Z
 * points into the room", which is correct on most of this room's walls —
 * but not this one: FrontWall's interior (room-side) face is on the
 * *smaller*-Z side (room extends toward -Z from z = DOOR_Z), the opposite of
 * what +Z-into-the-room assumes. Unrotated, that meant the backplate sat
 * flush-ish but the arm/shade/light were pushed the wrong way — through the
 * wall and toward the exterior/porch, which is both why the fixture looked
 * detached/backwards and why its light spilled outside. A 180° Y rotation
 * mirrors local X/Z (children only ever use X = 0, so nothing shifts
 * sideways) and fixes the direction without touching a single child
 * position.
 */
function DoorLamp({ on }: { on: boolean }) {
  const armMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#4a3b2a', roughness: 0.5, metalness: 0.35 }),
    []
  );
  const ringMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c9a05c', roughness: 0.35, metalness: 0.75 }),
    []
  );
  const shadeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#e8d9b8',
        emissive: on ? '#ffcf8a' : '#2a2318',
        emissiveIntensity: on ? 1.6 : 0,
        roughness: 0.7,
        side: THREE.DoubleSide,
      }),
    [on]
  );
  const bulbMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fff3d6',
        emissive: on ? '#ffedb8' : '#3a3226',
        emissiveIntensity: on ? 2.2 : 0,
        roughness: 0.3,
      }),
    [on]
  );

  return (
    <group position={[LAMP_X, LAMP_Y, LAMP_Z]} rotation={[0, Math.PI, 0]}>
      {/* Backplate, flush against the wall */}
      <mesh position={[0, 0, -0.015]} castShadow>
        <boxGeometry args={[0.1, 0.14, 0.02]} />
        <primitive object={armMat} attach="material" />
      </mesh>

      {/* Mounting arm, standing the shade proud of the wall */}
      <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.018, 0.018, 0.12, 10]} />
        <primitive object={armMat} attach="material" />
      </mesh>

      {/* Shade: open fabric cylinder between two thin brass rings.
          The cylinder used to carry rotation={[Math.PI / 2, 0, 0]}, laying
          its axis down horizontally so the shade pointed its open mouth
          straight at the room — a drum lying on its side, not a sconce.
          That also stranded the two rings: they sit at local y = ±0.095,
          i.e. at the cylinder's own top and bottom rims (and their radii,
          0.1 and 0.13, are exactly the cylinder's radiusTop/radiusBottom),
          which only lines up when the axis is vertical. With the rotation
          gone, the rings cap the rims as intended and the bulb below sits
          in the downward opening. */}
      <group position={[0, 0, 0.15]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.1, 0.13, 0.19, 16, 1, true]} />
          <primitive object={shadeMat} attach="material" />
        </mesh>
        <mesh position={[0, 0.095, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.1, 0.006, 8, 20]} />
          <primitive object={ringMat} attach="material" />
        </mesh>
        <mesh position={[0, -0.095, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13, 0.006, 8, 20]} />
          <primitive object={ringMat} attach="material" />
        </mesh>
        {/* Visible bulb, peeking out the bottom opening */}
        <mesh position={[0, -0.05, 0]}>
          <sphereGeometry args={[0.045, 12, 10]} />
          <primitive object={bulbMat} attach="material" />
        </mesh>
      </group>

      {/* Spotlight, not a pointLight: a pointLight here (undirected, and not
          shadow-casting) radiated equally in every direction, including
          straight through the wall to the exterior/porch side — a spotlight
          only ever illuminates within its own cone, so aiming that cone into
          the room is enough on its own to keep the light off the exterior,
          with no shadow-casting (expensive for one small fixture) required.
          No explicit target: an unset spotLight target defaults to world
          (0, 0, 0), which — same trick already used for LibraryLighting's
          `rim` spotlight — sits roughly at the room's center, so the cone
          from this wall-mounted position naturally aims inward. */}
      {on && (
        <spotLight
          position={[0, 0, 0.15]}
          intensity={1.3}
          color="#ffcf8a"
          distance={4.2}
          decay={2}
          angle={0.9}
          penumbra={0.6}
        />
      )}

      <LightSwitch on={on} />
    </group>
  );
}

/**
 * A household-style toggle switch, low on the wall below the sconce — the
 * actual clickable target (see LAMP_INTERACT_POINT above, which points at
 * this group's world position, unchanged from the plain-nub placeholder).
 * Modeled as a real fixture would be: a faceplate proud of the wall, two
 * mounting screws, a recessed bezel, and a rocker that visibly tilts
 * on/off with a small lit indicator dot.
 */
function LightSwitch({ on }: { on: boolean }) {
  const plateMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2ecdd', roughness: 0.45 }), []);
  const bezelMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8cba8', roughness: 0.6 }), []);
  const screwMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8a7f68', roughness: 0.3, metalness: 0.6 }),
    []
  );
  const rockerMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#faf6ea', roughness: 0.35 }), []);
  const indicatorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: on ? '#7bd88f' : '#3a2e22',
        emissive: on ? '#4fae66' : '#000000',
        emissiveIntensity: on ? 1.2 : 0,
        roughness: 0.4,
      }),
    [on]
  );

  return (
    // World y = LAMP_Y - 1.15 = -0.8, i.e. 1.25 m above the floor (FLOOR_Y
    // = -2.05) — switch height. The old -0.45 offset put it at 1.95 m,
    // level with the top of a door frame and well above where a hand
    // reaches, which is why it read as a plate floating under the sconce
    // rather than a switch on the wall. Kept in sync with
    // LAMP_INTERACT_POINT in CrosshairInteraction.tsx.
    <group position={[0, -1.15, 0.01]}>
      {/* Faceplate, proud of the wall */}
      <mesh castShadow>
        <boxGeometry args={[0.14, 0.2, 0.014]} />
        <primitive object={plateMat} attach="material" />
      </mesh>
      {/* Mounting screws, top and bottom center */}
      <mesh position={[0, 0.085, 0.009]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.004, 8]} />
        <primitive object={screwMat} attach="material" />
      </mesh>
      <mesh position={[0, -0.085, 0.009]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.004, 8]} />
        <primitive object={screwMat} attach="material" />
      </mesh>
      {/* Recessed bezel around the rocker */}
      <mesh position={[0, 0, 0.008]}>
        <boxGeometry args={[0.08, 0.13, 0.006]} />
        <primitive object={bezelMat} attach="material" />
      </mesh>
      {/* Rocker — tilts up when on, down when off, so the state reads at a
          glance even before the sconce light itself registers. */}
      <mesh position={[0, on ? 0.028 : -0.028, 0.017]} rotation={[on ? -0.3 : 0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.06, 0.1, 0.022]} />
        <primitive object={rockerMat} attach="material" />
      </mesh>
      {/* Small lit indicator dot, the kind real rockers carry */}
      <mesh position={[0, -0.085, 0.016]}>
        <circleGeometry args={[0.006, 10]} />
        <primitive object={indicatorMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Wainscoting: a tiled band of raised-panel frames + a chair-rail cap on the back wall. */
function FramedWallPanels() {
  const frameMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 0.55 }), []);
  const fillMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.75 }), []);

  const bandBottom = -1.9;
  const bandTop = -1.0;
  const height = bandTop - bandBottom;
  const midY = (bandBottom + bandTop) / 2;
  const panelWidth = 0.7;
  const gap = 0.18;
  const step = panelWidth + gap;
  const halfSpan = 4.1;
  const count = Math.floor((halfSpan * 2) / step);
  const startX = -((count - 1) * step) / 2;
  const wallZ = -2.97;

  return (
    <group>
      {/* Chair-rail cap along the top of the band */}
      <mesh position={[0, bandTop + 0.03, wallZ]} castShadow>
        <boxGeometry args={[halfSpan * 2 + 0.3, 0.05, 0.04]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      {Array.from({ length: count }, (_, i) => startX + i * step).map((x, i) => (
        <group key={i} position={[x, midY, wallZ]}>
          <mesh position={[0, 0, -0.008]}>
            <planeGeometry args={[panelWidth - 0.08, height - 0.08]} />
            <primitive object={fillMat} attach="material" />
          </mesh>
          <mesh position={[0, height / 2 - 0.02, 0]}>
            <boxGeometry args={[panelWidth, 0.04, 0.02]} />
            <primitive object={frameMat} attach="material" />
          </mesh>
          <mesh position={[0, -height / 2 + 0.02, 0]}>
            <boxGeometry args={[panelWidth, 0.04, 0.02]} />
            <primitive object={frameMat} attach="material" />
          </mesh>
          <mesh position={[-panelWidth / 2 + 0.02, 0, 0]}>
            <boxGeometry args={[0.04, height, 0.02]} />
            <primitive object={frameMat} attach="material" />
          </mesh>
          <mesh position={[panelWidth / 2 - 0.02, 0, 0]}>
            <boxGeometry args={[0.04, height, 0.02]} />
            <primitive object={frameMat} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// World Y for "hung at eye level": FLOOR_Y (-2.05) + PLAYER_EYE_HEIGHT (1.6)
// from collision.ts = -0.45. A little above that (art is usually hung with
// its center slightly above eye height, not dead-on) reads more natural.
const FRAME_EYE_LEVEL_Y = -0.3;

/**
 * Exactly two frames flanking the single existing window, one on each side,
 * at the same height as the window's own center — never above or below it.
 * Uses the same PictureFrame component/style as every other frame in the
 * room, backed by the same certificate customization system (slots
 * frame-5/frame-6, distinct from CertificateWall's left-wall frame-1..4).
 * Positions are derived from the window's own constants (WINDOW_X/W/Y) so
 * they stay correctly balanced if the window ever moves — the window itself
 * is untouched here.
 */
function WindowFrames() {
  const { certificates } = useCustomization();
  const left = certificates.find((c) => c.id === 'frame-5');
  const right = certificates.find((c) => c.id === 'frame-6');

  const frameWidth = 0.85;
  const frameHeight = 1.1;
  const gap = 0.4; // breathing room from the window's own edge, each side
  const windowHalfW = WINDOW_W / 2;
  const z = -2.95; // matches the back wall baseboard's own proud-of-wall offset

  const leftX = WINDOW_X - windowHalfW - gap - frameWidth / 2;
  const rightX = WINDOW_X + windowHalfW + gap + frameWidth / 2;

  return (
    <group>
      {left && (
        <PictureFrame position={[leftX, WINDOW_Y, z]} width={frameWidth} height={frameHeight} image={left.image} />
      )}
      {right && (
        <PictureFrame position={[rightX, WINDOW_Y, z]} width={frameWidth} height={frameHeight} image={right.image} />
      )}
    </group>
  );
}

/**
 * The four certificate/diploma frames, all on the left wall, at eye level,
 * two flanking each side of the (re-centered) bed: frame-1/frame-2 sit
 * before it (z < bed center), frame-3/frame-4 after it (z > bed center),
 * both pairs spaced off the bed's own footprint (z 0.35..1.95, see Bed())
 * so nothing overlaps it. Content is entirely user-driven
 * (CustomizationProvider / the Settings panel); this component just places
 * the physical frames and feeds each one whatever image + title is stored
 * for its slot.
 *
 * Every z here is kept well clear of DOOR_Z (5.3): the entrance wall
 * (FrontWall, below) has a solid segment crossing this same wall's plane
 * exactly there, and a frame whose width straddled that line rendered half
 * embedded in the wall, half poking through to the porch beyond it — z=4.9
 * (spanning ~4.48–5.33) did exactly that.
 */
function CertificateWall() {
  const { certificates } = useCustomization();
  const zPositions = [-1.6, -0.4, 2.7, 3.9];

  return (
    <group>
      {certificates.map((c, i) => (
        <PictureFrame
          key={c.id}
          position={[-4.44, FRAME_EYE_LEVEL_Y, zPositions[i]]}
          rotation={[0, Math.PI / 2, 0]}
          width={0.85}
          height={1.1}
          image={c.image}
        />
      ))}
    </group>
  );
}

/**
 * Dresses the (still fully interactive) bookshelf as a floating, wall-hung
 * fireplace surround: a recessed firebox insert, wall corbel brackets,
 * flanking pilasters, and a mantel shelf — no part of it touches the floor.
 * Shares the shelf's exact transform (from bookLayout.ts) so it lines up
 * with the case regardless of where that ends up.
 */
function FireplaceMantel({ quality }: { quality: 'high' | 'medium' | 'low' }) {
  const stoneMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cbbfa0', roughness: 0.82 }), []);
  const darkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1c1712', roughness: 0.9 }), []);
  const brassMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#c9a05c', metalness: 0.85, roughness: 0.25 }),
    []
  );

  const caseCenterY = SHELF_BOTTOM + CASE_HEIGHT / 2;
  const caseTopY = SHELF_BOTTOM + CASE_HEIGHT;
  const pierX = CASE_WIDTH / 2 + 0.16;
  const mantelY = caseTopY + 0.06;
  const frontZ = CASE_DEPTH / 2;
  const backZ = -CASE_DEPTH / 2;
  // Firebox sits recessed into the case front (not a floor grate) — the case
  // floats now, so nothing at floor level should read as "the fire."
  const fireboxY = SHELF_BOTTOM + 0.09;

  return (
    <group position={[SHELF_GROUP_OFFSET_X, 0, SHELF_GROUP_OFFSET_Z]} rotation={[0, SHELF_GROUP_ROTATION_Y, 0]}>
      {/* Firebox: dark recessed insert with a brass surround, set into the case front */}
      <mesh position={[0, fireboxY, frontZ + 0.005]}>
        <boxGeometry args={[0.56, 0.16, 0.02]} />
        <primitive object={darkMat} attach="material" />
      </mesh>
      <mesh position={[0, fireboxY, frontZ + 0.016]}>
        <boxGeometry args={[0.62, 0.02, 0.012]} />
        <primitive object={brassMat} attach="material" />
      </mesh>
      {quality !== 'low' && (
        <pointLight position={[0, fireboxY, frontZ + 0.06]} intensity={0.5} color="#e8763a" distance={1.4} decay={2} />
      )}

      {/* Wall corbel brackets: the visible support reading as what's actually
          holding the case up, in place of a floor-set hearth */}
      {[-pierX * 0.62, pierX * 0.62].map((x, i) => (
        <mesh key={i} position={[x, SHELF_BOTTOM - 0.05, backZ + 0.1]} rotation={[0.55, 0, 0]} castShadow>
          <boxGeometry args={[0.08, 0.16, 0.05]} />
          <primitive object={stoneMat} attach="material" />
        </mesh>
      ))}

      {/* Surround pilasters flanking the case, hung level with it — no floor contact */}
      {[-pierX, pierX].map((x, i) => (
        <mesh key={i} position={[x, caseCenterY - 0.05, frontZ - 0.06]} castShadow receiveShadow>
          <boxGeometry args={[0.18, CASE_HEIGHT + 0.3, 0.2]} />
          <primitive object={stoneMat} attach="material" />
        </mesh>
      ))}

      {/* Mantel shelf above the case */}
      <mesh position={[0, mantelY, frontZ - 0.02]} castShadow receiveShadow>
        <boxGeometry args={[CASE_WIDTH + 0.5, 0.07, CASE_DEPTH + 0.34]} />
        <primitive object={stoneMat} attach="material" />
      </mesh>
      <mesh position={[0, mantelY + 0.045, frontZ - 0.02]}>
        <boxGeometry args={[CASE_WIDTH + 0.44, 0.012, 0.012]} />
        <primitive object={brassMat} attach="material" />
      </mesh>
    </group>
  );
}

/**
 * Wall-mounted TV, centered above the mantel — shares the bookshelf's exact
 * transform (bookLayout.ts) so it stays correctly positioned regardless of
 * where that ends up, same approach as FireplaceMantel/CertificateWall.
 * Mounted flush near the wall (unlike the mantel/hearth, which is proud of
 * it), well clear of the mantel shelf below and the ceiling above.
 */
const TV_TITLE_CANVAS_W = 512;
const TV_TITLE_CANVAS_H = 96;

/** Redrawn only when the current project (or status) changes — not per frame. */
function drawTvTitleBar(
  ctx: CanvasRenderingContext2D,
  state: { status: 'loading' | 'playing' | 'unavailable'; title: string; stack: string }
) {
  const w = TV_TITLE_CANVAS_W;
  const h = TV_TITLE_CANVAS_H;
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'top';

  ctx.font = '600 15px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#5b8fd9';
  ctx.fillText('AHMED · PROJECT SHOWCASE', 18, 12);

  if (!state.title) {
    ctx.font = '14px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#5a6472';
    ctx.fillText('No projects added yet', 18, 40);
    return;
  }

  ctx.font = '600 20px ui-serif, Georgia, serif';
  ctx.fillStyle = '#f2ede1';
  ctx.fillText(state.title, 18, 38);
  ctx.font = '14px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#8ab4f8';
  ctx.fillText(state.stack, 18, 66);
}

/** The main screen's fallback slide (title + stack + description), drawn whenever there's no video to play — this is the normal, permanent state until real screen-recordings are added, not an error state, so it reads as a designed showcase card rather than a "no signal" message. */
function drawProjectSlide(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  project: { title: string; stack: string; description: string } | null
) {
  ctx.clearRect(0, 0, w, h);
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#0d1420');
  gradient.addColorStop(1, '#050810');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  if (!project) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3d4a5c';
    ctx.font = '600 22px ui-monospace, Menlo, monospace';
    ctx.fillText('NO PROJECTS YET', w / 2, h / 2);
    return;
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#c9a05c';
  ctx.font = '600 15px ui-monospace, Menlo, monospace';
  ctx.fillText('FEATURED PROJECT', 32, 48);

  ctx.fillStyle = '#f2ede1';
  ctx.font = '600 34px ui-serif, Georgia, serif';
  ctx.fillText(project.title, 32, 88);

  ctx.fillStyle = '#8ab4f8';
  ctx.font = '15px ui-monospace, Menlo, monospace';
  ctx.fillText(project.stack, 32, 138);

  ctx.fillStyle = '#c7cdd6';
  ctx.font = '16px ui-serif, Georgia, serif';
  const words = project.description.split(' ');
  const maxWidth = w - 64;
  let line = '';
  let y = 180;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, 32, y);
      line = word;
      y += 26;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, 32, y);
}

/**
 * Wall-mounted TV, centered above the mantel. Plays real video when a file
 * exists at a project's `src` (fed into the screen as a THREE.VideoTexture);
 * falls back to a designed canvas slide (title/stack/description) per
 * project, cycling on a timer, when it doesn't — see useProjectShowcase.ts.
 * A thin canvas-texture title bar along the bottom (project name + stack)
 * redraws only when the current project changes, not every frame — the
 * video texture is the only thing that needs a per-frame update.
 */
function WallTV({ quality }: { quality: 'high' | 'medium' | 'low' }) {
  const { texture: videoTexture, current, status } = useProjectShowcase();

  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#16171b', roughness: 0.35, metalness: 0.4 }),
    []
  );
  const bracketMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2b2b2e', roughness: 0.5, metalness: 0.6 }),
    []
  );

  // Fallback screen — same canvas, reused as the video plane's own material
  // whenever there's no video to play. No video files ship with the project,
  // so this is the TV's normal, permanent state today: a designed slide per
  // project (title/stack/description), cycling on the timer in
  // useProjectShowcase, not a "no signal" error screen.
  const idleCanvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 320;
    return c;
  }, []);
  const idleTexture = useMemo(() => {
    const t = new THREE.CanvasTexture(idleCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [idleCanvas]);
  useEffect(() => {
    const ctx = idleCanvas.getContext('2d');
    if (!ctx) return;
    drawProjectSlide(ctx, idleCanvas.width, idleCanvas.height, current);
    idleTexture.needsUpdate = true;
  }, [idleCanvas, idleTexture, current]);

  const screenMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#000000',
        emissive: '#ffffff',
        emissiveIntensity: 0.7,
        roughness: 0.2,
        metalness: 0.05,
      }),
    []
  );
  useEffect(() => {
    const useVideo = status !== 'unavailable';
    screenMat.map = useVideo ? videoTexture : idleTexture;
    screenMat.emissiveMap = useVideo ? videoTexture : idleTexture;
    screenMat.needsUpdate = true;
  }, [screenMat, videoTexture, idleTexture, status]);

  const titleCanvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = TV_TITLE_CANVAS_W;
    c.height = TV_TITLE_CANVAS_H;
    return c;
  }, []);
  const titleTexture = useMemo(() => {
    const t = new THREE.CanvasTexture(titleCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [titleCanvas]);
  useEffect(() => {
    const ctx = titleCanvas.getContext('2d');
    if (!ctx) return;
    drawTvTitleBar(ctx, { status, title: current?.title ?? '', stack: current?.stack ?? '' });
    titleTexture.needsUpdate = true;
  }, [titleCanvas, titleTexture, status, current]);
  const titleMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: titleTexture, emissive: '#ffffff', emissiveMap: titleTexture, emissiveIntensity: 0.6 }),
    [titleTexture]
  );

  // Only the video texture needs per-frame updates (the canvas ones are
  // event-driven above); harmless if VideoTexture's own auto-update already
  // covers it — this just guarantees it regardless of three.js version.
  useFrame(() => {
    if (status === 'playing') videoTexture.needsUpdate = true;
  });

  const caseTopY = SHELF_BOTTOM + CASE_HEIGHT;
  const mantelTopY = caseTopY + 0.06 + 0.035; // mantel shelf's own top, matching FireplaceMantel
  const width = 1.7;
  const height = 0.95;
  const bodyDepth = 0.05;
  const bezelT = 0.04;
  const gapAboveMantel = 0.34;
  const centerY = mantelTopY + gapAboveMantel + height / 2;
  const wallZ = -CASE_DEPTH / 2 - 0.01;

  const titleBarH = height * 0.16;
  const videoH = height - bezelT * 2 - titleBarH;
  const contentW = width - bezelT * 2;

  return (
    <group position={[SHELF_GROUP_OFFSET_X, centerY, SHELF_GROUP_OFFSET_Z]} rotation={[0, SHELF_GROUP_ROTATION_Y, 0]}>
      {/* Mounting bracket arm, wall to TV back */}
      <mesh position={[0, 0, wallZ + bodyDepth / 2 - 0.035]} castShadow>
        <boxGeometry args={[0.1, 0.07, 0.07]} />
        <primitive object={bracketMat} attach="material" />
      </mesh>
      {/* TV body / bezel */}
      <mesh position={[0, 0, wallZ]} castShadow>
        <boxGeometry args={[width, height, bodyDepth]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>
      {/* Main screen: the project video (or the idle "no signal" canvas) */}
      <mesh position={[0, titleBarH / 2, wallZ + bodyDepth / 2 + 0.002]}>
        <planeGeometry args={[contentW, videoH]} />
        <primitive object={screenMat} attach="material" />
      </mesh>
      {/* Title bar: project name + stack, along the bottom */}
      <mesh position={[0, -height / 2 + bezelT + titleBarH / 2, wallZ + bodyDepth / 2 + 0.002]}>
        <planeGeometry args={[contentW, titleBarH]} />
        <primitive object={titleMat} attach="material" />
      </mesh>
      {quality !== 'low' && (
        <pointLight
          position={[0, 0, wallZ + 0.15]}
          intensity={0.35}
          color="#8a9aab"
          distance={1.6}
          decay={2}
        />
      )}
    </group>
  );
}

function Window({ quality }: { quality: 'high' | 'medium' | 'low' }) {
  const w = WINDOW_W;
  const h = WINDOW_H;

  const glassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1c2c3d',
        emissive: '#3c5d78',
        emissiveIntensity: quality === 'low' ? 0.32 : 0.5,
        roughness: 0.1,
        metalness: 0.2,
      }),
    [quality]
  );

  const trimMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e3d3b0', roughness: 0.72 }), []);
  const revealMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9b98f', roughness: 0.85 }), []);
  const mullionMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2e2418', roughness: 0.5 }), []);

  // The bug: the glass plane used to sit at local z = 0, and this whole group
  // is positioned at z = -3 — exactly the back wall's own z. Two large,
  // same-size, same-position faces fighting for the same depth-buffer value
  // is textbook z-fighting, and it's what read as "shaking". Fix: recess the
  // glass into a real reveal behind the wall plane instead of sitting on it.
  const wallZ = 0;
  const glassZ = -0.13;
  const mullionZ = -0.11;
  const revealZ = -0.065;
  const revealDepth = 0.13;
  const casingZ = 0.03;

  return (
    // Centered above the bookshelf/arch, flush on the back wall — matches the
    // real hole cut into BackWall exactly, so the recessed glass is actually visible.
    <group position={[WINDOW_X, WINDOW_Y, -3]}>
      {/* Glass, recessed behind the wall plane — subtly glossy so it catches
          specular light instead of glowing flat */}
      <mesh position={[0, 0, glassZ]}>
        <planeGeometry args={[w, h]} />
        <primitive object={glassMat} attach="material" />
      </mesh>

      {/* Mullions, sitting just proud of the glass with real depth.
          No shadow participation: dynamic self-shadowing on this much thin,
          closely-stacked trim geometry is its own source of shimmer, and the
          window doesn't need it to read correctly. */}
      <mesh position={[0, 0, mullionZ]}>
        <boxGeometry args={[w * 1.01, 0.06, 0.04]} />
        <primitive object={mullionMat} attach="material" />
      </mesh>
      <mesh position={[0, 0, mullionZ]}>
        <boxGeometry args={[0.06, h * 1.01, 0.04]} />
        <primitive object={mullionMat} attach="material" />
      </mesh>

      {/* Reveal: the recessed sides connecting the wall opening to the glass. */}
      <mesh position={[-w / 2 - 0.03, 0, revealZ]}>
        <boxGeometry args={[0.06, h + 0.06, revealDepth]} />
        <primitive object={revealMat} attach="material" />
      </mesh>
      <mesh position={[w / 2 + 0.03, 0, revealZ]}>
        <boxGeometry args={[0.06, h + 0.06, revealDepth]} />
        <primitive object={revealMat} attach="material" />
      </mesh>
      <mesh position={[0, h / 2 + 0.03, revealZ]}>
        <boxGeometry args={[w + 0.12, 0.06, revealDepth]} />
        <primitive object={revealMat} attach="material" />
      </mesh>

      {/* Casing: flush wall trim, standing proud of the wall face */}
      <mesh position={[-w / 2 - 0.09, 0, casingZ]}>
        <boxGeometry args={[0.09, h + 0.24, 0.05]} />
        <primitive object={trimMat} attach="material" />
      </mesh>
      <mesh position={[w / 2 + 0.09, 0, casingZ]}>
        <boxGeometry args={[0.09, h + 0.24, 0.05]} />
        <primitive object={trimMat} attach="material" />
      </mesh>
      <mesh position={[0, h / 2 + 0.09, casingZ]}>
        <boxGeometry args={[w + 0.3, 0.09, 0.05]} />
        <primitive object={trimMat} attach="material" />
      </mesh>

      {quality !== 'low' && (
        <pointLight position={[0, 0, 0.4]} intensity={1.7} color="#5b7fa6" distance={6} />
      )}

      {/* Sill, sticking out below the opening, well in front of the wall plane */}
      <mesh position={[0, -h / 2 - 0.07, wallZ + 0.14]}>
        <boxGeometry args={[w + 0.32, 0.06, 0.3]} />
        <meshStandardMaterial color="#3a2e22" roughness={0.6} />
      </mesh>

      {/* Small potted plant, grounded on the sill off to one side */}
      <WindowsillPlant top={-h / 2 - 0.07 + 0.03} sillZ={wallZ + 0.14} />

      {/* Light shaft spilling in from the window, falling toward the floor.
          Second pass on this: the first fix (just negating the rotation
          sign) put the beam's top edge in the right vertical band but still
          ~0.2-0.3 units proud of the wall face — enough of a gap, at some
          viewing angles, to still read as disconnected from the glass. This
          version solves position+height together so the *top* edge lands
          at local (y = 0.6, z = 0), i.e. world z = -3 — exactly the back
          wall's own plane, inside the window reveal, not floating in front
          of it — while the *bottom* edge lands at local (y = -2.0, z ≈ 1.59),
          well down toward the floor (floor is at local/world y ≈ -2.70/-2.05)
          and well into the room. Solving both ends at once (rather than
          picking a position/size and checking where the edges land) is what
          actually guarantees the top edge sits flush against the window
          instead of merely "close". */}
      {quality !== 'low' && (
        <mesh position={[0, -0.7, 0.8]} rotation={[-0.55, 0, 0]}>
          <planeGeometry args={[1.5, 3.05]} />
          {/* The plane's placement is unchanged — what was wrong was that it
              had no falloff at all, so all four of its edges were hard,
              straight cuts. That's what read as a translucent panel and
              what drew the crisp line across the wainscoting where the
              shaft simply stopped. getLightShaftTexture() paints the
              feathered sides and the fade-out along its length directly
              into the map; under additive blending its black end
              contributes nothing, so the beam now dissolves instead of
              ending. */}
          <meshBasicMaterial
            map={getLightShaftTexture()}
            color="#cfe0ee"
            transparent
            opacity={0.62}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
}

/** A small potted plant, sized and grounded to rest on the window's own sill. */
function WindowsillPlant({ top, sillZ }: { top: number; sillZ: number }) {
  const potH = 0.13;
  const x = -0.62;
  const z = sillZ + 0.02;

  return (
    <group position={[x, top, z]}>
      <mesh position={[0, potH / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.075, 0.06, potH, 14]} />
        <meshStandardMaterial color="#8a5638" roughness={0.85} />
      </mesh>
      <mesh position={[0, potH + 0.008, 0]} castShadow>
        <cylinderGeometry args={[0.078, 0.072, 0.016, 14]} />
        <meshStandardMaterial color="#7a4a2e" roughness={0.85} />
      </mesh>
      {[
        [0, 0.26, 0, 0.09],
        [0.05, 0.23, 0.03, 0.07],
        [-0.05, 0.22, -0.02, 0.065],
        [0.01, 0.29, -0.04, 0.06],
      ].map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px, py, pz]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#5f7350' : '#6d8460'} roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Bed({ quality }: { quality: 'high' | 'medium' | 'low' }) {
  const frameMat = useMemo(() => {
    const map = quality === 'low' ? null : getWoodTexture('bed', { base: '#4a3b2a', grain: '#241a10', repeat: [2, 1] });
    return new THREE.MeshStandardMaterial({ color: '#4a3b2a', map, roughness: 0.55 });
  }, [quality]);
  const mattressMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ece2cc', roughness: 0.9 }), []);
  const duvetMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cdbd98', roughness: 0.95 }), []);
  const pillowMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f3ead9', roughness: 0.85 }), []);

  const length = 2.0; // head-to-foot, along local X
  const width = 1.6; // across, along local Z
  const frameH = 0.3;
  const mattressH = 0.2;

  return (
    // Still the left wall (x = -4.5, unchanged) — only the along-wall axis
    // moved. For this wall, "along the wall" is world Z (the wall runs from
    // the back wall at z = -3 to the entrance wall at z = 5.3, same 8.3-long
    // open run the bookshelf centers on for the opposite wall — see
    // SHELF_GROUP_OFFSET_Z in bookLayout.ts), not X: X stays fixed to keep
    // the headboard flush against the wall. z = 1.15 is that run's center,
    // putting the bed in the middle of the wall with CertificateWall's four
    // frames (below) split two-and-two on either side of it.
    <group position={[-4.5 + 0.08 + length / 2, -2.05, 1.15]}>
      {/* Frame */}
      <mesh position={[0, frameH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, frameH, width]} />
        <primitive object={frameMat} attach="material" />
      </mesh>
      {/* Headboard */}
      <mesh position={[-length / 2 - 0.04, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.08, 0.9, width + 0.1]} />
        <primitive object={frameMat} attach="material" />
      </mesh>

      {/* Mattress: two stacked layers, the top one slightly inset, to fake soft rounded edges */}
      <mesh position={[0, frameH + mattressH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length * 0.97, mattressH, width * 0.97]} />
        <primitive object={mattressMat} attach="material" />
      </mesh>
      <mesh position={[0, frameH + mattressH + 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[length * 0.93, 0.04, width * 0.93]} />
        <primitive object={mattressMat} attach="material" />
      </mesh>

      {/* Pillows: two layers each, tilted against the headboard for a plump look */}
      {[-0.36, 0.36].map((z, i) => (
        <group key={i} position={[-length / 2 + 0.32, frameH + mattressH + 0.02, z]} rotation={[0, 0, 0.09]}>
          <mesh position={[0, 0.08, 0]} castShadow>
            <boxGeometry args={[0.4, 0.14, 0.32]} />
            <primitive object={pillowMat} attach="material" />
          </mesh>
          <mesh position={[0.01, 0.17, 0]} castShadow>
            <boxGeometry args={[0.34, 0.08, 0.26]} />
            <primitive object={pillowMat} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Duvet: overhangs the mattress on both long sides and the foot, with a
          folded-back turn near the pillows and a soft drape at the foot edge. */}
      <mesh position={[0.24, frameH + mattressH + 0.075, 0]} castShadow receiveShadow>
        <boxGeometry args={[length * 0.76, 0.11, width * 1.05]} />
        <primitive object={duvetMat} attach="material" />
      </mesh>
      {/* Fold ridges across the duvet, breaking up the flat top */}
      {[-0.4, 0.05, 0.55].map((x, i) => (
        <mesh key={i} position={[x, frameH + mattressH + 0.135, 0]} rotation={[0, 0, i % 2 === 0 ? 0.02 : -0.02]}>
          <boxGeometry args={[0.05, 0.018, width * 1.0]} />
          <primitive object={duvetMat} attach="material" />
        </mesh>
      ))}
      {/* Fold crease where the duvet turns back below the pillows */}
      <mesh position={[-length / 2 + 0.58, frameH + mattressH + 0.1, 0]} castShadow>
        <boxGeometry args={[0.06, 0.06, width * 0.98]} />
        <primitive object={duvetMat} attach="material" />
      </mesh>
      {/* Drape at the foot: a downward-angled flap so the duvet reads as
          hanging over the edge instead of stopping in a flat plane */}
      <mesh
        position={[length / 2 - 0.04, frameH + mattressH - 0.01, 0]}
        rotation={[0, 0, -0.5]}
        castShadow
      >
        <boxGeometry args={[0.16, 0.08, width * 1.03]} />
        <primitive object={duvetMat} attach="material" />
      </mesh>
    </group>
  );
}

function Nightstand({ quality }: { quality: 'high' | 'medium' | 'low' }) {
  const { photo } = useCustomization();
  const tableMat = useMemo(() => {
    const map = quality === 'low' ? null : getWoodTexture('nightstand', { base: '#4a3b2a', grain: '#241a10', repeat: [1, 1] });
    return new THREE.MeshStandardMaterial({ color: '#4a3b2a', map, roughness: 0.55 });
  }, [quality]);
  const bookMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b3f37', roughness: 0.55 }), []);

  const tableW = 0.5;
  const tableD = 0.4;
  const tableH = 0.45;
  const legInset = 0.04;

  return (
    // Beside the bed's head end — kept at the same +1.1 z offset from the
    // bed's own z (now 1.15, re-centered on the wall) that this always had,
    // so the two move together.
    <group position={[-4.15, -2.05, 2.25]}>
      {/* Tabletop */}
      <mesh position={[0, tableH - 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[tableW, 0.04, tableD]} />
        <primitive object={tableMat} attach="material" />
      </mesh>
      {/* Legs */}
      {[
        [-tableW / 2 + legInset, -tableD / 2 + legInset],
        [tableW / 2 - legInset, -tableD / 2 + legInset],
        [-tableW / 2 + legInset, tableD / 2 - legInset],
        [tableW / 2 - legInset, tableD / 2 - legInset],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, (tableH - 0.04) / 2, z]} castShadow>
          <boxGeometry args={[0.04, tableH - 0.04, 0.04]} />
          <primitive object={tableMat} attach="material" />
        </mesh>
      ))}
      {/* Closed book, resting flat and slightly turned on top */}
      <mesh position={[0.05, tableH + 0.0175, -0.03]} rotation={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.19, 0.035, 0.24]} />
        <primitive object={bookMat} attach="material" />
      </mesh>

      {/* Phone, face-up on the nightstand. The only object added for the
          project-showcase feature: Spendora is a finance mobile app and
          nothing in the room represented a phone, while a phone on a
          nightstand is about as unremarkable as bedroom furniture gets.
          See data/projectAnchors.ts for why the other two anchors reuse
          objects that were already here. */}
      <NightstandPhone y={tableH + 0.004} />

      {/* Small standing photo frame, opposite the book — content is
          user-configured (Settings panel). The nightstand sits against the
          left wall (x = -4.5) with the room open toward +X; rotated to
          roughly 90° (matching the wall-mounted frames' own convention)
          with a slight turn, so it faces out into the room, angled a touch
          toward the bed. */}
      <PictureFrame
        position={[-0.14, tableH + 0.115, 0.07]}
        rotation={[0, Math.PI / 2 - 0.35, 0]}
        width={0.14}
        height={0.18}
        image={photo}
        frameThickness={0.018}
        depth={0.016}
        castShadow={false}
      />
    </group>
  );
}

function Desk({ quality }: { quality: 'high' | 'medium' | 'low' }) {
  const topMat = useMemo(() => {
    const map = quality === 'low' ? null : getWoodTexture('desk', { base: '#5b4636', grain: '#2f231a', repeat: [2, 1] });
    return new THREE.MeshStandardMaterial({ color: '#5b4636', map, roughness: 0.42, metalness: 0.04 });
  }, [quality]);

  return (
    <group position={[1.9, -1.35, 1.9]} rotation={[0, -0.35, 0]}>
      {/* Tabletop */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.06, 0.75]} />
        <primitive object={topMat} attach="material" />
      </mesh>
      {/* Legs */}
      {[
        [-0.68, -0.35, -0.32],
        [0.68, -0.35, -0.32],
        [-0.68, -0.35, 0.32],
        [0.68, -0.35, 0.32],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <boxGeometry args={[0.06, 0.7, 0.06]} />
          <meshStandardMaterial color="#3a2e22" roughness={0.6} />
        </mesh>
      ))}
      {/* Lamp — base sits flush on the desk surface (y = 0.03), stem and shade stack up from there */}
      <mesh position={[-0.5, 0.05, -0.2]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.04, 16]} />
        <meshStandardMaterial color="#c9a05c" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[-0.5, 0.27, -0.2]} castShadow>
        <cylinderGeometry args={[0.01, 0.01, 0.4, 8]} />
        <meshStandardMaterial color="#3a2e22" />
      </mesh>
      <mesh position={[-0.5, 0.56, -0.2]} castShadow>
        <coneGeometry args={[0.13, 0.18, 16, 1, true]} />
        <meshStandardMaterial
          color="#f2e3c4"
          emissive="#f2c87a"
          emissiveIntensity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      <pointLight position={[-0.5, 0.5, -0.2]} intensity={1.1} color="#f2c87a" distance={2.5} />
      {/* Soft warm bounce from the lamp onto the desktop */}
      <pointLight position={[-0.15, 0.12, -0.05]} intensity={0.35} color="#f6d9a0" distance={1.1} decay={2} />

      <Laptop />

      {/* Small book stack, resting flush on the desk surface. This is the
          object standing for Prowise; the screwdriver across it adds the
          maintenance half of "guides and repair info". */}
      <group position={[0.55, 0.03, -0.15]}>
        <mesh position={[0, 0.025, 0]} castShadow>
          <boxGeometry args={[0.28, 0.05, 0.2]} />
          <meshStandardMaterial color="#3d4a3a" roughness={0.6} />
        </mesh>
        <mesh position={[0.01, 0.075, 0]} castShadow>
          <boxGeometry args={[0.26, 0.05, 0.18]} />
          <meshStandardMaterial color="#6b3f37" roughness={0.6} />
        </mesh>
        {/* Screwdriver lying across the top book */}
        <group position={[0.01, 0.108, 0.01]} rotation={[0, 0.42, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.009, 0.011, 0.075, 10]} />
            <meshStandardMaterial color="#b4472e" roughness={0.45} />
          </mesh>
          <mesh position={[0.072, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.004, 0.004, 0.07, 8]} />
            <meshStandardMaterial color="#b9bcc2" metalness={0.75} roughness={0.3} />
          </mesh>
        </group>
      </group>

      <DeskChair />
    </group>
  );
}

const SCREEN_CANVAS_W = 512;
const SCREEN_CANVAS_H = 320;

/** Truncates text to fit maxWidth, appending an ellipsis if it had to cut. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(out + '…').width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + '…';
}

/**
 * Draws the live search state onto the laptop screen's own canvas texture —
 * a real WebGL material, not a DOM overlay. Chosen over drei's <Html> after
 * that approach both proved unverifiable here and (via its "blending"
 * occlusion mode) broke the canvas's own click handling app-wide; a canvas
 * texture has none of that risk and is the standard way to put dynamic
 * "screen" content on a 3D object.
 */
function drawLaptopScreen(
  ctx: CanvasRenderingContext2D,
  { query, status, results }: { query: string; status: 'idle' | 'loading' | 'done' | 'error'; results: SearchResult[] }
) {
  const w = SCREEN_CANVAS_W;
  const h = SCREEN_CANVAS_H;

  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, w, h);

  ctx.textBaseline = 'top';
  ctx.font = '600 20px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#5b8fd9';
  ctx.fillText('SEARCH', 20, 18);
  ctx.strokeStyle = 'rgba(91,143,217,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(20, 46);
  ctx.lineTo(w - 20, 46);
  ctx.stroke();

  ctx.font = '16px ui-monospace, Menlo, monospace';
  let y = 66;

  if (status === 'idle') {
    ctx.fillStyle = '#5a6472';
    ctx.fillText('press E to search', 20, y);
    return;
  }
  if (status === 'loading') {
    ctx.fillStyle = '#8a97a8';
    ctx.fillText(fitText(ctx, `searching "${query}"…`, w - 40), 20, y);
    return;
  }
  if (status === 'error') {
    ctx.fillStyle = '#d98a7a';
    ctx.fillText('search unavailable', 20, y);
    ctx.fillStyle = '#5a6472';
    ctx.font = '13px ui-monospace, Menlo, monospace';
    y += 24;
    ctx.fillText(fitText(ctx, 'check the API key in .env', w - 40), 20, y);
    return;
  }

  // status === 'done'
  ctx.fillStyle = '#8a97a8';
  ctx.fillText(fitText(ctx, `"${query}"`, w - 40), 20, y);
  y += 30;

  if (results.length === 0) {
    ctx.fillStyle = '#5a6472';
    ctx.fillText('no results', 20, y);
    return;
  }

  for (const r of results.slice(0, 5)) {
    if (y > h - 40) break;
    ctx.font = '15px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#8ab4f8';
    ctx.fillText(fitText(ctx, r.title || r.link, w - 40), 20, y);
    y += 20;
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#27c93f';
    ctx.fillText(fitText(ctx, r.displayLink, w - 40), 20, y);
    y += 26;
  }
}

function Laptop() {
  const { query, status, results } = usePCSearch();
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#919599', roughness: 0.35, metalness: 0.75 }),
    []
  );
  const trackpadMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#3a3c40', roughness: 0.3, metalness: 0.4 }),
    []
  );
  const keyboardMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: getKeyboardTexture(), roughness: 0.75, metalness: 0.1 }),
    []
  );
  const bezelMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.5, metalness: 0.3 }),
    []
  );

  const screenCanvas = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = SCREEN_CANVAS_W;
    canvas.height = SCREEN_CANVAS_H;
    return canvas;
  }, []);
  const screenTexture = useMemo(() => {
    const texture = new THREE.CanvasTexture(screenCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [screenCanvas]);
  const screenMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: screenTexture,
        emissiveMap: screenTexture,
        emissive: '#ffffff',
        emissiveIntensity: 0.85,
        roughness: 0.25,
        metalness: 0.05,
      }),
    [screenTexture]
  );

  useEffect(() => {
    const ctx = screenCanvas.getContext('2d');
    if (!ctx) return;
    drawLaptopScreen(ctx, { query, status, results });
    screenTexture.needsUpdate = true;
  }, [screenCanvas, screenTexture, query, status, results]);

  const baseW = 0.34;
  const baseD = 0.23;
  const baseH = 0.014;
  const screenW = baseW;
  // Enlarged from the original 0.2 for legibility — the trade-off asked for
  // over getting a working, verifiable screen instead of a barely-visible one.
  const screenH = 0.24;
  const screenT = 0.009;

  return (
    // Base sits flush on the desk surface (desk-local y = 0.03, the tabletop's top face).
    <group position={[0.12, 0.03, 0.05]} rotation={[0, 0.15, 0]}>
      {/* Base deck */}
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[baseW, baseH, baseD]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>

      {/* Keyboard */}
      <mesh position={[0, baseH + 0.0008, -baseD * 0.08]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[baseW * 0.82, baseD * 0.52]} />
        <primitive object={keyboardMat} attach="material" />
      </mesh>

      {/* Trackpad */}
      <mesh position={[0, baseH + 0.0006, baseD * 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[baseW * 0.3, baseD * 0.3]} />
        <primitive object={trackpadMat} attach="material" />
      </mesh>

      {/* Hinge barrel */}
      <mesh position={[0, baseH, -baseD / 2]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.006, 0.006, baseW * 0.92, 10]} />
        <meshStandardMaterial color="#3a3c40" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Screen, hinged open to a natural, slightly reclined reading angle */}
      <group position={[0, baseH, -baseD / 2]} rotation={[-0.16, 0, 0]}>
        <mesh position={[0, screenH / 2, -screenT / 2]} castShadow>
          <boxGeometry args={[screenW, screenH, screenT]} />
          <primitive object={bodyMat} attach="material" />
        </mesh>
        {/* Bezel */}
        <mesh position={[0, screenH / 2, screenT / 2 + 0.0004]}>
          <planeGeometry args={[screenW * 0.94, screenH * 0.9]} />
          <primitive object={bezelMat} attach="material" />
        </mesh>
        {/* Display: live search state, drawn onto screenTexture above */}
        <mesh position={[0, screenH / 2, screenT / 2 + 0.0008]}>
          <planeGeometry args={[screenW * 0.86, screenH * 0.8]} />
          <primitive object={screenMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

function DeskChair() {
  const legPositions: [number, number, number][] = [
    [-0.15, -0.225, -0.13],
    [0.15, -0.225, -0.13],
    [-0.15, -0.225, 0.13],
    [0.15, -0.225, 0.13],
  ];

  return (
    <group position={[0.1, -0.25, 0.62]} rotation={[0, Math.PI, 0]}>
      {/* Seat */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.36, 0.035, 0.34]} />
        <meshStandardMaterial color="#4a3b2a" roughness={0.5} />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.21, -0.16]} rotation={[-0.15, 0, 0]} castShadow>
        <boxGeometry args={[0.34, 0.36, 0.03]} />
        <meshStandardMaterial color="#4a3b2a" roughness={0.5} />
      </mesh>
      {/* Legs */}
      {legPositions.map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <cylinderGeometry args={[0.014, 0.017, 0.45, 8]} />
          <meshStandardMaterial color="#3a2e22" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A phone lying face-up, screen faintly lit. Deliberately plain: it reads
 * as something someone put down, not as a prop begging to be clicked. The
 * invitation to interact comes from the shared highlight in
 * ProjectAnchors.tsx, the same one the TV and the desk manuals use, so
 * every project object behaves identically.
 */
function NightstandPhone({ y }: { y: number }) {
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.35, metalness: 0.5 }),
    []
  );
  // Lit by its own screen content rather than a flat tint: the texture is
  // both the colour and the emissive map, so the balance and the chart
  // read even in the dim corner by the bed.
  const screenMat = useMemo(() => {
    const map = getPhoneFinanceTexture();
    return new THREE.MeshStandardMaterial({
      map,
      emissive: '#ffffff',
      emissiveMap: map,
      emissiveIntensity: 0.55,
      roughness: 0.25,
    });
  }, []);

  const w = 0.07;
  const h = 0.142;
  const t = 0.009;

  return (
    <group position={[0.14, y, 0.11]} rotation={[0, 0.26, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, t, h]} />
        <primitive object={bodyMat} attach="material" />
      </mesh>
      <mesh position={[0, t / 2 + 0.0008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * 0.86, h * 0.9]} />
        <primitive object={screenMat} attach="material" />
      </mesh>
    </group>
  );
}


/**
 * A spray bottle and a folded cloth, standing on the floor near the door.
 *
 * Freshly is a cleaning-services marketplace, and nothing already in a
 * library/bedroom says "cleaning". This is the smallest object that makes
 * the link obvious at a glance without explanation, which is the whole
 * point of tying a project to a thing. Kept low, muted and against the
 * wall so it reads as part of the room, not as a display piece.
 */
function CleaningSet() {
  const bottleMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#7a8b72', roughness: 0.42, metalness: 0.05 }),
    []
  );
  const triggerMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#e8e3d6', roughness: 0.5 }),
    []
  );
  const liquidMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#9fb89a',
        roughness: 0.25,
        transparent: true,
        opacity: 0.75,
      }),
    []
  );
  const clothMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#dfe6e2', roughness: 0.95 }),
    []
  );

  return (
    <group position={[-2.3, -2.05, 4.75]}>
      {/* Bottle body, with the liquid line showing through */}
      <mesh position={[0, 0.085, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.042, 0.048, 0.17, 18]} />
        <primitive object={bottleMat} attach="material" />
      </mesh>
      <mesh position={[0, 0.055, 0]}>
        <cylinderGeometry args={[0.0435, 0.0495, 0.09, 18]} />
        <primitive object={liquidMat} attach="material" />
      </mesh>

      {/* Neck and trigger head */}
      <mesh position={[0, 0.185, 0]} castShadow>
        <cylinderGeometry args={[0.019, 0.024, 0.035, 12]} />
        <primitive object={triggerMat} attach="material" />
      </mesh>
      <mesh position={[0, 0.212, 0.014]} castShadow>
        <boxGeometry args={[0.032, 0.03, 0.06]} />
        <primitive object={triggerMat} attach="material" />
      </mesh>
      {/* Nozzle */}
      <mesh position={[0, 0.218, 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.022, 8]} />
        <primitive object={triggerMat} attach="material" />
      </mesh>
      {/* Trigger grip, angled back under the head */}
      <mesh position={[0, 0.176, 0.035]} rotation={[0.5, 0, 0]} castShadow>
        <boxGeometry args={[0.02, 0.045, 0.012]} />
        <primitive object={triggerMat} attach="material" />
      </mesh>

      {/* Folded cloth beside it, two layers so the fold reads */}
      <group position={[0.14, 0.012, 0.02]} rotation={[0, 0.5, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.15, 0.022, 0.11]} />
          <primitive object={clothMat} attach="material" />
        </mesh>
        <mesh position={[0.008, 0.02, -0.006]} rotation={[0, -0.12, 0]} castShadow>
          <boxGeometry args={[0.13, 0.018, 0.095]} />
          <primitive object={clothMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}
