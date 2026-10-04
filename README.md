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
the camera approach animation, Tailwind v4 for the HTML UI layer, lucide-react
for icons.

## Getting started

```bash
npm install
npm run dev       # start local dev server
npm run build     # production build (runs tsc -b && vite build)
npm run preview   # preview the production build
```

## What's implemented (v1 scope)

- 3D library environment: arch frame, floor, back/side walls, desk with
  laptop/lamp/book stack, blue-hour window
- Hero bookshelf with 8 data-driven books (`src/data/books.ts`), each with
  slight organic variation in thickness/height/rotation
- Book hover (pulls forward, tilts, highlights) and click (opens, shows
  placeholder content panel)
- Cinematic camera: idle mouse parallax + GSAP-eased approach on book select
- Loading screen, intro overlay that fades after first interaction
- Minimal top nav + full-screen menu overlay
- Performance tiers (High / Medium / Low) — auto-detected from device
  memory/cores, user-overridable, persisted to localStorage
- `prefers-reduced-motion` respected (disables parallax, book easing snaps
  instead of tweens)
- WebGL-unsupported fallback: a 2.5D grid version of the same library that
  stays fully navigable

## Architecture

```
src/
├── components/
│   ├── library/       3D scene: Bookshelf, Book, environment, lighting,
│   │                  camera rig, dust particles, open-book pages
│   └── ui/             HTML overlay: nav, intro, hover label, content
│                        panel, loading screen, perf controls, fallback
├── data/books.ts       Single source of truth for all book content
├── hooks/               useBookInteraction (state machine), usePerformance,
│                        useReducedMotion, useWebGLSupport
└── pages/Home.tsx       Wires it all together
```

## Not yet implemented (deliberately out of scope for v1)

Full section pages (About/Projects/etc. content), routing between sections,
contact form backend, CMS/analytics — see the prompt's "first version scope."
The `BookContent` panel currently shows a placeholder description per book;
wiring real section routes is the natural next step.

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
4. **The search endpoint.** `api/search.ts` is a Web-standard
   request/response handler, picked up automatically as a function by Vercel
   and by Netlify's Vite plugin. On a host that serves static files only, the
   PC reports that search is unavailable rather than failing silently — the
   rest of the room is unaffected.
5. **Assets.** Everything in the 3D scene is generated at runtime (canvas
   textures, procedural geometry) — there are no model or texture files to
   ship. `public/videos/` is empty by design: drop `.mp4` files matching the
   `src` paths in `src/data/projectVideos.ts` and the wall TV plays them,
   otherwise it cycles designed project slides.
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
