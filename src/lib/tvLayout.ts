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

/** The screen's face in world space: the shelf group's local +z, rotated into the world. */
const faceLocalZ = TV_WALL_Z + TV_BODY_DEPTH / 2;
export const TV_SCREEN_WORLD: [number, number, number] = [
  SHELF_GROUP_OFFSET_X + faceLocalZ * Math.sin(SHELF_GROUP_ROTATION_Y),
  TV_CENTER_Y,
  SHELF_GROUP_OFFSET_Z + faceLocalZ * Math.cos(SHELF_GROUP_ROTATION_Y),
];

/** World direction of the screen's own right-hand edge, as seen by a viewer facing it. */
export const TV_SCREEN_RIGHT: [number, number, number] = [
  Math.cos(SHELF_GROUP_ROTATION_Y),
  0,
  -Math.sin(SHELF_GROUP_ROTATION_Y),
];

/**
 * Where to stand to watch it: on the open floor in front of the back wall,
 * about 3 m back and on its centre line — far enough for the whole 2.8 m
 * screen to sit in frame, clear of every collider (lib/collision.ts: desk
 * from x 1.02, shelf out to z -2.25).
 */
export const TV_VIEW_STAND: [number, number] = [0, 0.3];

/**
 * The same on a narrow (portrait) screen, whose horizontal view is far
 * narrower: from 3 m the 2.8 m screen overflows it. About 4.6 m back, the
 * whole screen fits; still clear of the desk (x from 1.02) and the bed.
 */
export const TV_VIEW_STAND_NARROW: [number, number] = [0, 1.9];
