/**
 * Every project, in one place.
 *
 * This file is the single source for:
 *   - the wall TV's slides and playlist (via data/projectVideos.ts)
 *   - the Projects book on the shelf (data/books.ts)
 *   - the project viewing panel (ui/ProjectTheatre.tsx)
 *   - "Ask the librarian" (api/_librarian.ts)
 *
 * ADDING A PROJECT: copy one entry, fill it in, save. Nothing in the 3D
 * scene needs touching — it appears on the TV, in the Projects book and in
 * the viewing panel's list automatically. Optional fields can be left out;
 * nothing is shown for them (no empty boxes, no placeholder links).
 *
 * Only state what is true. Everything below matches the CV.
 */
export interface Project {
  /** Stable id, used in links (?project=freshly). Lowercase, no spaces. */
  slug: string;
  title: string;
  /** One line under the title: what it is. */
  tagline: string;
  /** Two or three sentences: what it does and what you did. */
  description: string;
  /** Your part in it, e.g. "Solo, end to end" or "System & Interaction Designer". */
  role: string;
  /** Technologies actually used. Leave empty rather than guess. */
  technologies: string[];
  /** Short highlights shown as a list in the viewing panel. */
  highlights?: string[];
  /** Optional media. Put files in public/ and use paths like "/videos/x.mp4". */
  media?: {
    /** Plays on the wall TV and in the viewing panel. */
    video?: string;
    /** A screenshot, shown in the panel when there is no video. */
    image?: string;
  };
  links?: {
    github?: string;
    live?: string;
  };
}

export const projects: Project[] = [
  {
    slug: 'freshly',
    title: 'Freshly',
    tagline: 'Cleaning-services marketplace',
    description:
      'A marketplace for booking cleaning services, built end to end: one Express API on SQLite powering a Next.js web app for customers and admins, and an Expo mobile app for service providers.',
    role: 'Independent project, solo',
    technologies: ['Express', 'SQLite', 'Next.js', 'Expo (React Native)'],
    highlights: [
      'One shared API serving both the web and the mobile app',
      'Database design, API architecture and both front ends, built solo',
    ],
    media: { video: '/videos/freshly.mp4' },
  },
  {
    slug: 'prowise',
    title: 'Prowise',
    tagline: 'Product guide & maintenance platform',
    description:
      'A guide platform for product technology, use and maintenance, organizing four content types (video, PDF, step-by-step guides and repair information) into one clear structure.',
    role: 'Independent project',
    technologies: [],
    highlights: ['Four kinds of content, one navigable system', 'Complex information made usable for end users'],
    media: { video: '/videos/prowise.mp4' },
  },
  {
    slug: 'spendora',
    title: 'Spendora',
    tagline: 'Finance mobile app',
    description:
      'A team-built finance app. As System & Interaction Designer, designed the use case, sequence and class diagrams that turned the product idea into a plan the team could build from.',
    role: 'Team project, System & Interaction Designer',
    technologies: ['UML'],
    highlights: [
      'Use case, sequence and class diagrams',
      'Worked with the developers to fit the design to real implementation constraints',
    ],
    media: { video: '/videos/spendora.mp4' },
  },

  // ---------------------------------------------------------------------
  // ADD THE NEXT PROJECT HERE — copy, uncomment, fill in:
  //
  // {
  //   slug: 'my-project',
  //   title: 'My Project',
  //   tagline: 'What it is, in a few words',
  //   description: 'What it does and what you built.',
  //   role: 'Independent project',
  //   technologies: ['React', 'Node.js'],
  //   highlights: ['One thing worth knowing', 'Another'],
  //   media: { image: '/projects/my-project.png' },
  //   links: { github: 'https://github.com/…', live: 'https://…' },
  // },
  // ---------------------------------------------------------------------
];

/** The one-line stack shown on the TV: technologies if known, else the tagline. */
export function stackLine(p: Project): string {
  return p.technologies.length > 0 ? p.technologies.join(' · ') : p.tagline;
}
