# Session handoff — ahmed-library

Paste this whole file (or say "read HANDOFF.md") at the start of the next session.

---

## 1. Goal

`C:\Users\T560\Desktop\ahmed-library` — Ahmed Jatlaoui's portfolio: a walkable 3D
library where each book is a section (About, Projects, Skills, Experience,
Education, AI, Creative, Contact).

**Objective: get it correct and deployable.** Fix what is broken, complete what is
half-done, verify what already exists. Do **not** rebuild it, and do not add
features that were not asked for. The codebase is deliberate and heavily
commented — read the comments before changing anything; most explain a bug that
was already fixed once.

## 2. Stack (NOT the usual MERN — don't assume)

React 19 + TypeScript + Vite 8 (rolldown) · Three.js via R3F/drei · GSAP ·
Tailwind v4 · Firebase (Firestore + Google Auth) · Exa search via a serverless
function. **No MongoDB, no Express, no React Native, no client router.**

```
npm run dev      # Vite dev server (:5173) — also serves /api/search middleware
npm run build    # tsc -b && vite build
npm run lint     # oxlint
npm run preview  # :4173
```

Preview configs already exist in `.claude/launch.json`
(`ahmed-library-dev`, `ahmed-library-preview`).

### Architecture rule that must not be broken

`RoomView` is lazy-loaded and is the **only** thing that touches three.js and the
Firebase SDK. `CustomizationProvider` lives inside it on purpose. Importing
Firebase or three from `Home.tsx` / `App.tsx` / `FallbackLibrary.tsx` drags
157 kB (Firebase) or 350 kB (three) into the entry bundle and hurts the flat view
worst — the people who chose it for being light. Current split, keep it this way:

| chunk | size | gzip |
|---|---|---|
| entry `index` | 40.75 kB | 14.23 kB |
| react-vendor | 189.59 kB | 59.61 kB |
| firebase | 531.80 kB | 156.82 kB |
| RoomView | 1,238.70 kB | 349.20 kB |

### Security model

`firestore.rules` is the only real enforcement. The Firebase web config is public
by design; `VITE_OWNER_UID` and the `?admin=1` flag only decide what the UI
*offers*. `EXA_API_KEY` is the one true secret — never `VITE_`-prefixed, server-side
only. Owner uid is hardcoded in both `.env` and `firestore.rules::ownerUid()` —
changing it means changing both and running `firebase deploy --only firestore:rules`.

## 3. State: ⚠️ NOT a git repository

There is **no version control**. No branches, no diff, no undo. Back up before any
sweeping edit (`cp -r` to a dated folder), and prefer small reversible changes.
Offering to run `git init` would be reasonable and useful.

Build, typecheck and lint are all **clean** as of this handoff.

## 4. Last changes (done + verified)

### Session A — content corrected against the real CV
Source of truth: `C:\Users\T560\Downloads\Ahmed_Jatlaoui_CV.pdf`. All in
`src/data/books.ts`:

- Education dates were a year late. BSc ISITCOM `2024–2026` → **`2023–2026`**;
  Logistics ISTLS `2023–2024` → **`2022–2023`**.
- Added missing **Baccalaureate, Technical Sciences (2021–2022)**, Othman Chatti
  High School, Msaken.
- Added 4th certificate: **EPI Educational Group: Digital Marketing Workshop**.
- About said "a Computer Science *student* … finishing my BSc" — the BSc ended
  Jun 2026 → now "Computer Science graduate (BSc, 2026) and full-stack developer".
- **Prowise** was credited "Built during my Accelerant internship" — the CV lists
  it as an *Independent project* → corrected, and the Projects intro no longer
  says "during my internship".
- Skills were missing TypeScript, JavaScript, HTML5/CSS3, MVC architecture,
  MongoDB, GitHub → added.

### Session A — room for more projects
The project pipeline is **fully data-driven**: add one entry to
`src/data/projectVideos.ts` and the slot id, TV playlist, Settings row and
Firestore seed all follow automatically. Verified by temporarily adding a 4th
project (rendered, typechecked, no console errors, discovery tally correctly
stayed 15). Commented copy-paste templates left in `projectVideos.ts` and
`books.ts`.

**Known limit:** a new project gets **no walk-up object** in the room —
`src/data/projectAnchors.ts` entries are hand-placed world-space coordinates.
New projects ride the wall-TV rotation instead, which is the intended fallback.

