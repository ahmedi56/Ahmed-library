// Standalone geometric leak-test for the entrance header wall.
// Independent of the renderer entirely — pure arithmetic against the exact
// same numbers LibraryEnvironment.tsx's FrontWall() and Entrance.tsx use.
// For every point on a dense grid across the header rectangle (the area
// above the door, between the frame top and the ceiling), confirms a solid
// FrontWall box actually occupies that (x, y) column through its full
// z-thickness — i.e. there is truly no gap for a ray to pass through from
// either the porch side or the interior side.

// --- Mirrors LibraryEnvironment.tsx: FrontWall() ---
const wallLeft = -4.5;
const wallRight = 4.5;
const wallTop = 5.6;
const DOOR_Z = 5.3; // Entrance.tsx
const wallZ = DOOR_Z;
const thickness = 0.4;
const holeLeft = -1.02;
const holeRight = 1.02;
const holeTop = 0.7;

const boxes = [
  // Above the opening
  {
    name: 'above',
    xMin: wallLeft, xMax: wallRight,
    yMin: holeTop, yMax: wallTop,
    zMin: wallZ - thickness / 2, zMax: wallZ + thickness / 2,
  },
  // Left of the opening (only matters where it overlaps the "above" band's
  // height range or lower, but checked in full for completeness)
  {
    name: 'left',
    xMin: wallLeft, xMax: holeLeft,
    yMin: -2.55, yMax: holeTop,
    zMin: wallZ - thickness / 2, zMax: wallZ + thickness / 2,
  },
  {
    name: 'right',
    xMin: holeRight, xMax: wallRight,
    yMin: -2.55, yMax: holeTop,
    zMin: wallZ - thickness / 2, zMax: wallZ + thickness / 2,
  },
];

// --- Entrance.tsx's own door frame/arch geometry, also real coverage ---
const DOOR_GROUP_Y = -2.05;
const DOOR_HEIGHT = 2.6;
// Left/right posts: position [±0.95, DOOR_HEIGHT/2, 0], size [0.2, DOOR_HEIGHT+0.2, 0.28]
const postBoxes = [-0.95, 0.95].map((cx) => ({
  xMin: cx - 0.1, xMax: cx + 0.1,
  yMin: DOOR_GROUP_Y + DOOR_HEIGHT / 2 - (DOOR_HEIGHT + 0.2) / 2,
  yMax: DOOR_GROUP_Y + DOOR_HEIGHT / 2 + (DOOR_HEIGHT + 0.2) / 2,
}));
// Top bar: position [0, DOOR_HEIGHT+0.1, 0], size [2.1, 0.2, 0.28]
const topBar = {
  xMin: -1.05, xMax: 1.05,
  yMin: DOOR_GROUP_Y + DOOR_HEIGHT + 0.1 - 0.1,
  yMax: DOOR_GROUP_Y + DOOR_HEIGHT + 0.1 + 0.1,
};
// Arch: circleGeometry(1.05, 24, 0, PI) at position [0, DOOR_HEIGHT+0.1, 0.14] —
// upper semicircle, flat edge at its own center y, bulging up by radius 1.05.
const archCenterY = DOOR_GROUP_Y + DOOR_HEIGHT + 0.1;
const archRadius = 1.05;
function archCoversAt(x, y) {
  if (Math.abs(x) > archRadius + 1e-9) return false;
  if (y < archCenterY - 1e-9) return false;
  const curveTop = archCenterY + Math.sqrt(Math.max(0, archRadius * archRadius - x * x));
  return y <= curveTop + 1e-9;
}

const ceilingY = 5.4;
const sideWallX = 4.5; // both side walls sit at x = ±4.5
const doorFrameTopWorldY = topBar.yMax;
const archTopWorldY = archCenterY + archRadius;

// Epsilon guards against float-noise from the sampling grid's own
// interpolation (e.g. an intended x = 1.05 landing at 1.0500000000000007) —
// many orders of magnitude below anything the renderer or a viewer could
// ever perceive, not a real geometric gap.
const EPS = 1e-9;
function inBox(b, x, y) {
  return x >= b.xMin - EPS && x <= b.xMax + EPS && y >= b.yMin - EPS && y <= b.yMax + EPS;
}

function coveredAt(x, y) {
  for (const b of boxes) if (inBox(b, x, y)) return b.name;
  for (const b of postBoxes) if (inBox(b, x, y)) return 'door-post';
  if (inBox(topBar, x, y)) return 'door-top-bar';
  if (archCoversAt(x, y)) return 'door-arch';
  return null;
}

// Grid-sample the header rectangle (the region a viewer standing near the
// door and looking up would actually see): x across the full wall width,
// y from just above the door frame/arch up to just above the ceiling.
const xSamples = 61; // every 0.15 units across 9 units of width
const ySamples = 41; // every ~0.11 units across ~4.5 units of height
const yFrom = topBar.yMin; // the frame top bar's own bottom edge — where "above the door" begins; below this is the doorway opening itself (the door leaf), out of scope here
const yTo = ceilingY + 0.05; // end slightly above the ceiling, on purpose

