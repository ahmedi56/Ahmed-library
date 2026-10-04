// Walk-through test for the entrance wall, run against the REAL collision
// module (node --experimental-strip-types imports the .ts directly) rather
// than a copy of its numbers — so it cannot drift from the code it checks.
//
// The bug it guards: the entrance wall had no collider. Only the doorway
// had one, and only while the door was shut, so a player on the porch
// could walk through the solid wall beside the door and end up inside the
// room without ever using the doorway.

import { collidersFor, resolveMove, ROOM_BOUNDS, PLAYER_RADIUS, DOORWAY_HALF_WIDTH } from '../src/lib/collision.ts';

const DOOR_Z = 5.3;          // Entrance.tsx
const DOOR_HALF_WIDTH = 0.75; // CameraRig.tsx

/** Walks from the porch straight toward the room in small steps. */
function walkThrough(x, doorOpen) {
  const boxes = collidersFor(doorOpen, DOOR_Z, DOOR_HALF_WIDTH);
  let px = x;
  let pz = 7.15; // spawn
  const step = 0.05;
  for (let i = 0; i < 300 && pz > 3.5; i++) {
    const next = resolveMove(px, pz, px, pz - step, boxes);
    if (Math.abs(next.z - pz) < 1e-9 && Math.abs(next.x - px) < 1e-9) break; // wedged
    px = next.x;
    pz = next.z;
  }
  return pz;
}

const INSIDE_Z = DOOR_Z - 0.4; // comfortably past the wall

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};

console.log('--- Entrance wall: can you get in anywhere but the doorway? ---');
console.log(`Doorway clear opening: x[${-DOORWAY_HALF_WIDTH}, ${DOORWAY_HALF_WIDTH}]   player radius ${PLAYER_RADIUS}`);
console.log('');

// Every lane across the wall that is NOT the doorway must be blocked, with
// the door open (the permissive case).
const blockedLanes = [];
for (let x = ROOM_BOUNDS.minX; x <= ROOM_BOUNDS.maxX + 1e-9; x += 0.05) {
  const lane = Math.round(x * 1000) / 1000;
  // A lane is "through the doorway" if the player's whole width fits in it.
  const throughDoorway = Math.abs(lane) + PLAYER_RADIUS <= DOORWAY_HALF_WIDTH;
  const endZ = walkThrough(lane, true);
  const gotIn = endZ < INSIDE_Z;
  if (!throughDoorway && gotIn) blockedLanes.push(lane);
}
check(
  'door OPEN: no lane outside the doorway reaches the interior',
  blockedLanes.length === 0,
  blockedLanes.length ? `${blockedLanes.length} leaking lanes, e.g. x=${blockedLanes.slice(0, 5).join(', ')}` : 'wall is solid'
);

// The doorway itself must still work, or we've walled the player out.
check('door OPEN: walking straight through the doorway gets you in', walkThrough(0, true) < INSIDE_Z);

// With the door shut, nothing gets in at all — including the doorway.
const closedLeaks = [];
for (let x = ROOM_BOUNDS.minX; x <= ROOM_BOUNDS.maxX + 1e-9; x += 0.05) {
  const lane = Math.round(x * 1000) / 1000;
  if (walkThrough(lane, false) < INSIDE_Z) closedLeaks.push(lane);
}
check(
  'door CLOSED: nothing reaches the interior, doorway included',
  closedLeaks.length === 0,
  closedLeaks.length ? `${closedLeaks.length} leaking lanes, e.g. x=${closedLeaks.slice(0, 5).join(', ')}` : 'sealed'
);

console.log('');
process.exit(failures ? 1 : 0);