### Session B — CV upload/download feature (new)
Owner uploads a PDF from the Settings panel; visitors download it. No redeploy.

New files: `src/lib/storedResume.ts`, `src/hooks/useResume.ts`.
Touched: `useCustomization.tsx`, `SettingsPanel.tsx`, `Home.tsx`,
`FallbackLibrary.tsx`, `fileData.ts`.

Design decisions, each deliberate:
- Reads go over the **Firestore REST API with no SDK**, because both download
  buttons live outside `CustomizationProvider` (see architecture rule above).
  Entry bundle grew only +0.7 kB gzipped.
- Startup read uses a **field mask** (`filename`, `size`) so visitors don't
  download the base64 PDF just to decide whether to draw a button; bytes are
  fetched on click.
- The CV gets its **own document** `profile/resume`, not a field on
  `profile/main` — sharing risked either pushing the other past Firestore's
  1 MiB cap, and every photo save would rewrite the whole CV.
- `setResume` **awaits** the write and surfaces failures in the UI, unlike the
  older writers that swallow errors into `console.warn`.
- Cap 700 KB (1 MiB minus ~33% base64 inflation). Non-PDF and oversized files
  rejected before reading.
- A shared in-flight promise deduped the startup read 3 → 1.
- `firestore.rules` needed **no change** — `profile/{id}` already covers it.

Verified: REST probed live (`profile/resume` → clean 404 → falls back;
`profile/main` → 200 without auth/SDK). Button appears/disappears correctly in
both the 3D room and flat view. Panel renders correctly.

**NOT verified — do this first:** the actual upload write path needs a Google
sign-in as Ahmed, which only he can perform. Watch the first real upload; a
failure shows a red message rather than failing silently.

### Session C (2026-10-04) — §5 items 1–5 fixed
Backup taken first: `C:\Users\T560\Desktop\ahmed-library-backup-2026-10-04`.

- **#1/#2** `useCustomization.tsx`: updaters are now pure; writes go through
  `scheduleSave(key)` — per-document 500 ms debounce, reading the latest
  state from a ref when the timer fires. Pending saves flush on `pagehide`
  and on provider unmount (leaving the room).
- **#3** Failures set `saveError`, shown as a red banner at the top of the
  Settings panel until that document saves successfully. Image rows check
  the resized data URL against `MAX_INLINE_IMAGE_CHARS` (950 KB,
  `fileData.ts`) before applying it, and report decode failures.
- **#4** `_exaSearch.ts`: `q` capped at 200 chars (400); in-memory
  fixed-window limits of 10/min per client and 40/min overall (429).
  Per warm instance only — set a usage cap in the Exa dashboard as the
  hard backstop.
- **#5** Results with non-http(s) or missing URLs are dropped server-side.

Verified: build + typecheck clean, entry chunk unchanged; limiter, cap and
URL filter unit-tested with a mocked Exa; dev middleware returns the 400s;
room loads with no new console errors. **Not verified:** the debounced
write path and the error banner, which need Ahmed's owner sign-in. Test:
type in a frame title, wait 1 s, reload → title persists, one write per pause.

### Session C, part 2 — challenges ("borrower's card")
Asked for by Ahmed. Rewards are library date-due stamps on a borrower's card.
- `src/hooks/useChallenges.ts` — list of 9 challenges + 1 secret, ranks
  (Visitor → Head librarian), earned stamps in localStorage `library-card-v1`.
  Add a challenge: one entry in `CHALLENGES` + one `earn('id')` in Home.
- `src/components/ui/BorrowerCard.tsx` — `StampToast` (queued, one at a
  time) and the card dialog; completion shows Email / Download CV. Lazy
  chunk (2.3 kB gz) so the flat view doesn't pay for it.
- Opened with **J** or by clicking the discovery tally (now a button).
- Detection lives in `Home.tsx` ("Challenge detection" block).
- `useCloseOnEscape` now keeps a stack — Escape closes only the topmost
  dialog (previously closed every open dialog at once).
- Entry chunk 14.23 → 15.78 kB gz.

Skills installed for future sessions: `frontend-design`,
`web-design-guidelines`, `webapp-testing`.

Open review finding: `api/search.ts` falls back to spoofable
X-Forwarded-For on hosts other than Vercel/Netlify — per-client limit is
bypassable there (global cap still holds). Deploy on Vercel/Netlify.

