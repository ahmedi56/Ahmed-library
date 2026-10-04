import { useCallback, useState } from 'react';
import { LibraryScene } from './library/LibraryScene';
import { Navigation } from './ui/Navigation';
import { ProjectPreview } from './ui/ProjectPreview';
import { ProjectDetail } from './ui/ProjectDetail';
import { GuidedTour } from './ui/GuidedTour';
import { CustomizationProvider, useCustomization } from '../hooks/useCustomization';
import { PROJECT_ANCHORS, findAnchor } from '../data/projectAnchors';
import { ProjectShowcaseProvider, useProjectShowcase } from '../hooks/useProjectShowcase';
import type { useBookInteraction } from '../hooks/useBookInteraction';
import type { PerformanceProfile } from '../hooks/usePerformance';
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
  /** The guided tour is running (Home owns the switch). */
  tourActive: boolean;
  onStartTour: () => void;
  onTourEnd: () => void;
  onAsk: () => void;
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
  tourActive,
  onStartTour,
  onTourEnd,
  onAsk,
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
          onStartTour={onStartTour}
          onAsk={onAsk}
        />
        <GuidedTour active={tourActive} interaction={scene.interaction} onEnd={onTourEnd} />
      </ProjectShowcaseProvider>
    </CustomizationProvider>
  );
}

type SceneProps = Omit<
  RoomViewProps,
  'onOpenBook' | 'onSkipRoom' | 'onDiscoverAnchor' | 'useVerb' | 'touch' | 'tourActive' | 'onStartTour' | 'onTourEnd' | 'onAsk'
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
  onStartTour,
  onAsk,
}: {
  onDiscoverAnchor: (id: string) => void;
  useVerb: string;
  touch: boolean;
  scene: SceneProps;
  onOpenBook: (id: string) => void;
  onSkipRoom: () => void;
  onStartTour: () => void;
  onAsk: () => void;
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
      setOpened({ anchorId, projectId: project.id });
      // Put it on the TV too, so the object, the panel and the screen are
      // all showing the same project while the visitor reads about it.
      showProject(project.id);
    },
    [projectFor, showProject]
  );

  const openedProject = opened
    ? (projects.find((p) => p.id === opened.projectId) ?? null)
    : null;

  return (
    <>
      <LibraryScene
        {...scene}
        targetedAnchor={hovered}
        anyAnchorFound={PROJECT_ANCHORS.some((a) => scene.discovered.has(a.id))}
        onHoverAnchor={handleHover}
        onOpenAnchor={openAnchor}
      />
      <Navigation onOpenBook={onOpenBook} onSkipRoom={onSkipRoom} onStartTour={onStartTour} onAsk={onAsk} />

      {/* Hidden while the full panel is up, so the two never stack. */}
      <ProjectPreview
        anchor={opened ? null : findAnchor(hovered)}
        project={opened ? null : projectFor(hovered)}
        useVerb={useVerb}
        touch={touch}
      />
      <ProjectDetail
        anchor={findAnchor(opened?.anchorId ?? null)}
        project={openedProject}
        onClose={() => setOpened(null)}
      />
    </>
  );
}
