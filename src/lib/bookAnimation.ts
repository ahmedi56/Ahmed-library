// Shared timing between useBookInteraction (phase state machine) and
// BookPages (the GSAP timeline that actually animates the grab/carry/open).
// CARRY_DURATION / CLOSE_DURATION are longer than they'd need to be for a short
// hop: the shelf sits against the back wall now, so a book travels most of the
// room's depth to reach the reading spot. Scaled up so the flight still reads
// as a carry, not a whip-fast dash across the room.
export const GRAB_DURATION = 0.32;
export const CARRY_DURATION = 0.85;
export const OPEN_DURATION = 0.85;
export const CLOSE_DURATION = 1.2;

export const OPEN_TOTAL_MS = Math.round((GRAB_DURATION + CARRY_DURATION + OPEN_DURATION) * 1000);
export const CLOSE_TOTAL_MS = Math.round(CLOSE_DURATION * 1000);
