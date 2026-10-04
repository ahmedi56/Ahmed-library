# Claude Prompt — Add Entrance Scene + Quality Pass

> Copy everything below into Claude (Claude Code or another Claude editor) to
> implement the "enter through the door to discover the library" scene and to
> raise the overall visual quality of the 3D library.

---

## Context

This is a React 19 + TypeScript + Vite app. The 3D scene is built with
React Three Fiber + drei + three, camera moves via GSAP, the HTML UI layer is
Tailwind v4, icons via lucide-react. Read these files first:

- `src/pages/Home.tsx` — wires everything together
- `src/components/library/LibraryScene.tsx` — the Canvas + scene graph
- `src/components/library/LibraryEnvironment.tsx` — arch frame, window, desk, walls, floor
- `src/components/library/LibraryLighting.tsx` — lights
- `src/components/library/CameraRig.tsx` — idle camera at `BASE_POSITION (0, 0.15, 4.4)`, parallax + GSAP focus tween
- `src/components/library/Bookshelf.tsx` + `Book.tsx` — 8 data-driven books
- `src/hooks/useBookInteraction.ts` — state machine: idle → hovered → opening → opened
- `src/hooks/usePerformance.ts` — `profile: { tier, dpr, shadows, particles }`
- `src/hooks/useReducedMotion.ts` — `reduced: boolean`
- `src/components/ui/LibraryIntro.tsx` — current "Welcome to my library" overlay
- `src/components/ui/LoadingScreen.tsx` — fake progress loader

## The bug / missing experience

Today the camera **spawns already inside** the room at `CameraRig.tsx:11`
(`BASE_POSITION (0, 0.15, 4.4)`), facing the shelf. There is no sense of
"entering" the library: no door, no threshold, no exterior. The user wants:
**you start outside, approach a door, it opens, you step through into the
library, and then discover the books.**

## Task 1 — Add the entrance scene

Design and implement a door-entrance opening, in the existing **Warm Minimal**
style (brass + walnut arch, warm interior light vs cool blue-hour exterior):

1. **Exterior state (first beat).** Camera starts OUTSIDE the door, slightly
   lower and further back (e.g. `(0, ~0.9, 6.5)`), facing an arched wooden
   doorway at the front wall (z ≈ 3.2). The exterior should read as blue-hour
   dusk: darker cool ambient, no warm key light yet, maybe a soft exterior
   light + subtle fog. A brass door handle and a small warm glow bleeding from
   under the door sell the invitation.

2. **Open the door.** On first pointer click (or keyboard, and an on-screen
   hint), the door swings open toward the camera (GSAP tween, e.g. ~1.2s,
   `power3.inOut`) with a soft creak-adjacent feel — animate the door mesh
   rotation on its hinge, brass handle stays attached. Respect
   `useReducedMotion`: skip the swing, just fade.

3. **Step through.** As/when the door opens, GSAP pushes the camera forward
   through the doorway (ease into a position just past the threshold, near the
   current `BASE_POSITION`), while the interior warm lights fade up and the
   exterior cool light fades out — the "light change" is the emotional beat.
   Dust particles and fog should read believably during the pass-through.

4. **Settle + reveal.** End at the existing `BASE_POSITION` looking at the
   shelf, then hand control back to the existing parallax + book hover/click
   interaction unchanged. The `LibraryIntro` overlay text should appear only
   after settling inside.

5. **State management.** Add a clean phase (e.g. a `useEntrance` hook or an
   `entrance: 'outside' | 'opening' | 'walking' | 'inside'` phase). Keep
   `useBookInteraction` intact — books must be non-interactive (or blocked)
   until `entrance === 'inside'`. Wire it through `Home.tsx` → `LibraryScene`
   → `CameraRig` + a new `Door`/`Entrance` component. Do not break the
   WebGL fallback or perf tiers.

6. **Perf / accessibility.** On `low` tier: exterior can be simpler (flat
   gradient backdrop instead of extra geometry). `prefers-reduced-motion`:
   door opens instantly, camera snaps (no tween). Keyboard: Enter/Space also
   opens the door.

## Task 2 — Raise visual quality (it currently looks flat/gamey)

Improve these without changing the architecture or breaking perf tiers:

- **Materials & realism.** Give the walnut shelf, desk, floor and arch proper
  PBR feel: roughness/metalness tuned, subtle procedural wood grain or a
  lightweight texture (prefer generated canvas/three textures over downloads),
  contact/soft shadow improvement (PCFSoft, tighter shadow camera, higher map
  size on high tier). Brass trim should actually read metallic.
- **Lighting.** Warm interior key + cool window fill already exist — add
  subtle **color grading / postprocessing** (drei `EffectComposer` with
  `Vignette`, `ToneMapping`/`ColorGrading` at tasteful levels) only on
  high/medium tiers. Add a soft window **light shaft / volume feel**
  (transparent gradient plane or additive sprite) and gentle bounce from the
  lamp onto the desk.
- **Composition.** Pull the bookshelf off-center slightly if needed; make sure
  the arch frames the shelf like a picture. Add a second book stack / plant /
  stool prop that reads as "lived-in", matching existing prop style.
- **Book spines.** Spine text currently uses the default troika font and can
  look blurry — either drop in a properly licensed serif webfont (e.g.
  Fraunces) for spine text or improve troika rendering settings (quality,
  spacing, antialiasing) and lettering alignment so titles look crisp.
- **Environment.** Replace the flat wall color with a very subtle warm
  gradient; add faint baseboard/trim line for grounding; make the rug read as
  woven (fringe or pattern via texture).
- **Polish details.** Better dust particle size/flicker, camera parallax
  damping slightly smoothed, correct fog so the far wall doesn't look washed
  out. Ensure `#efe6d3` background + fog match the new grading.

## Constraints

- TypeScript strict; no new runtime deps unless truly necessary (prefer
  drei/three built-ins). If you add a dep, justify it.
- Keep the `useBookInteraction` API unchanged (or extend backward-compatibly).
- All visuals must respect `usePerformance` tier + `useReducedMotion`.
- Run `npm run build` (tsc -b && vite build) and `npm run lint` (oxlint) at the
  end; fix any errors. Verify in dev with `npm run dev`.
- Style: no code comments unless needed for clarity; match existing code style.