export interface ProjectVideo {
  /** Project name, shown on the TV's title bar. */
  title: string;
  /** Tech stack / short description, shown under the title. */
  stack: string;
  /** One or two sentences shown on the TV's fallback slide when no video is playing. */
  description: string;
  /**
   * Path to the video file. Drop .mp4 files into public/videos/ (created
   * for you — e.g. public/videos/project-1.mp4) and they're served at
   * "/videos/project-1.mp4"; a full https:// URL works too. Nothing else
   * in the TV system needs to change to add, remove, or reorder projects —
   * just edit this array.
   */
  src: string;
}

/**
 * The in-room TV's playlist (LibraryEnvironment.tsx: WallTV / useProjectShowcase).
 * Plays in order, loops back to the start after the last one. No video files
 * ship with the project yet, so the TV cycles through a designed slide per
 * project (title, stack, description) instead of playing dead video sources —
 * see useProjectShowcase.ts / the idle canvas in WallTV. Drop matching .mp4
 * files into public/videos/ later and real video takes over automatically.
 */
export const projectVideos: ProjectVideo[] = [
  {
    title: 'Freshly',
    stack: 'Express · SQLite · Next.js · Expo',
    description:
      'Cleaning-services marketplace, built end to end: one Express/SQLite API powering a Next.js web app for customers/admin and an Expo mobile app for cleaners.',
    src: '/videos/freshly.mp4',
  },
  {
    title: 'Prowise',
    stack: 'Product Guide Platform',
    description:
      'A full guide platform for product technology, use, and maintenance, organizing four content types: video, PDF, step-by-step guides, and repair information.',
    src: '/videos/prowise.mp4',
  },
  {
    title: 'Spendora',
    stack: 'System & Interaction Design',
    description:
      'Finance mobile app built with a team of four. Designed the use case, sequence, and class diagrams that turned the product idea into a plan the team could build from.',
    src: '/videos/spendora.mp4',
  },

  // ---------------------------------------------------------------------
  // ROOM FOR MORE PROJECTS — copy the block below, uncomment it, and fill
  // it in. Nothing else needs editing: the slot id (`project-4`, then
  // `project-5`, ...) is derived from this array's order, and it flows
  // automatically to the TV playlist, the Settings panel's editable rows,
  // and the Firestore seed. Leave `src` as '' to show the designed slide
  // with no video.
  //
  // The one thing a new entry does NOT get is a physical object in the
  // room to walk up to — those are hand-placed in data/projectAnchors.ts
  // and each needs real world-space coordinates. Until you add one, the
  // new project still appears in the wall TV's rotation (the TV anchor
  // speaks for whatever is on screen), which is the intended fallback.
  //
  // {
  //   title: 'Project name',
  //   stack: 'Tech · stack · here',
  //   description: 'One or two sentences shown on the TV slide.',
  //   src: '',
  // },
  // ---------------------------------------------------------------------
];
