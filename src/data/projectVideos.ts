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

import { projects, stackLine } from './projects.ts';

/**
 * The in-room TV's playlist (LibraryEnvironment.tsx: WallTV / useProjectShowcase),
 * derived from data/projects.ts — add projects there, not here.
 *
 * Kept as its own shape because the TV slots are owner-editable from the
 * Settings panel and saved to Firestore as { title, stack, description,
 * src }; slot ids (`project-1`, `project-2`, ...) follow this array's order,
 * which is projects.ts's order. With no video file, the TV shows a designed
 * slide for the project instead.
 */
export const projectVideos: ProjectVideo[] = projects.map((p) => ({
  title: p.title,
  stack: stackLine(p),
  description: p.description,
  src: p.media?.video ?? '',
}));
