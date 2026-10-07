import {
  SHELF_GROUP_OFFSET_X,
  SHELF_GROUP_OFFSET_Z,
  SHELF_GROUP_ROTATION_Y,
  SHELF_BOTTOM,
  CASE_HEIGHT,
  CASE_DEPTH,
} from './bookLayout';

/**
 * The wall TV's size and place, in one spot, so the screen (LibraryEnvironment
 * WallTV), its viewing camera (ui/ProjectTheatre) and its interaction point
 * agree. It hangs over the bookcase and shares its transform.
 *
 * Was 1.7 × 0.95 m, 0.34 m above the mantel — about 4.4 m from the middle
 * of the room and 1.3 m above eye level, so the text on it was unreadable.
 * Now 16:9 at 2.8 m wide, hung lower.
 */
export const TV_WIDTH = 2.8;
export const TV_HEIGHT = (TV_WIDTH * 9) / 16;
export const TV_BEZEL = 0.035;
export const TV_BODY_DEPTH = 0.05;

const MANTEL_TOP_Y = SHELF_BOTTOM + CASE_HEIGHT + 0.06 + 0.035;
const GAP_ABOVE_MANTEL = 0.12;

/** TV centre, in the shelf group's local frame (y is world height). */
export const TV_CENTER_Y = MANTEL_TOP_Y + GAP_ABOVE_MANTEL + TV_HEIGHT / 2;
export const TV_WALL_Z = -CASE_DEPTH / 2 - 0.01;

/** The screen's face in world space: the group is rotated −90°, so local +z → world −x. */
const faceLocalZ = TV_WALL_Z + TV_BODY_DEPTH / 2;
export const TV_SCREEN_WORLD: [number, number, number] = [
  SHELF_GROUP_OFFSET_X + faceLocalZ * Math.sin(SHELF_GROUP_ROTATION_Y),
  TV_CENTER_Y,
  SHELF_GROUP_OFFSET_Z + faceLocalZ * Math.cos(SHELF_GROUP_ROTATION_Y),
];

/**
 * Where to stand to watch it: on the open floor between the desk and the
 * back wall, about 3 m back and slightly off-axis — far enough for the
 * whole 2.8 m screen to sit in frame, clear of every collider
 * (lib/collision.ts: desk from z 1.02, shelf from x 3.75).
 */
export const TV_VIEW_STAND: [number, number] = [1.35, 0.45];
