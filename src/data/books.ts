import { projects } from './projects.ts';

export type BookCategory =
  | 'about'
  | 'projects'
  | 'skills'
  | 'experience'
  | 'education'
  | 'ai'
  | 'creative'
  | 'contact';

export interface BookItem {
  title: string;
  detail: string;
}

export interface BookData {
  id: string;
  category: BookCategory;
  title: string;
  subtitle: string;
  spineLabel: string;
  description: string;
  /** Optional structured entries shown below the description (projects, roles, degrees, skill groups). */
  items?: BookItem[];
  status: 'ready' | 'soon';
  /** Cover color, warm-minimal palette only */
  coverColor: string;
  accentColor: string;
  /** relative width multiplier for shelf variation, 1 = baseline */
  thickness: number;
  height: number;
}

export const books: BookData[] = [
  {
    id: 'about',
    category: 'about',
    title: 'About Me',
    subtitle: 'My story',
    spineLabel: 'ABOUT ME',
    description:
      "I'm Ahmed, a Computer Science graduate (BSc, 2026) and full-stack developer based in Sousse, Tunisia, working with React, Next.js, Node.js/Express, and Expo. I care about showing up consistently, owning what I build end to end, and staying open to different people and ways of working. That shapes how I approach both code and collaboration.",
    status: 'ready',
    coverColor: '#4a3b2a',
    accentColor: '#c9a05c',
    thickness: 1,
    height: 1,
  },
  {
    id: 'projects',
    category: 'projects',
    title: 'Projects',
    subtitle: "Things I've built",
    spineLabel: 'PROJECTS',
    description:
      "A few things I've designed and built end to end, on my own initiative and alongside my studies.",
    // Generated from data/projects.ts, the single list of projects — add
    // new ones there and they appear here, on the TV and in the viewing panel.
    items: projects.map((p) => ({
      title: `${p.title}: ${p.tagline}`,
      detail: `${p.role}. ${p.description}`,
    })),
    status: 'ready',
    coverColor: '#5b4636',
    accentColor: '#c9a05c',
    thickness: 1.35,
    height: 1.06,
  },
  {
    id: 'skills',
    category: 'skills',
    title: 'Skills',
    subtitle: 'What I work with',
    spineLabel: 'SKILLS',
    description: 'The tools and ways of working behind the projects above.',
    items: [
      {
        title: 'Web & Mobile',
        detail:
          'React.js, Next.js, TypeScript, JavaScript, HTML5/CSS3, Node.js/Express, Expo/React Native, REST API design, MVC architecture',
      },
      { title: 'Data', detail: 'SQL, SQLite, MongoDB, database design' },
      {
        title: 'Process',
        detail: 'Git/GitHub, UML/systems design, Agile/Scrum (standups, sprint planning, retros)',
      },
      {
        title: 'Transferable',
        detail: 'Teamwork, reliability, adaptability, initiative, clear communication under real deadlines',
      },
    ],
    status: 'ready',
    coverColor: '#3d4a3a',
    accentColor: '#d8bd8a',
    thickness: 0.85,
    height: 0.97,
  },
  {
    id: 'experience',
    category: 'experience',
    title: 'Experience',
    subtitle: 'My journey',
    spineLabel: 'EXPERIENCE',
    description: 'Where I have worked and what I carried forward from it.',
    items: [
      {
        title: 'Full Stack Developer, Accelerant SARL (Feb–May 2026)',
        detail:
          'Delivered reliable results in a professional Agile/Scrum team for four months: daily standups, sprint planning, retrospectives, owning assigned technical problems from start to resolution, and building/integrating web applications and APIs under real-world constraints.',
      },
      {
        title: 'Coding Moon Hackathons',
        detail:
          'Placed 5th (Feb 2025) and 4th (Feb 2026) building working projects under time pressure as part of a team. Patience, adaptability, and staying focused through long, high-pressure days.',
      },
    ],
    status: 'ready',
    coverColor: '#6b3f37',
    accentColor: '#c9a05c',
    thickness: 1.15,
    height: 1.02,
  },
  {
    id: 'education',
    category: 'education',
    title: 'Education',
    subtitle: 'Where I learned',
    spineLabel: 'EDUCATION',
    description: 'The foundations, formal and self-taught.',
    items: [
      {
        title: 'BSc in Computer Science at ISITCOM, Hammam Sousse (2023–2026)',
        detail: 'Software engineering, systems design (UML), databases, and web development, through team projects under real deadlines.',
      },
      {
        title: 'Logistics Engineering, 1st year at ISTLS, Sousse (2022–2023)',
        detail: 'Completed before switching to Computer Science to follow a growing interest in software development.',
      },
      {
        title: 'Baccalaureate, Technical Sciences (2021–2022)',
        detail: 'Othman Chatti High School, Msaken, Sousse.',
      },
      {
        title: 'Certifications',
        detail: 'NVIDIA: Computer Vision for Industrial Inspection · DataCamp: Image Processing in Python · DataCamp: Intermediate SQL · EPI Educational Group: Digital Marketing Workshop',
      },
    ],
    status: 'ready',
    coverColor: '#42392c',
    accentColor: '#d8bd8a',
    thickness: 0.8,
    height: 0.94,
  },
  {
    id: 'ai',
    category: 'ai',
    title: 'AI & Technology',
    subtitle: "What I'm exploring",
    spineLabel: 'AI & TECHNOLOGY',
    description:
      "Current experiments at the edge of what I know: computer vision fundamentals (NVIDIA's Computer Vision for Industrial Inspection) and applied image processing in Python (DataCamp), alongside building this portfolio itself with React Three Fiber.",
    status: 'ready',
    coverColor: '#2f3b42',
    accentColor: '#c9a05c',
    thickness: 1.1,
    height: 1.08,
  },
  {
    id: 'creative',
    category: 'creative',
    title: 'Creative Work',
    subtitle: 'Ideas beyond code',
    spineLabel: 'CREATIVE WORK',
    description:
      "This library itself: a 3D, walkable portfolio built with React Three Fiber instead of a scrolling page. System and interaction design carried over from Spendora, applied to my own space.",
    status: 'ready',
    coverColor: '#5c3a4a',
    accentColor: '#d8bd8a',
    thickness: 0.9,
    height: 0.99,
  },
  {
    id: 'contact',
    category: 'contact',
    title: 'Contact',
    subtitle: "Let's connect",
    spineLabel: 'CONTACT',
    description: 'jatlawiahmed56@gmail.com · +216 23 211 729 · Sousse, Tunisia',
    status: 'ready',
    coverColor: '#463526',
    accentColor: '#c9a05c',
    thickness: 0.75,
    height: 0.92,
  },
];

export const identity = {
  name: 'AHMED JATLAOUI',
  role: 'SOFTWARE DEVELOPER',
  shortName: 'AHMED',
  brand: 'LIBRARY',

  // Reachable contact details. The Contact book used to print these as one
  // line of plain text — no mailto, no tel, nothing to click — so the one
  // moment a visitor decided to get in touch was the moment the site
  // stopped helping them.
  email: 'jatlawiahmed56@gmail.com',
  phone: '+216 23 211 729',
  location: 'Sousse, Tunisia',

  // Fill either in and it appears in the Contact book automatically; leave
  // it empty and nothing is rendered. Deliberately blank rather than
  // guessed — a wrong profile link is worse than no link.
  github: '',
  linkedin: '',

  // Drop a PDF at public/cv/ under this name and the download button
  // appears by itself (see useResumeAvailable) — no code change needed.
  resumeUrl: '/cv/ahmed-jatlaoui.pdf',
};
