import { FURNITURE_COLLIDERS, PLAYER_RADIUS } from './collision';
import { TV_SCREEN_WORLD, TV_VIEW_STAND } from './tvLayout';
import { WINDOW_WALL_X, WINDOW_Y, WINDOW_Z } from './roomLayout';

/**
 * "Go to": named places in the room the camera can take a visitor to
 * without WASD — the biggest hurdle for anyone who doesn't play games.
 * Each is a spot to stand (clear of every collider in lib/collision.ts,
 * with the player's radius) and a point to face.
 */
export interface Destination {
  id: string;
  label: string;
  stand: [number, number];
  look: [number, number, number];
}

export const DESTINATIONS: Destination[] = [
  // 1.7 m from the books, level with them: close enough to aim and open one.
  { id: 'shelf', label: 'Bookshelf', stand: [0, -1.0], look: [0, -0.75, -2.72] },
  { id: 'tv', label: 'Projects TV', stand: TV_VIEW_STAND, look: TV_SCREEN_WORLD },
  // Behind the chair, facing the laptop (desk group at 1.9, 1.9, turned −0.35 rad).
  { id: 'desk', label: 'Desk and laptop', stand: [1.35, 3.4], look: [2.0, -1.25, 2.0] },
  // Left wall, between the first two certificate frames (CertificateWall).
  { id: 'certificates', label: 'Certificates', stand: [-2.2, -1.0], look: [-4.44, -0.3, -1.0] },
  // Far enough back (~3.7 m) for the window and both flanking frames to
  // fit without looking steeply up; the sightline passes in front of the desk.
  { id: 'window', label: 'Window', stand: [0.8, 0.3], look: [WINDOW_WALL_X, WINDOW_Y - 0.5, WINDOW_Z] },
];

/**
 * Whether walking straight from one spot to another stays clear of the
 * furniture. Sampled every 10 cm against each collider grown by the
 * player's radius — the same footprint the walk camera itself uses.
 */
export function pathClear(x0: number, z0: number, x1: number, z1: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.1));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const z = z0 + (z1 - z0) * t;
    for (const b of FURNITURE_COLLIDERS) {
      if (
        x > b.minX - PLAYER_RADIUS &&
        x < b.maxX + PLAYER_RADIUS &&
        z > b.minZ - PLAYER_RADIUS &&
        z < b.maxZ + PLAYER_RADIUS
      ) {
        return false;
      }
    }
  }
  return true;
}
