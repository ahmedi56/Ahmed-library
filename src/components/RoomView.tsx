import { useCallback, useEffect, useRef, useState } from 'react';
import { projects as projectList } from '../data/projects';
import { writeProjectParam } from '../lib/deepLink';
import { LibraryScene } from './library/LibraryScene';
import { Navigation } from './ui/Navigation';
import { ProjectPreview } from './ui/ProjectPreview';
import { ProjectTheatre } from './ui/ProjectTheatre';
import { ProjectWindow } from './ui/ProjectWindow';
import { Tutorial } from './ui/Tutorial';
import { CustomizationProvider, useCustomization } from '../hooks/useCustomization';
import { PROJECT_ANCHORS, findAnchor } from '../data/projectAnchors';
import { ProjectShowcaseProvider, useProjectShowcase } from '../hooks/useProjectShowcase';
import type { useBookInteraction } from '../hooks/useBookInteraction';
import type { PerformanceProfile } from '../hooks/usePerformance';
import type { SecretPhase } from '../lib/secretRoom';
import type { EntrancePhase } from '../hooks/useEntrance';

interface RoomViewProps {
  interaction: ReturnType<typeof useBookInteraction>;
  profile: PerformanceProfile;
  reduced: boolean;
  entrancePhase: EntrancePhase;
  doorOpen: boolean;
  onOpenDoor: () => void;
  onToggleDoor: () => void;
  onHoverDoor: (hovered: boolean) => void;
  onCrossThreshold: () => void;
  onLockChange: (locked: boolean) => void;
  onHoverPC: (hovered: boolean) => void;
  onOpenPC: () => void;
  lampOn: boolean;
  onHoverLamp: (hovered: boolean) => void;
  onToggleLamp: () => void;
  discovered: ReadonlySet<string>;
  /** Reports a project object as found, for the discovery tally. */
  onDiscoverAnchor: (id: string) => void;
  /** "PRESS E" or "TAP USE", decided by the input device. */
  useVerb: string;
  touch: boolean;
  spawnInside: boolean;
  onOpenBook: (id: string) => void;
  onSkipRoom: () => void;
  /** The tutorial is running (Home owns the switch). */
  tutorialActive: boolean;
  onStartTutorial: () => void;
  onTutorialEnd: () => void;
  /** The borrower's card is open — the tutorial's last step waits on it. */
  cardOpen: boolean;
  onAsk?: () => void;
  onDownloadCv?: () => void;
  /** ?project= slug to open in the viewing mode on arrival. */
  initialProject: string | null;
  /** The secret basement (lib/secretRoom.ts): unlocked, where it's at, and its book. */
  secretUnlocked: boolean;
  secretPhase: SecretPhase;
  secretHovered: boolean;
  onHoverSecret: (hovered: boolean) => void;
  onPullSecret: () => void;
}

/**
 * Everything that only exists when the 3D room does: the scene itself, the
 * room's header, and the customization provider behind the certificate
 * frames and the bedside photo.
 *
 * Grouped here so one dynamic import covers the lot. Firebase is the
 * reason: Firestore and Auth are reached only from the scene, the Settings
 * panel and the owner check — all room-only — yet CustomizationProvider
 * sat in App and Navigation was imported statically by Home, which put
 * 157 kB gzipped of SDK in the entry bundle. A visitor who chose the flat
 * view, or whose browser has no WebGL, downloaded a database client and an
 * authentication client to read a page of text.
 */
export function RoomView({
  onOpenBook,
  onSkipRoom,
  onDiscoverAnchor,
  useVerb,
  touch,
  tutorialActive,
  onStartTutorial,
  onTutorialEnd,
  cardOpen,
  onAsk,
  onDownloadCv,
  initialProject,
  ...scene
}: RoomViewProps) {
  return (
    <CustomizationProvider>
      <ProjectShowcaseProvider>
        <ProjectObjects
          onDiscoverAnchor={onDiscoverAnchor}
          useVerb={useVerb}
          touch={touch}
          scene={scene}
          onOpenBook={onOpenBook}
          onSkipRoom={onSkipRoom}
          onStartTutorial={onStartTutorial}
          onAsk={onAsk}
          onDownloadCv={onDownloadCv}
          initialProject={initialProject}
        />
        <Tutorial
          active={tutorialActive}
          entrancePhase={scene.entrancePhase}
          interaction={scene.interaction}
          cardOpen={cardOpen}
          touch={touch}
          reduced={scene.reduced}
          onEnd={onTutorialEnd}
        />
      </ProjectShowcaseProvider>
    </CustomizationProvider>
  );
}

type SceneProps = Omit<
  RoomViewProps,
  'onOpenBook' | 'onSkipRoom' | 'onDiscoverAnchor' | 'useVerb' | 'touch' | 'tutorialActive' | 'onStartTutorial' | 'onTutorialEnd' | 'cardOpen' | 'onAsk' | 'onDownloadCv' | 'initialProject'
