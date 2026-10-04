// Lightweight AABB collision for the free-roam walk camera. Full mesh
// raycasting isn't wired up (LibraryEnvironment's meshes aren't refs), so
// this uses hand-derived footprints from each piece of furniture's own
// known world coordinates instead — cheap, and accurate enough for walking
// around a static room. Gap: doesn't account for rotated furniture (the
// desk) precisely; its box is intentionally generous rather than tight.

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const PLAYER_RADIUS = 0.3;
// Room scale is 1 unit = 1 meter (established throughout this project);
// a realistic standing eye height, independent of the old cinematic camera's
// scripted Y values.
export const PLAYER_EYE_HEIGHT = 1.6;
export const FLOOR_Y = -2.05;

export const ROOM_BOUNDS: AABB = { minX: -4.4, maxX: 4.4, minZ: -2.9, maxZ: 7.5 };

// Furniture footprints (x/z only — the walk camera is height-locked to eye level).
export const FURNITURE_COLLIDERS: AABB[] = [
  // Bookshelf/fireplace, right wall (x = 4.5) rotated 90°, now centered
  // along that wall's open run (z = 1.15) — padded past the bare case
  // footprint to also cover the hearth and surround pilasters flanking it.
  // X range doesn't reach the desk's (1.02–2.78), so no overlap despite
  // sharing part of the same Z span.
  { minX: 3.75, maxX: 4.5, minZ: -0.75, maxZ: 3.05 },
  { minX: 1.02, maxX: 2.78, minZ: 1.02, maxZ: 2.78 }, // desk (generous box for its rotated footprint)
  { minX: -4.42, maxX: -2.42, minZ: 0.35, maxZ: 1.95 }, // bed, re-centered on the left wall's open run
  { minX: -4.4, maxX: -3.9, minZ: 2.05, maxZ: 2.45 }, // nightstand
];

// Clear width of the doorway, measured between the door frame posts' inner
// faces (Entrance.tsx puts the posts at x = ±0.95, 0.2 wide). Everything
// outside this on the entrance wall is solid geometry.
export const DOORWAY_HALF_WIDTH = 0.85;
// FrontWall's boxes are 0.4 deep, centred on DOOR_Z (LibraryEnvironment.tsx).
const FRONT_WALL_HALF_DEPTH = 0.2;

// Built once per (doorZ, doorHalfWidth) rather than per frame. collidersFor
// runs inside CameraRig's useFrame, and it used to spread a fresh array
// every single frame just to append one box.
let cached: { z: number; halfWidth: number; open: AABB[]; closed: AABB[] } | null = null;

/**
 * Colliders for the current door state.
 *
 * The entrance wall itself used to be missing from this list entirely. The
 * only thing standing between the porch and the room was a blocking volume
 * across the *doorway*, and only while the door was shut — so you could
 * walk straight through the solid wall beside the door and end up inside,
 * and once the door opened the last barrier went away and the whole wall
 * was permeable. ROOM_BOUNDS couldn't catch it either: it is one box
 * covering the room and the porch together (z -2.9 .. 7.5), with the wall
 * sitting in the middle of it, so nothing clamped movement across z = 5.3.
 *
 * The two solid segments either side of the opening are now permanent
 * colliders, leaving a gap only at the real doorway. The door leaf's own
 * blocker is still added on top when it's shut, which closes that gap too.
 */
export function collidersFor(doorOpen: boolean, doorZ: number, doorHalfWidth: number): AABB[] {
  if (!cached || cached.z !== doorZ || cached.halfWidth !== doorHalfWidth) {
    const minZ = doorZ - FRONT_WALL_HALF_DEPTH;
    const maxZ = doorZ + FRONT_WALL_HALF_DEPTH;
    // Extended past ROOM_BOUNDS on the outer edges so there's no sliver
    // between the end of the wall collider and the side walls.
    const open: AABB[] = [
      ...FURNITURE_COLLIDERS,
      { minX: ROOM_BOUNDS.minX - 1, maxX: -DOORWAY_HALF_WIDTH, minZ, maxZ },
      { minX: DOORWAY_HALF_WIDTH, maxX: ROOM_BOUNDS.maxX + 1, minZ, maxZ },
    ];
    const closed: AABB[] = [
      ...open,
      { minX: -doorHalfWidth, maxX: doorHalfWidth, minZ: doorZ - 0.15, maxZ: doorZ + 0.15 },
    ];
    cached = { z: doorZ, halfWidth: doorHalfWidth, open, closed };
  }
  return doorOpen ? cached.open : cached.closed;
}

function collidesAt(x: number, z: number, boxes: AABB[], radius: number) {
  for (const b of boxes) {
    if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) {
      return true;
    }
  }
  return false;
}

/** Resolves a desired (x,z) move against room bounds + furniture, sliding along blocked axes. */
export function resolveMove(
  currentX: number,
  currentZ: number,
  desiredX: number,
  desiredZ: number,
  boxes: AABB[],
  radius = PLAYER_RADIUS
) {
  let x = currentX;
  let z = currentZ;

  const clampedX = clamp(desiredX, ROOM_BOUNDS.minX + radius, ROOM_BOUNDS.maxX - radius);
  const clampedZ = clamp(desiredZ, ROOM_BOUNDS.minZ + radius, ROOM_BOUNDS.maxZ - radius);

  if (!collidesAt(clampedX, z, boxes, radius)) x = clampedX;
  if (!collidesAt(x, clampedZ, boxes, radius)) z = clampedZ;

  return { x, z };
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}
