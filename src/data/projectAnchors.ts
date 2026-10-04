/**
 * Objects in the room that stand for a project.
 *
 * Chosen by asking what each project actually *is*, not by scattering
 * hotspots around the furniture:
 *
 *   Wall TV      the showcase itself, so it speaks for whichever project
 *                is currently on screen rather than owning one.
 *   Cleaning set Freshly is a cleaning-services marketplace. A library
 *                contains nothing that says "cleaning", so a spray bottle
 *                and a folded cloth stand by the door, where household
 *                things live.
 *   Desk books   Prowise is a product guide and maintenance platform:
 *                video, PDF, step-by-step guides, repair info. A stack of
 *                manuals on the desk is the same object in the real world.
 *   Phone        Spendora is a finance mobile app. Nothing in the room
 *                represented a phone, and a phone on a nightstand is the
 *                most ordinary object a bedroom can contain, so this is
 *                the one prop added for this feature.
 *
 * The laptop was the other candidate for Freshly — an Express API behind
 * a Next.js web app is a laptop — but pressing E there already opens the
 * in-room PC search, and breaking a working feature to make a point is a
 * bad trade.
 *
 * Positions are world-space, derived from each object's own transform
 * chain in LibraryEnvironment.tsx (the desk and shelf groups are both
 * rotated, so these are the rotated results, not the local offsets).
 */
export interface ProjectAnchor {
  /** Interaction id, also counted by the discovery tally. */
  id: string;
  /** Project slot this object opens, or null to follow whatever the TV shows. */
  projectId: string | null;
  /** What the object is, shown above the project name. */
  objectLabel: string;
  /** Picked from a small allowed set; mapped to a Lucide icon in the UI. */
  icon: 'screen' | 'guide' | 'mobile' | 'service';
  position: [number, number, number];
  /** How near the crosshair must pass to select it. */
  radius: number;
  /** How close the player must be for it to respond at all. */
  maxDistance: number;
  /** Radius of the soft highlight drawn around the object. */
  glowRadius: number;
}

export const PROJECT_ANCHORS: ProjectAnchor[] = [
  {
    id: 'cleaningSet',
    projectId: 'project-1',
    objectLabel: 'Cleaning set',
    icon: 'service',
    // On the floor by the entrance wall, left of the doorway.
    position: [-2.3, -1.86, 4.75],
    radius: 0.22,
    maxDistance: 2.4,
    glowRadius: 0.26,
  },
  {
    id: 'tv',
    projectId: null,
    objectLabel: 'Wall TV',
    icon: 'screen',
    // Screen face of the wall-mounted TV above the mantel.
    position: [4.4, 0.88, 1.15],
    radius: 0.7,
    maxDistance: 4,
    glowRadius: 0.95,
  },
  {
    id: 'deskBooks',
    projectId: 'project-2',
    objectLabel: 'Stack of manuals',
    icon: 'guide',
    // Desk group [1.9,-1.35,1.9] rotated -0.35; stack local [0.55,0.08,-0.15].
    position: [2.468, -1.27, 1.948],
    radius: 0.2,
    maxDistance: 2.4,
    glowRadius: 0.22,
  },
  {
    id: 'phone',
    projectId: 'project-3',
    objectLabel: 'Phone',
    icon: 'mobile',
    // Resting on the nightstand [-4.15,-2.05,2.25], local [0.14,0.454,0.11].
    position: [-4.01, -1.57, 2.36],
    radius: 0.17,
    maxDistance: 2.2,
    glowRadius: 0.17,
  },
];

export function findAnchor(id: string | null): ProjectAnchor | null {
  if (!id) return null;
  return PROJECT_ANCHORS.find((a) => a.id === id) ?? null;
}
