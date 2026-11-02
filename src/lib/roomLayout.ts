/**
 * Room coordinates shared by more than one scene file. The window
 * (LibraryEnvironment.tsx) and the dust drifting in its light shaft
 * (DustParticles.tsx) both need to know where it is.
 *
 * The window is in the RIGHT wall (x = 4.5), centred along its open run
 * (back wall z = -3 to entrance wall z = 5.3): the back wall belongs to
 * the bookshelf and TV, which face the entrance.
 */
export const WINDOW_WALL_X = 4.5;
/** Window centre along the right wall. */
export const WINDOW_Z = 1.15;
export const WINDOW_Y = 0.65;
export const WINDOW_W = 1.8;
export const WINDOW_H = 2.6;
