import { initializeApp } from 'firebase/app';
import { deleteDoc, doc, getFirestore, setDoc } from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { firebaseConfigured, firebaseEnv, ownerUid } from './firebaseConfig';

/**
 * The Firebase SDK: the owner's sign-in and the room's writes.
 *
 * Never import this statically. It is loaded on demand through
 * lib/firebaseLazy.ts, only for the owner (see adminWanted), so the
 * ~157 kB SDK stays out of every visitor's download. Visitors read the
 * room's saved contents over REST instead (lib/firestoreRest.ts).
 */
const app = firebaseConfigured ? initializeApp(firebaseEnv) : null;
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;

/** True only for a signed-in user whose uid matches VITE_OWNER_UID. */
export function isOwnerNow(): boolean {
  return Boolean(ownerUid && auth?.currentUser && auth.currentUser.uid === ownerUid);
}

/** Calls back with the signed-in user (or null) now and on every change. */
export function watchAuth(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export function currentUser(): User | null {
  return auth?.currentUser ?? null;
}

export async function signInWithGoogle(): Promise<void> {
  if (!auth) return;
  await signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

/** Replaces the document at `collection/id`. Owner only (firestore.rules). */
export async function writeDocument(collection: string, id: string, data: Record<string, unknown>): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  await setDoc(doc(db, collection, id), data);
}

export async function removeDocument(collection: string, id: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  await deleteDoc(doc(db, collection, id));
}
