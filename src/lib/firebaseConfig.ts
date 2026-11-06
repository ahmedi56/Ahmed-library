/**
 * Firebase settings that don't need the Firebase SDK.
 *
 * Kept apart from firebaseClient.ts, which imports the SDK (~157 kB
 * gzipped): visitors only ever *read* the room's saved contents, and they
 * do that over Firestore's REST API (lib/firestoreRest.ts). Only the owner,
 * who signs in and writes, needs the SDK, and it is loaded for them alone
 * (lib/firebaseLazy.ts).
 *
 * Like Supabase's anon key, this config is meant to be public — it's what
 * every Firebase web app ships in its bundle. Access is controlled by
 * Firestore Security Rules on the project itself, not by keeping this
 * secret, which is why it reads VITE_-prefixed vars (bundled into the
 * client) unlike the search API key, a real secret that stays server-side.
 */
export const firebaseEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Boolean(firebaseEnv.apiKey && firebaseEnv.projectId && firebaseEnv.appId);

/**
 * The one account allowed to edit the room.
 *
 * Empty by default, and an empty value means *nobody* is the owner — a
 * missing config locks editing down rather than opening it up. Publishing
 * this uid is harmless: it identifies who may write, it doesn't
 * authenticate them. The actual enforcement lives in firestore.rules;
 * everything on this side is only there so the UI doesn't offer people
 * buttons that would fail.
 */
export const ownerUid = ((import.meta.env.VITE_OWNER_UID as string | undefined) ?? '').trim();

const ADMIN_KEY = 'library-admin';

/**
 * Whether this visit should load the SDK and check for the owner's
 * sign-in: ?admin=1 in the URL, or a browser the owner has signed in from
 * before (remembered below), so the SETTINGS button still turns up for
 * them on a plain visit. Everyone else never downloads the SDK.
 */
export function adminWanted(): boolean {
  if (typeof window === 'undefined' || !firebaseConfigured) return false;
  if (new URLSearchParams(window.location.search).has('admin')) return true;
  try {
    return localStorage.getItem(ADMIN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Remembers (or forgets, on signing out) that the owner uses this browser. */
export function rememberAdmin(on: boolean): void {
  try {
    if (on) localStorage.setItem(ADMIN_KEY, '1');
    else localStorage.removeItem(ADMIN_KEY);
  } catch {
    // Private mode or blocked storage: ?admin=1 still works.
  }
}
