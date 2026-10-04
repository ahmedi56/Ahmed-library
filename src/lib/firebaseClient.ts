import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

// Like Supabase's anon key, this config is meant to be public — it's what
// every Firebase web app ships in its bundle. Access is controlled by
// Firestore Security Rules on the project itself, not by keeping this
// secret, which is why it reads VITE_-prefixed vars (bundled into the
// client) unlike the search API key, a real secret that stays server-side.
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined;
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined;
const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;

export const firebaseConfigured = Boolean(apiKey && projectId && appId);

const app: FirebaseApp | null = firebaseConfigured
  ? initializeApp({ apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId })
  : null;

export const db: Firestore | null = app ? getFirestore(app) : null;
export const auth: Auth | null = app ? getAuth(app) : null;

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

/** True only for a signed-in user whose uid matches VITE_OWNER_UID. */
export function isOwnerNow(): boolean {
  return Boolean(ownerUid && auth?.currentUser && auth.currentUser.uid === ownerUid);
}