>;

/**
 * Holds the project-object interaction, inside the customization
 * provider so it can read the same editable project data the wall TV
 * plays. Keeping this below the provider is what lets the whole Firebase
 * client stay in the room's chunk rather than the entry bundle.
 */
function ProjectObjects({
  onDiscoverAnchor,
  useVerb,
  touch,
  scene,
  onOpenBook,
  onSkipRoom,
  onStartTutorial,
  onAsk,
  onDownloadCv,
  initialProject,
}: {
  onDiscoverAnchor: (id: string) => void;
  useVerb: string;
  touch: boolean;
  scene: SceneProps;
  onOpenBook: (id: string) => void;
  onSkipRoom: () => void;
  onStartTutorial: () => void;
  onAsk?: () => void;
  onDownloadCv?: () => void;
  initialProject: string | null;
}) {
  const { projects } = useCustomization();
  // What the TV is showing right now, so the TV anchor speaks for the
  // project actually on screen rather than a fixed one.
  const { current, showProject } = useProjectShowcase();

  const [hovered, setHovered] = useState<string | null>(null);
  // Both the object and the project it resolved to at the moment of
  // opening. The TV anchor follows whatever is on screen, and that screen
  // advances on a timer — reading it live meant aiming at one project,
  // pressing E, and being shown whichever had cycled in by then.
  const [opened, setOpened] = useState<{ anchorId: string; projectId: string } | null>(null);
  // The quick look (ProjectWindow): a project object opens this where the
  // visitor stands; the TV itself still goes straight to the viewing mode.
  const [peek, setPeek] = useState<string | null>(null);

  // ?project= link: open that project on the TV shortly after arrival, once
  // the camera has spawned (the viewing mode reads where it stands).
  const linkHandled = useRef(false);
  useEffect(() => {
    if (linkHandled.current || !initialProject) return;
    const i = projectList.findIndex((p) => p.slug === initialProject);
    if (i < 0) return;
    const t = window.setTimeout(() => {
      linkHandled.current = true;
      setOpened({ anchorId: 'tv', projectId: `project-${i + 1}` });
    }, 600);
    return () => window.clearTimeout(t);
  }, [initialProject]);

  // Keep the address bar on the project being viewed, so it can be shared.
  const everOpened = useRef(false);
  useEffect(() => {
    if (opened) everOpened.current = true;
    if (!everOpened.current) return;
    const i = opened ? Number(opened.projectId.replace('project-', '')) - 1 : -1;
    writeProjectParam(projectList[i]?.slug ?? null);
  }, [opened]);

  const handleHover = useCallback(
    (id: string | null) => {
      setHovered(id);
      if (id) onDiscoverAnchor(id);
    },
    [onDiscoverAnchor]
  );

  const projectFor = useCallback(
    (anchorId: string | null) => {
      const anchor = findAnchor(anchorId);
      if (!anchor) return null;
      if (!anchor.projectId) return current ?? projects[0] ?? null;
      return projects.find((p) => p.id === anchor.projectId) ?? null;
    },
    [projects, current]
  );

  const openAnchor = useCallback(
    (anchorId: string) => {
      const project = projectFor(anchorId);
      if (!project) return;
      if (anchorId === 'tv') setOpened({ anchorId, projectId: project.id });
      else setPeek(project.id);
      // Put it on the TV too, so the object, the panel and the screen are
      // all showing the same project while the visitor reads about it.
      showProject(project.id);
    },
    [projectFor, showProject]
  );


  return (
    <>
      <LibraryScene
        {...scene}
        targetedAnchor={hovered}
        anyAnchorFound={PROJECT_ANCHORS.some((a) => scene.discovered.has(a.id))}
        onHoverAnchor={handleHover}
        onOpenAnchor={openAnchor}
      />
      <Navigation
        onOpenBook={onOpenBook}
        onSkipRoom={onSkipRoom}
        onStartTutorial={onStartTutorial}
        canTravel={scene.entrancePhase === 'inside'}
        onAsk={onAsk}
        onDownloadCv={onDownloadCv}
      />

      {/* Hidden while either panel is up, so they never stack. */}
      <ProjectPreview
        anchor={opened || peek ? null : findAnchor(hovered)}
        project={opened || peek ? null : projectFor(hovered)}
        useVerb={useVerb}
        touch={touch}
      />
      <ProjectWindow
        slotId={peek}
        onClose={() => setPeek(null)}
        onOpenTv={(projectId) => {
          setPeek(null);
          setOpened({ anchorId: 'tv', projectId });
        }}
      />
      {/* The TV's viewing mode: the full write-up, one click from any object. */}
      <ProjectTheatre
        slotId={opened?.projectId ?? null}
        onNavigate={(projectId) => setOpened((o) => (o ? { ...o, projectId } : o))}
        onClose={() => setOpened(null)}
      />
    </>
  );
}