### Session C, part 3 — design review (Vercel Web Interface Guidelines)
- New `src/hooks/useDialogFocus.ts`: every overlay (book, settings, borrower's
  card, project detail, menu) moves focus to its panel on open and returns
  it on close. Panels are `tabIndex={-1}` so screen readers start at the title.
- `BookContent` is `inert` while faded out (it stays mounted during the
  shelf animation).
- Menu: Escape closes it, dialog semantics, `justify-center-safe` so short
  screens don't clip the top items.
- PC search: labelled `type="search"` input with a visible focus ring,
  focus styles on all buttons, results/errors announced via `aria-live`,
  untitled results fall back to the hostname.
- Settings inputs have `aria-label`s; loading labels end with `…`.
- `transition-all` → `transition-[opacity,translate]` (4 components).
- Project clips don't autoplay under prefers-reduced-motion.
- Google Fonts moved from a CSS `@import` to `<link>` + preconnect in
  `index.html`; preconnect to Firestore added.
- `touch-action: manipulation` + brass tap highlight on controls.
- Deliberately NOT changed: the all-caps tracked label style (it's the brand).

### Session C, part 4 — sound effects + "hire" easter egg
- All sound is **synthesized** (Web Audio), no files: same no-unlicensed-
  assets stance as footsteps.ts. `src/lib/audio.ts` = shared context +
  master gain + mute (localStorage `library-muted`); `src/lib/sfx.ts` = the
  kit: page flip / book close / door creak / lamp switch / stamp / fanfare /
  ghost (poltergeist secret) / keyboard typing. Footsteps now route through
  the same master, so mute silences everything.
- Mute button added to the bottom-right quality pill.
- Levels measured with an AnalyserNode: all effects peak 0.06–0.21; muted = 0.
- PC easter egg: "Should I hire Ahmed?" (any hire/recruit + ahmed/him/you)
  answers locally — no Exa call — with a checklist of true facts and an
  Email button; earns new secret stamp `good-taste`. Also a suggestion chip.
- Not verified visually: the egg panel (opening the PC needs aiming in 3D).
- Entry chunk now 18.63 kB gz.

### Session C, part 5 — idle jokes + "overdue" greeting
`src/components/ui/RoomQuips.tsx` (lazy chunk, 1.6 kB gz), rendered by Home.
- Returning visitor (last visit > 30 min ago, localStorage
  `library-last-visit`): welcome-back slip mentioning card progress, plus
  "You're N days overdue. We'll waive the fine." Desk-bell sound. The
  visit is read+stamped at module load, not in a component, so StrictMode's
  double render can't swallow it.
- Idle 30 s with nothing open → a joke slip + knock-knock sound; any input
  dismisses it; max 4 per visit, never the same twice in a row,
  mouse/keyboard jokes skipped on touch. Jokes live in `QUIPS`.
- Both wait for any stamp toast and sit under every panel (z-20).
- Verified in browser: greeting text (3 days, 3 of 9), joke at 30.0 s,
  gone at 36.5 s, dismissed on mousemove, no greeting on quick reload.
  Note: timers run slow while the preview pane is hidden.

### Session C, part 6 — guided tour, git, smoke tests, day/night
- **Git now exists** (branch `main`, local author set in repo config only).
  `.env` is ignored; secret scan of the first commit was clean.
- **Guided tour** (`src/components/ui/GuidedTour.tsx`, room chunk;
  `src/lib/tourInput.ts` drives CameraRig like touchInput does). Header
  "TOUR" button + menu entry. Fade-cut to x = 3.25 (clear of shelf and
  desk colliders), glide + turn to each book, open, read (4.5–9 s by word
  count), next. Pause / Next / End; closing a book = next. Touch controls
  and idle jokes hidden while touring. Using the tour rules out Speed
  reader for that visit. Verified: full run 8 books in 89 s; pause holds;
  End releases the camera.
- **Smoke tests**: `npm run test:e2e` (Playwright, installed Edge, no
  browser download) — flat view, deep link + stamps + card, tour. The 3D
  runs in software on the CPU, so room tests use a small viewport, low
  tier, `test.slow()`, and the suite retries once.
- **Day / dusk / night** by the visitor's clock (`src/lib/timeOfDay.ts`):
  window, window light, sky, indoor light levels. Dusk = original scene
  exactly. Night starts with the lamp on (Reading light still needs a
  real switch-on). Preview any with `?time=day|dusk|night`.
- `npm install` reported audit warnings — not yet reviewed.

## 5. Bugs & risks — items 1–5 FIXED in Session C (kept for context)

Ordered by how much they matter. None are regressions from the work above.

1. **Per-keystroke Firestore writes** (`src/hooks/useCustomization.tsx:218` and
   `:230`). Typing in a Settings text field fires one `setDoc` **per character**.
   `setCertificateTitle` is worst: each keystroke rewrites the document
   *including the full base64 image* (~300 KB). A 60-char description ≈ 60 writes.
   Burns the 20k/day free quota and is slow. **Fix: debounce persistence
   (~500 ms) and move the write out of the `setState` updater.**

2. **Side effects inside `setState` updaters** (same two spots). React StrictMode
   double-invokes updaters in dev, so every write fires twice locally. Fixing #1
   properly resolves this.

3. **Silent save failures.** Certificate/photo writes `.catch(console.warn)` with
   no UI feedback. A certificate image over the 1 MiB cap appears to save, then
   is gone on reload — there is **no pre-upload size check** on the image path,
   unlike video and CV which both have one. **Fix: add the size guard and surface
   errors, mirroring the `ResumeRow` pattern.**

4. **`/api/search` is unauthenticated and unthrottled** (`api/_exaSearch.ts`).
   No rate limit and no query-length cap on a public endpoint wired to a 20k/month
   Exa quota. Anyone can drain it. **Fix: cap `q` length and add basic throttling.**

5. **Unvalidated result URL** — `r.link` from Exa goes straight into `href`
   (`PCSearch.tsx`). Low risk (Exa returns http(s)), but a `javascript:` URL would
   render. **Cheap fix: filter to http/https in `_exaSearch.ts`, where the URL is
   already parsed.**

6. `THREE.Clock` deprecation warning in console (from drei/fiber internals, not
   our code). Cosmetic.

## 6. Improvements worth doing (not blockers)

- `git init` — biggest single risk reduction.
- `public/cv/` and `public/videos/` are empty. CV now uploadable via UI; videos
  still need files dropped in, or links set per slot in Settings.
- `identity.github` / `identity.linkedin` are blank in `books.ts`, so no profile
  links render anywhere. The PC search suggestions reference "Ahmed Jatlaoui
  GitHub/LinkedIn" — worth filling in if the profiles exist.
- `index.html` still has `https://example.com` placeholders for canonical /
  og:url / og:image, and `public/og-image.jpg` is missing → link previews are
  broken. Needs the real domain before deploy.
- Fonts load from Google Fonts + jsDelivr at runtime — self-host if a strict CSP
  is added or offline support matters.
- ~~`imageProcessing.ts` stale "localStorage" comment~~ — fixed in Session C.

## 7. Open questions for Ahmed — do not guess

1. **Spendora team size contradicts itself.** `books.ts` says "4+ students",
   `projectVideos.ts` says "a team of four". The CV says only "Team project".
2. **Accelerant: internship or employment?** The CV lists it under *Employment*
   as Full Stack Developer (Feb–May 2026). "Internship" wording was removed from
   Prowise; if it really was an internship, the Experience book should say so.
3. **Should the CV PDF also be committed** to `public/cv/ahmed-jatlaoui.pdf` as a
   fallback? Deliberately left out — it publishes his phone number in the repo,
   and he said he'd upload via the UI.

## 8. Deployment blockers

- [ ] `index.html` placeholder URLs + missing `public/og-image.jpg`
- [x] Items 1, 3 and 4 in §5 (quota burn, silent data loss, open endpoint)
- [ ] First real CV upload confirmed working, and one debounced Settings save
- [ ] Set a monthly usage cap in the Exa dashboard
- [ ] Host must run serverless functions, or `/api/search` 404s and the in-room
      PC reports search unavailable (handled gracefully, but the feature is dead)

## 9. Working agreement

- Verify, don't assume. Trace UI → hook → API → Firestore → back. HTTP 200 is not
  proof; the dev server returns 200 + `index.html` for missing files, which is
  exactly why `useResumeAvailable` checks content-type.
- Use the browser preview to confirm user-visible changes; deep links
  (`?book=education`, `?book=projects`, …) open a panel directly without walking
  the room.
- Smallest change that fixes the root cause. Don't reformat or restructure
  working code.
- Never sign in as Ahmed or enter his credentials — hand those steps back to him.
