import { firebaseEnv } from './firebaseConfig';

/**
 * The secret basement: a hidden ninth book on the shelf, unlocked by
 * finding everything in the room. Pulling it swings the bookcase open on
 * its hinge and takes the visitor down to a small room with a painted
 * portrait of Ahmed and a message for the few who get that far.
 *
 * This file holds what both sides need — the 3D scene (BasementScene)
 * and the page (Home, BasementPanel) — and must not import three, so Home
 * can use it. The secret book's own placement is in lib/bookLayout.ts.
 */

export type SecretPhase = 'closed' | 'opening' | 'inside' | 'leaving';

// The basement is built at floor level, 40 m behind the back wall, so the
// walk camera's fixed eye height works there unchanged. Nothing in the
// room can see it: the back wall is opaque and the fog swallows it long
// before. The "downstairs" is told by the fade and the footsteps.
export const BASEMENT_Z = -40;
export const BASEMENT_HALF = 3;
/** Where the visitor stands, and what they face: the portrait. */
export const BASEMENT_STAND: [number, number] = [0, BASEMENT_Z + 2.1];
export const PORTRAIT_POSITION: [number, number, number] = [0, -0.35, BASEMENT_Z - BASEMENT_HALF + 0.06];
export const BASEMENT_LOOK: [number, number, number] = [0, -0.45, PORTRAIT_POSITION[2]];

/** Back in the library: in front of the shelf, as after "Go to › Bookshelf". */
export const SHELF_STAND: [number, number] = [0, -1.0];
export const SHELF_LOOK: [number, number, number] = [0, -0.75, -2.72];

export const SECRET_MESSAGE =
  "Only a few people ever make it down here, so thank you for looking around. If you found my work interesting, don't leave without saying hi — I'm looking for my next opportunity. You found my secret; now you know where to find me.";

// --- Visitor counter ------------------------------------------------------
//
// How many people have found the basement, kept in Firestore at
// stats/secret and changed over REST (no SDK). firestore.rules lets anyone
// add exactly one to it and nothing else. Each browser counts once.

const FOUND_KEY = 'library-secret-found';

function docName(): string | null {
  const { projectId } = firebaseEnv;
  return projectId ? `projects/${projectId}/databases/(default)/documents/stats/secret` : null;
}

async function readCount(): Promise<number | null> {
  const name = docName();
  const { apiKey } = firebaseEnv;
  if (!name || !apiKey) return null;
  const res = await fetch(`https://firestore.googleapis.com/v1/${name}?key=${apiKey}`);
  if (!res.ok) return null;
  const body = (await res.json()) as { fields?: { count?: { integerValue?: string } } };
  const n = Number(body.fields?.count?.integerValue);
  return Number.isFinite(n) ? n : null;
}

async function increment(): Promise<number | null> {
  const name = docName();
  const { projectId, apiKey } = firebaseEnv;
  if (!name || !apiKey) return null;
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writes: [{ transform: { document: name, fieldTransforms: [{ fieldPath: 'count', increment: { integerValue: '1' } }] } }],
      }),
    }
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { writeResults?: { transformResults?: { integerValue?: string }[] }[] };
  const n = Number(body.writeResults?.[0]?.transformResults?.[0]?.integerValue);
  return Number.isFinite(n) ? n : null;
}

/**
 * Counts this visitor (once per browser) and returns how many have found
 * the basement, or null when the counter can't be reached — the panel
 * then simply leaves the line out.
 */
export async function countSecretVisit(): Promise<{ count: number; first: boolean } | null> {
  try {
    let already = false;
    try {
      already = localStorage.getItem(FOUND_KEY) === '1';
    } catch {
      // Storage blocked: count them; worst case a repeat visit counts twice.
    }
    if (!already) {
      const n = await increment();
      if (n !== null) {
        try {
          localStorage.setItem(FOUND_KEY, '1');
        } catch {
          // As above.
        }
        return { count: n, first: true };
      }
    }
    const n = await readCount();
    return n === null ? null : { count: n, first: false };
  } catch {
    return null;
  }
}
