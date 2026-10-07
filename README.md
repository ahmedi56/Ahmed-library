# Ahmed Jatlaoui — Library Portfolio

An interactive 3D personal library, built as a portfolio homepage. Each book on
the shelf is a navigation element into a section of the portfolio (About,
Projects, Skills, Experience, Education, AI & Technology, Creative Work,
Contact).

Style direction: **Warm Minimal** — an arched doorway framing a light,
airy interior, warm interior light against a cool blue-hour window, brass
and walnut detailing.

## Stack

React 19 + TypeScript + Vite, Three.js via React Three Fiber + drei, GSAP for
the book animations, Tailwind v4 for the HTML UI layer, lucide-react for
icons, Firebase (Firestore + Google Auth) for the owner-editable room, and
two serverless functions (`/api/search`, `/api/librarian`).

## Getting started

```bash
npm install
npm run dev       # dev server, also serves /api/search and /api/librarian
npm run build     # production build (tsc -b && vite build)
npm run preview   # preview the production build
npm run lint      # oxlint
npm run test:e2e  # smoke tests (Playwright, uses the installed Microsoft Edge)
```

## What's in the room

- **The shelf**: eight books, one per section (`src/data/books.ts`). Walk
  up, look at one, press E (or tap USE) to open it.
- **The wall TV and the viewing mode**: a 2.8 m screen cycling through the
  projects. Pressing E on it, or on any project object in the room (the
  cleaning set, the stack of manuals, the phone), walks the camera to a
  viewing spot and opens a panel with the project's details, technologies
  and links. ← → browse; Esc walks back. `?project=<slug>` links straight in.
- **Guided tour** (TOUR button): the camera visits each book in turn.
- **Ask the librarian** (ASK button): questions answered by Claude from the
  site's own content (`api/_librarian.ts`).
- **The PC**: a real web search (`api/_exaSearch.ts`), plus one question it
  answers itself.
- **Borrower's card** (J, or the counter top-left): stamps for exploring,
  ranks, a secret or two, and a shareable card image.
- Sound effects (synthesized, mutable), day/dusk/night by the visitor's
  clock (`?time=day|dusk|night` to preview), idle jokes, a welcome-back
  note for returning visitors.
- Performance tiers (Low / Medium / High), auto-detected and switchable;
  `prefers-reduced-motion` respected; a plain, fully navigable flat view
  (SKIP) for anyone who doesn't want — or can't run — the 3D room.

## Adding a project

Projects are data, not 3D code. Open `src/data/projects.ts`, copy the
commented template at the end of the list, fill it in, save. That's all:

- it appears on the wall TV, in the Projects book, in the viewing panel's
  list, and in what the librarian knows;
- `slug` gives it a link: `/?project=<slug>`;
- optional fields (`highlights`, `media.image`, `media.video`,
  `links.github`, `links.live`) show only when filled — nothing empty or
  made-up is ever displayed;
- media files go in `public/` (e.g. `public/videos/my-project.mp4`, then
  `media: { video: '/videos/my-project.mp4' }`). A video plays on the TV;
  an image shows in the viewing panel.

A new project doesn't get its own physical object in the room — those are
hand-placed in `src/data/projectAnchors.ts` with world coordinates. It
doesn't need one: the TV shows every project, and every object leads there.

If you've edited a project's text in the Settings panel, that saved copy
(Firestore) takes precedence over `projects.ts` for the TV's text.

## Architecture

```
src/
├── components/
│   ├── library/        3D scene: shelf, books, environment (walls, TV, desk…),
│   │                   lighting, camera rig, crosshair interaction
│   ├── ui/             HTML layer: navigation, book panel, viewing mode
│   │                   (ProjectTheatre), tour, librarian, borrower's card…
│   └── RoomView.tsx    The lazily loaded room: the only code that loads
│                       three.js and Firebase. Keep it that way.
├── data/               books.ts, projects.ts (single source for projects),
│                       projectAnchors.ts (project objects' positions)
├── hooks/              state: book interaction, customization (Firestore),
│                       TV playlist, challenges, performance…
├── lib/                shared helpers: tvLayout, tourInput (camera channel),
│                       audio/sfx, deep links, time of day…
└── pages/Home.tsx      wires it together
api/                    serverless functions + their shared logic
tests/                  Playwright smoke tests
```

## Deploying

The client is a plain static Vite build (`npm run build` -> `dist/`), plus one
serverless function.

1. **Environment variables.** Set these on the host (not in the repo):
   - `EXA_API_KEY` — server-side only, powers `/api/search` (the in-room PC).
     Never prefix it with `VITE_`; that would put it in the client bundle.
   - `VITE_FIREBASE_*` — the six values from `.env.example`. These *are* meant
     to be public (every Firebase web app ships them); access is controlled by
     Firestore Security Rules. Without them the room still runs, and the
     Settings panel says changes won't persist.
   - `VITE_OWNER_UID` — the only account allowed to edit the room. Empty
     means nobody can, which is the safe default.
   - `ANTHROPIC_API_KEY` — server-side only, powers "Ask the librarian". Set
     a monthly spend limit in the Anthropic Console too.

2. **Lock down Firestore before sharing the link.** The Settings panel
   writes the certificate frames and the bedside photo into shared
   documents, so without rules any visitor can change what everyone else
   sees.
   - Enable Google sign-in: Firebase console → Authentication → Sign-in
     method → Google, and add your domain under Authorised domains.
   - Visit the site once at `/?admin=1`, click SIGN IN, then copy your uid
     from Authentication → Users.
   - Paste it into `VITE_OWNER_UID` **and** into `ownerUid()` in
     `firestore.rules`, then `firebase deploy --only firestore:rules`.
   - The SETTINGS button only appears for that account. `?admin=1` merely
     reveals the sign-in button; the rules are what actually enforce this.

3. **Link previews.** Replace `https://example.com` in `index.html` with
   the real domain (canonical, `og:url`, `og:image`, `twitter:image` —
   these must be absolute), and drop a 1200x630 JPEG at
   `public/og-image.jpg`. See `public/og-image-README.txt`.
4. **The endpoints.** `api/search.ts` and `api/librarian.ts` are Web-standard
   request/response handler, picked up automatically as a function by Vercel
   and by Netlify's Vite plugin. On a host that serves static files only, the
   PC and the librarian say they're unavailable rather than failing
   silently — the rest of the room is unaffected.
5. **Assets.** Everything in the 3D scene is generated at runtime (canvas
   textures, procedural geometry) — there are no model or texture files to
   ship. `public/videos/` is empty by design: drop `.mp4` files matching the
   `media.video` paths in `src/data/projects.ts` and the wall TV plays them;
   otherwise it shows each project's designed slide.
6. **Routing.** Single page, no client router, so no SPA rewrite rule is
   needed beyond serving `dist/index.html` at `/`.
7. **Fonts.** Body/heading type comes from Google Fonts and the book-spine
   type from a jsDelivr-hosted Fraunces file (`BookMesh.tsx`). Both are
   runtime CDN requests — worth self-hosting if you add a strict CSP or need
   the site to work offline.

## Notes for the next pass

- Book spine text uses drei's default troika font. Swap in a licensed
  Fraunces webfont file for spine text if pixel-perfect typography matters.
- `usePerformance`'s device detection is heuristic (cores/memory/UA sniffing).
  Consider swapping in a real FPS-sampling auto-downgrade for production.
- The open-book focus view is a simple two-panel hinge; a page-turn animation
  library (e.g. a custom shader) would sell the "real book" feeling further.
