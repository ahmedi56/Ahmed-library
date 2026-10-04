import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Vignette, BrightnessContrast, ToneMapping } from '@react-three/postprocessing';
import { Bookshelf } from './Bookshelf';
import { LibraryEnvironment } from './LibraryEnvironment';
import { LibraryLighting } from './LibraryLighting';
import { CameraRig } from './CameraRig';
import { CrosshairInteraction } from './CrosshairInteraction';
import { DustParticles } from './DustParticles';
import { BookPages } from './BookPages';
import { Entrance } from './Entrance';
import { Hotspots } from './Hotspots';
import { ProjectAnchors } from './ProjectAnchors';
import { SceneAtmosphere } from './SceneAtmosphere';
import { useBooks } from '../../hooks/useBooks';
import type { useBookInteraction } from '../../hooks/useBookInteraction';
import type { PerformanceProfile } from '../../hooks/usePerformance';
import type { EntrancePhase } from '../../hooks/useEntrance';
import { useAtmosphereMix } from '../../hooks/useAtmosphereMix';

interface LibrarySceneProps {
  interaction: ReturnType<typeof useBookInteraction>;
  profile: PerformanceProfile;
  reduced: boolean;
  entrancePhase: EntrancePhase;
  doorOpen: boolean;
  onOpenDoor: () => void;
  onToggleDoor: () => void;
  onHoverDoor: (hovered: boolean) => void;
  onCrossThreshold: () => void;
  onLockChange?: (locked: boolean) => void;
  onHoverPC: (hovered: boolean) => void;
  onOpenPC: () => void;
  lampOn: boolean;
  onHoverLamp: (hovered: boolean) => void;
  onToggleLamp: () => void;
  /** Interactables already found, for the discovery markers. */
  discovered: ReadonlySet<string>;
  /** Project object under the crosshair, for its highlight. */
  targetedAnchor: string | null;
  /** Any project object found yet? Retires the one teaching hint. */
  anyAnchorFound: boolean;
  onHoverAnchor: (id: string | null) => void;
  onOpenAnchor: (id: string) => void;
  /** Start inside the room rather than on the porch (?book= deep links). */
  spawnInside: boolean;
}

export function LibraryScene({
  interaction,
  profile,
  reduced,
  entrancePhase,
  doorOpen,
  onOpenDoor,
  onToggleDoor,
  onHoverDoor,
  onCrossThreshold,
  onLockChange,
  onHoverPC,
  onOpenPC,
  lampOn,
  onHoverLamp,
  onToggleLamp,
  discovered,
  targetedAnchor,
  anyAnchorFound,
  onHoverAnchor,
  onOpenAnchor,
  spawnInside,
}: LibrarySceneProps) {
  const { stateFor, hover, select, selectedId, phase } = interaction;
  const { books } = useBooks();
  const selectedBook = books.find((b) => b.id === selectedId) ?? null;
  const mix = useAtmosphereMix(entrancePhase, reduced);
  // CameraRig owns the click/E "interact" input; CrosshairInteraction owns
  // knowing what's currently being looked at. This ref is how the former
  // triggers the latter without threading interaction state through props
  // on every frame.
  const interactRef = useRef<(() => void) | null>(null);

  return (
    <Canvas
      // Was shadows="soft" (PCFSoftShadowMap). three.js r185 deprecated that
      // map type and silently falls back to PCFShadowMap — so it changed
      // nothing about the picture and only logged
      // "THREE.WebGLShadowMap: PCFSoftShadowMap has been deprecated" on
      // every shadow recompile, filling the console. Asking for the map
      // type it was already getting is the honest way to say the same thing.
      shadows={profile.shadows}
      dpr={profile.dpr}
      camera={{ fov: 72, near: 0.05, far: 40 }}
      // This used to pass logarithmicDepthBuffer: true, on the reasoning
      // that near=0.05/far=40 was too wide a range for a standard depth
      // buffer to separate near-coincident surfaces. Run the numbers and
      // that doesn't hold: at a 24-bit depth buffer, the resolvable depth
      // step at 3 m from this camera is d²(far-near)/(far·near·2²⁴) ≈
      // 1e-5 units — about a hundredth of a millimetre at this scene's
      // 1 unit = 1 m scale, roughly a thousand times finer than the 0.03
      // gaps it was supposed to protect. The z-fighting it was reached for
      // had a different cause (the window glass sitting exactly on the
      // back wall's plane) and was fixed by recessing that glass into a
      // real reveal. Meanwhile the flag makes every fragment write
      // gl_FragDepth, which disables the early-depth rejection the GPU
      // would otherwise do for free across the whole scene.
      gl={{
        antialias: profile.tier !== 'low',
        powerPreference: 'high-performance',
      }}
    >
      <color attach="background" args={['#22303f']} />
      <fog attach="fog" args={['#22303f', 4.5, 11]} />

      <Suspense fallback={null}>
        <LibraryLighting shadows={profile.shadows} quality={profile.tier} mix={mix} />
        <LibraryEnvironment quality={profile.tier} lampOn={lampOn} />
        <Entrance phase={entrancePhase} open={doorOpen} reduced={reduced} quality={profile.tier} />
        <Bookshelf stateFor={stateFor} reduced={reduced} quality={profile.tier} />
        <BookPages
          book={selectedBook}
          phase={phase === 'opening' || phase === 'opened' || phase === 'closing' ? phase : null}
          reduced={reduced}
          quality={profile.tier}
        />
        <DustParticles count={profile.particles} />
        <Hotspots discovered={discovered} active={entrancePhase === 'inside'} />
        <ProjectAnchors
          targeted={targetedAnchor}
          discovered={discovered}
          anyFound={anyAnchorFound}
          active={entrancePhase === 'inside'}
        />
      </Suspense>

      <SceneAtmosphere mix={mix} />
      <CameraRig
        entrancePhase={entrancePhase}
        doorOpen={doorOpen}
        reduced={reduced}
        onCrossThreshold={onCrossThreshold}
        interactRef={interactRef}
        onLockChange={onLockChange}
        spawnInside={spawnInside}
      />
      <CrosshairInteraction
        entrancePhase={entrancePhase}
        onHoverBook={hover}
        onSelectBook={select}
        onOpenDoor={onOpenDoor}
        onToggleDoor={onToggleDoor}
        onHoverDoor={onHoverDoor}
        onHoverPC={onHoverPC}
        onOpenPC={onOpenPC}
        onHoverLamp={onHoverLamp}
        onToggleLamp={onToggleLamp}
        onHoverAnchor={onHoverAnchor}
        onOpenAnchor={onOpenAnchor}
        interactRef={interactRef}
      />

      {profile.postProcessing && (
        <EffectComposer multisampling={0}>
          <ToneMapping />
          <BrightnessContrast brightness={0.01} contrast={0.06} />
          <Vignette eskil={false} offset={0.18} darkness={0.55} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