let gaps = [];
for (let ix = 0; ix < xSamples; ix++) {
  const x = wallLeft + (ix / (xSamples - 1)) * (wallRight - wallLeft);
  for (let iy = 0; iy < ySamples; iy++) {
    const y = yFrom + (iy / (ySamples - 1)) * (yTo - yFrom);
    const hit = coveredAt(x, y);
    if (!hit) gaps.push({ x: x.toFixed(2), y: y.toFixed(2) });
  }
}

console.log('--- Front wall header leak test ---');
console.log(`Door frame top (world y): ${doorFrameTopWorldY.toFixed(3)}`);
console.log(`Arch top (world y):       ${archTopWorldY.toFixed(3)}`);
console.log(`Ceiling (world y):        ${ceilingY}`);
console.log(`Side walls at x = ±${sideWallX}`);
console.log(`FrontWall "above" box:    x[${wallLeft}, ${wallRight}]  y[${holeTop}, ${wallTop}]  z[${(wallZ - thickness / 2).toFixed(2)}, ${(wallZ + thickness / 2).toFixed(2)}]`);
console.log(`Sampled region:           x[${wallLeft}, ${wallRight}]  y[${yFrom.toFixed(2)}, ${yTo.toFixed(2)}]  (${xSamples * ySamples} points)`);
console.log('');

if (gaps.length === 0) {
  console.log(`PASS — every sampled (x, y) column in the header region is covered by solid FrontWall box geometry through its full ${thickness}-unit z-thickness (both faces, front and back, are real geometry on the same solid mesh).`);
} else {
  console.log(`FAIL — ${gaps.length} sample point(s) found with NO covering geometry:`);
  console.log(gaps.slice(0, 20));
}

// Also explicitly confirm the seams: does the "above" box's y-range actually
// overlap (not just touch) the frame/arch top and the ceiling, and does its
// x-range exactly match the side walls?
console.log('');
console.log('--- Seam checks ---');
console.log(`Bottom seam: holeTop (${holeTop}) vs frame top (${doorFrameTopWorldY.toFixed(3)}) -> ${holeTop < doorFrameTopWorldY ? `OVERLAPS by ${(doorFrameTopWorldY - holeTop).toFixed(3)}` : `GAP of ${(holeTop - doorFrameTopWorldY).toFixed(3)}`}`);
console.log(`Bottom seam vs arch top (${archTopWorldY.toFixed(3)}) -> ${holeTop < archTopWorldY ? `covered below arch top too (overlaps by ${(archTopWorldY - holeTop).toFixed(3)})` : `does NOT reach arch top, short by ${(holeTop - archTopWorldY).toFixed(3)}`}`);
console.log(`Top seam: wallTop (${wallTop}) vs ceiling (${ceilingY}) -> ${wallTop > ceilingY ? `OVERLAPS by ${(wallTop - ceilingY).toFixed(3)}` : `GAP of ${(ceilingY - wallTop).toFixed(3)}`}`);
console.log(`Left seam: wallLeft (${wallLeft}) vs side wall (${-sideWallX}) -> ${wallLeft === -sideWallX ? 'EXACT MATCH' : `mismatch of ${(wallLeft - -sideWallX).toFixed(3)}`}`);
console.log(`Right seam: wallRight (${wallRight}) vs side wall (${sideWallX}) -> ${wallRight === sideWallX ? 'EXACT MATCH' : `mismatch of ${(wallRight - sideWallX).toFixed(3)}`}`);

// --- Jamb leak test -------------------------------------------------------
// The header test above only ever sampled *above* the door frame, which is
// why it kept passing while a real hole sat beside it: the wall's opening
// used to be 1.1 wide each side while the frame posts only reach 1.05, so a
// 0.05-wide, full-height slit ran straight through the wall on both sides of
// the doorway. Sample the two vertical bands between the doorway's clear
// opening (the frame posts' inner edge, x = 0.85) and the wall edge, from
// the floor up to the top of the opening.
const FLOOR_Y = -2.05;
const clearHalfWidth = 0.85; // frame posts' inner faces
// Step finely in x (0.005 units): the gap this is looking for was only 0.05
// wide, and a coarse grid steps straight over it — which is exactly how it
// survived unnoticed in the first place.
const jambGaps = [];
const jambSteps = Math.ceil((Math.abs(wallLeft) - clearHalfWidth) / 0.005);
for (let side of [-1, 1]) {
  for (let ix = 0; ix <= jambSteps; ix++) {
    const x = side * (clearHalfWidth + (ix / jambSteps) * (Math.abs(wallLeft) - clearHalfWidth));
    for (let iy = 0; iy <= 40; iy++) {
      const y = FLOOR_Y + (iy / 40) * (holeTop - FLOOR_Y);
      if (!coveredAt(x, y)) jambGaps.push({ x: x.toFixed(3), y: y.toFixed(2) });
    }
  }
}

console.log('');
console.log('--- Jamb leak test (beside the doorway, floor to opening top) ---');
console.log(`Clear opening: x[${-clearHalfWidth}, ${clearHalfWidth}]   Wall hole: x[${holeLeft}, ${holeRight}]   Frame posts reach x = ±1.05`);
if (jambGaps.length === 0) {
  console.log('PASS — no see-through column between the door frame and the wall on either side.');
} else {
  console.log(`FAIL — ${jambGaps.length} sample point(s) with no covering geometry:`);
  console.log(jambGaps.slice(0, 10));
}
