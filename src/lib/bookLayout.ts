import { BOOK_HEIGHT } from '../components/library/Book';
import type { BookData } from '../data/books';

// The BACK wall (z = -3), centred, facing the entrance: the shelf is the
// site's navigation and the TV above it carries the projects, so they are
// the first thing a visitor sees on walking in. On the right wall they sat
// off to the side of the entry view, and the window took the centre.
// The case's back sits 0.05 off the wall, like the baseboard.
export const SHELF_GROUP_OFFSET_X = 0;
export const SHELF_GROUP_OFFSET_Z = -2.95 + 0.46 / 2;
// 0: local +Z (the case's front/brass-trim face, where books read outward)
// already faces +Z — into the room, toward the entrance.
export const SHELF_GROUP_ROTATION_Y = 0;

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

export interface FillerSlot {
  /** Centre, local to the shelf group. */
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  /** Rotation about Z: a book leaning on its neighbour. */
  lean: number;
  colorIndex: number;
}

export interface ShelfDecor {
  fillers: FillerSlot[];
  plantX: number;
  bookendX: number;
}

// A second board across the case, above the section books. The case is
// 0.85 m tall and the books 0.26 m, so with one row they sat in the bottom
// third of a tall, empty box. The upper row is decoration only.
export const UPPER_SHELF_Y = SHELF_SURFACE_Y + 0.36;
export const UPPER_SURFACE_Y = UPPER_SHELF_Y + SHELF_BOARD_THICKNESS / 2;

// Section books' spines sit at z = BOOK_DEPTH / 2 = 0.095. The fillers sit
// a little further back, so the books that matter stand proud of them.
const FILLER_SPINE_Z = 0.085;
// Each cluster stays within this half-width of its gap's centre: the
// section books are ~0.35 m apart, up to ~0.03 m half-thick plus ±0.02 m
// of jitter, so this leaves a clear hand's width beside every one.
const CLUSTER_HALF_SPAN = 0.08;
const INNER_HALF_WIDTH = CASE_WIDTH / 2 - 0.06;

function fillerBook(x: number, i: number, lean = 0, surfaceY = SHELF_SURFACE_Y, tall = false): FillerSlot {
  const width = 0.028 + seeded(i + 200) * 0.018;
  const height = (tall ? 0.22 : 0.18) + seeded(i + 300) * (tall ? 0.1 : 0.07);
  const depth = 0.15 + seeded(i + 400) * 0.04;
  // A leaning book's centre rises by its tipped footprint, so its lower
  // corner rests on the board instead of sinking through it.
  const y = surfaceY + (height * Math.cos(lean) + width * Math.abs(Math.sin(lean))) / 2;
  return { x, y, z: FILLER_SPINE_Z - depth / 2, width, height, depth, lean, colorIndex: Math.floor(seeded(i + 500) * 7) };
}

/**
 * The shelf's decoration around the section books: a small cluster of plain
 * books in each gap, a bookend holding a stack at the left end, and a plant
 * at the right. Derived from the section books' layout so the two never
 * overlap, whatever the number of books.
 */
export function computeShelfDecor(layout: BookSlot[]): ShelfDecor {
  const fillers: FillerSlot[] = [];
  let n = 0;

  const cluster = (centre: number, count: number, leanLast: boolean) => {
    const books: FillerSlot[] = [];
    for (let k = 0; k < count; k++) books.push(fillerBook(0, n++, leanLast && k === count - 1 ? 0.16 : 0));
    let span = books.reduce((sum, b) => sum + b.width + 0.002, 0);
    // Drop books until the cluster fits its gap.
    while (span > CLUSTER_HALF_SPAN * 2 && books.length > 1) {
      const removed = books.shift()!;
      span -= removed.width + 0.002;
    }
    let cursor = centre - span / 2;
    for (const b of books) {
      // A leaning book takes a little more room along the row.
      const w = b.lean ? b.width + b.height * Math.sin(b.lean) * 0.5 : b.width;
      fillers.push({ ...b, x: cursor + w / 2 });
      cursor += w + 0.002;
    }
  };

  const xs = layout.map((s) => s.position[0]).sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    cluster((xs[i] + xs[i + 1]) / 2, 2 + Math.floor(seeded(i + 600) * 3), i % 2 === 1);
  }

  // Left end: a stack held up by a brass bookend.
  const first = xs[0] ?? 0;
  const bookendX = -INNER_HALF_WIDTH + 0.03;
  cluster((bookendX + 0.01 + first - 0.07) / 2, 4, false);

  // Upper row: longer runs of taller books, with breathing room between
  // them and a space on the right for the plant.
  const plantX = INNER_HALF_WIDTH - 0.32;
  let x = -INNER_HALF_WIDTH + 0.06;
  while (x < plantX - 0.2) {
    const runEnd = Math.min(x + 0.3 + seeded(n + 700) * 0.35, plantX - 0.12);
    while (x < runEnd) {
      const b = fillerBook(0, n++, 0, UPPER_SURFACE_Y, true);
      fillers.push({ ...b, x: x + b.width / 2 });
      x += b.width + 0.002;
    }
    // Most runs end on a book leaning back against the rest.
    if (seeded(n + 800) > 0.35) {
      const lean = 0.18;
      const b = fillerBook(0, n++, lean, UPPER_SURFACE_Y, true);
      const w = b.width + b.height * Math.sin(lean) * 0.5;
      fillers.push({ ...b, x: x + w / 2 });
      x += w;
    }
    x += 0.16 + seeded(n + 900) * 0.18;
  }

  return { fillers, plantX, bookendX };
}
