import { BOOK_HEIGHT } from '../components/library/Book';
import type { BookData } from '../data/books';

// Still the RIGHT wall (x = 4.5), but now centered along its open run rather
// than sitting close to the back corner. That run is the back wall (z = -3)
// to the entrance wall (z = 5.3) = 8.3 long, centered at z = 1.15 — clear of
// the desk (x 1.02–2.78, nowhere near x = 4.5) in both directions.
export const SHELF_GROUP_OFFSET_X = 4.45 - 0.46 / 2;
export const SHELF_GROUP_OFFSET_Z = 1.15;
// -90°: local +Z (the case's front/brass-trim face, where books read outward)
// rotates to face -X — into the room, away from the wall at x = 4.5.
export const SHELF_GROUP_ROTATION_Y = -Math.PI / 2;

// Floor is at y = -2.05 (LibraryEnvironment.tsx). The case is a floating,
// wall-mounted mantel — not floor-standing — so its bottom board sits a fixed
// height above the floor instead of resting on it; LibraryEnvironment adds
// wall corbel brackets under it to sell the "hung on the wall" read.
const FLOOR_Y = -2.05;
const FLOAT_HEIGHT = 1.15;
const SHELF_BOARD_THICKNESS = 0.04;
const SHELF_BOTTOM = FLOOR_Y + FLOAT_HEIGHT + SHELF_BOARD_THICKNESS / 2;
// Bigger again: 2.9/0.72/0.4 -> 3.4/0.85/0.46.
const CASE_WIDTH = 3.4;
const CASE_HEIGHT = 0.85;
const CASE_DEPTH = 0.46;
const SHELF_SURFACE_Y = SHELF_BOTTOM + SHELF_BOARD_THICKNESS / 2;

// Deterministic pseudo-random so layout is stable across renders.
function seeded(i: number) {
  const x = Math.sin(i * 999.7) * 10000;
  return x - Math.floor(x);
}

export interface BookSlot {
  id: string;
  /** Local position, relative to the shelf group (itself offset + rotated). */
  position: [number, number, number];
  rotationY: number;
}

/**
 * Slot layout for a given book list — a function now, not a module-level
 * constant, since books come from Firestore (useBooks()) and can change
 * after the initial static-fallback render. Callers memoize this on the
 * books array they got from useBooks().
 */
export function computeBookLayout(books: BookData[]): BookSlot[] {
  const rowWidth = CASE_WIDTH * 0.82;
  const gap = rowWidth / Math.max(books.length, 1);
  let cursor = -rowWidth / 2 + gap / 2;

  return books.map((b, i) => {
    const jitterX = (seeded(i) - 0.5) * (gap * 0.12);
    const jitterRotY = (seeded(i + 50) - 0.5) * 0.05;
    const x = cursor + jitterX;
    cursor += gap;
    return {
      id: b.id,
      position: [x, SHELF_SURFACE_Y + (BOOK_HEIGHT * b.height) / 2, 0],
      rotationY: jitterRotY,
    };
  });
}

/**
 * World-space position of a shelved book: local slot, rotated by the shelf
 * group's own rotation, then translated by its offset. Needs the rotation
 * step since the shelf isn't axis-aligned with the world — a plain
 * translation would report the pre-rotation position, silently breaking
 * grab/carry and the crosshair raycast.
 */
export function getBookWorldPosition(layout: BookSlot[], id: string): [number, number, number] {
  const slot = layout.find((s) => s.id === id);
  const [lx, ly, lz] = slot?.position ?? [0, -1.4, 0];

  const cos = Math.cos(SHELF_GROUP_ROTATION_Y);
  const sin = Math.sin(SHELF_GROUP_ROTATION_Y);
  const wx = lx * cos + lz * sin + SHELF_GROUP_OFFSET_X;
  const wz = -lx * sin + lz * cos + SHELF_GROUP_OFFSET_Z;

  return [wx, ly, wz];
}

export { SHELF_BOTTOM, SHELF_BOARD_THICKNESS, CASE_WIDTH, CASE_HEIGHT, CASE_DEPTH, SHELF_SURFACE_Y };
