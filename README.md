<div align="center">

# Ahmed Jatlaoui · Library Portfolio

**A portfolio you walk into.** A warm 3D reading room where every book on the shelf opens a section of my work.

[**Visit the library**](https://ahmedjatlaoui.vercel.app) &nbsp;·&nbsp; [GitHub](https://github.com/ahmedi56)

![React](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-000000?logo=threedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06b6d4?logo=tailwindcss&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-dd2c00?logo=firebase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)

</div>

---

## Overview

Instead of a page to scroll, visitors step through an arched doorway into a small library. Eight books on the shelf lead to **About, Projects, Skills, Experience, Education, AI & Technology, Creative Work** and **Contact**. A wall TV plays the projects, a desk PC searches the web, and a librarian answers questions about my work.

**Design direction: Warm Minimal.** A light, airy interior with warm lamp light against a cool blue window, finished in brass and walnut.

## Features

| | |
|---|---|
| **Tutorial** | A short, skippable walkthrough on the first visit, in the style of a video game. Replay it any time from the header. |
| **Go to** | Pick a place (bookshelf, projects TV, desk, certificates, window) and the camera walks you there. No keyboard needed. |
| **The bookshelf** | Look at a book and press **E** (or tap **USE**) to open its section. |
| **Projects TV** | A 2.8 m screen cycling through the projects. Opening it shows details, technologies and links. **← →** to browse, **Esc** to step back. |
| **Ask the librarian** | Questions answered by AI using only the site's own content (Gemini free tier, swappable for any OpenAI-compatible provider). |
| **The desk PC** | A real web search, powered by Exa. |
| **Borrower's card** | Stamps for exploring, ranks, a few secrets, and a card image to share. Press **J**. |
| **Atmosphere** | Day, dusk or night by the visitor's clock, synthesized sound effects (mutable) and a note for returning visitors. |
| **Accessible by design** | Low / Medium / High quality tiers, `prefers-reduced-motion` respected, and a plain flat view (**SKIP**) for anyone who prefers not to use the 3D room. |

**Deep links:** `/?book=about`, `/?project=<slug>`, `/?time=day|dusk|night`

## Tech stack

| Layer | Tools |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS v4, lucide-react |
| 3D | Three.js via React Three Fiber and drei, GSAP animations |
| Data | Firebase (Firestore and Google Auth) for the owner-editable room. Visitors read it over Firestore's REST API; only the owner loads the SDK |
| Server | Two Vercel serverless functions: `/api/search` and `/api/librarian` |
| Quality | oxlint, Playwright smoke tests |

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the keys you need
npm run dev            # http://localhost:5173, also serves both /api routes
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type-check and production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |
| `npm run verify` | Check the room's wall geometry |
| `npm run test:e2e` | Smoke tests (Playwright, uses the installed Microsoft Edge) |

Every key is optional. Without them the room still runs: the PC and the librarian say they're unavailable, and settings don't persist.

## Adding a project

Projects are data, not 3D code. Open `src/data/projects.ts`, copy the template at the end of the list, and fill it in. The project then appears:

- on the wall TV, in the Projects book and in the viewing panel
- in what the librarian knows
- at its own link: `/?project=<slug>`

Optional fields (`highlights`, `media.image`, `media.video`, `links.github`, `links.live`) only show when filled, so nothing empty is ever displayed. Media files go in `public/`, for example `public/videos/my-project.mp4` with `media: { video: '/videos/my-project.mp4' }`.

> Project text edited in the Settings panel is saved in Firestore and takes priority over `projects.ts`.

## Project structure

```
src/
├── components/
│   ├── library/      3D scene: shelf, books, walls, TV, desk, lighting, camera
│   ├── ui/           HTML layer: navigation, book panel, viewing mode,
│   │                 tutorial, Go to menu, librarian, borrower's card
│   └── RoomView.tsx  The lazily loaded room. The only code that loads
│                     three.js and Firebase; keep it that way.
├── data/             books, projects (single source), project object positions
├── hooks/            book interaction, Firestore customization, TV playlist…
├── lib/              layout constants, camera channel, travel, audio, deep links
└── pages/Home.tsx    wires it all together
api/                  serverless functions and their shared logic
tests/                Playwright smoke tests
```

## Deployment

The site is a static Vite build plus two serverless functions, deployed on **Vercel**. Every push to `main` deploys automatically.

### Environment variables

Set these in the host's settings, never in the repository.

| Variable | Side | Purpose |
|---|---|---|
| `EXA_API_KEY` | Server | Web search for the desk PC |
| `LIBRARIAN_API_KEY` | Server | The librarian. Free Gemini key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Without it the Ask button is hidden. |
| `LIBRARIAN_BASE_URL`, `LIBRARIAN_MODEL` | Server | Optional: switch to another OpenAI-compatible provider (see `.env.example`) |
| `VITE_FIREBASE_*` | Browser | The six Firebase web config values. Public by design; access is controlled by Firestore rules. |
| `VITE_OWNER_UID` | Browser | The only account allowed to edit the room. Empty means nobody can. |

Server keys must **never** start with `VITE_`, as that would ship them to the browser.

### Securing Firestore

The Settings panel writes shared documents, so lock them down before sharing the link:

1. Enable Google sign-in in Firebase (Authentication › Sign-in method) and add your domain under Authorised domains.
2. Visit `/?admin=1`, sign in, and copy your uid from Authentication › Users.
3. Put it in `VITE_OWNER_UID` and in `ownerUid()` in `firestore.rules`, then run `firebase deploy --only firestore:rules`.

`?admin=1` only reveals the sign-in button. The Firestore rules are what enforce access.

### Notes

- **Link previews:** the URLs in `index.html` point to `ahmedjatlaoui.vercel.app`, and `public/og-image.jpg` (1200×630) is the picture shown when the link is shared. To replace it, see `public/og-image-README.txt`.
- **Assets:** the whole scene is generated at runtime (canvas textures, procedural geometry), so there are no model or texture files to ship.
- **Fonts:** loaded from Google Fonts and jsDelivr. Self-host them if you add a strict Content Security Policy.

## Roadmap

- Replace the default spine font with a licensed Fraunces webfont
- Automatic quality downgrade based on measured frame rate
- A page-turn animation for the open book

---

<div align="center">

Designed and built by **Ahmed Jatlaoui**

</div>
