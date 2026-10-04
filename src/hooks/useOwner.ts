import { useCallback, useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, ownerUid } from '../lib/firebaseClient';

interface OwnerApi {
  /** Auth has reported in; until then, show nothing owner-related. */
  ready: boolean;
  /** Signed in AND the uid matches VITE_OWNER_UID. */
  isOwner: boolean;
  /** Signed in as somebody, owner or not. */
  signedIn: boolean;
  signIn: () => Promise<void>;
  leave: () => Promise<void>;
  error: string | null;
}

/**
 * Who is allowed to edit the room.
 *
 * The Settings panel writes certificate images, titles and the bedside
 * photo into shared Firestore documents, and it used to be reachable by
 * every visitor with no authentication anywhere in the project — so
 * anything a stranger uploaded became what the next visitor saw. This is
 * the gate. Firestore rules are what actually enforce it; this hook only
 * decides what the interface offers.
 */
export function useOwner(): OwnerApi {
  const [ready, setReady] = useState(!auth);
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setReady(true);
      // A sign-in that ultimately worked must not leave a failure message
      // on screen, whatever the popup did on its way there.
      if (user) setError(null);
    });
  }, []);

  const signIn = useCallback(async () => {
    if (!auth) return;
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? '';

      // Closing the popup, or opening a second one, is a choice rather
      // than a fault. Saying "sign-in did not complete" for it is noise.
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/user-cancelled'
      ) {
        return;
      }

      // The reported bug: signInWithPopup can reject *after* the sign-in
      // has actually succeeded. Cross-Origin-Opener-Policy commonly closes
      // the popup before the SDK can read its result back, so the promise
      // fails while the account is already authenticated. Treating that
      // rejection as failure put a red "SIGN IN DID NOT COMPLETE" banner
      // over a perfectly good session. Ask auth what really happened
      // instead of trusting the promise.
      if (auth.currentUser) return;

      // Anything left is a real failure, and the code is the useful part:
      // auth/unauthorized-domain and auth/popup-blocked are by far the
      // most common, and each needs a different fix.
      setError(code ? `Sign-in failed (${code})` : 'Sign-in did not complete');
    }
  }, []);

  const leave = useCallback(async () => {
    if (!auth) return;
    await signOut(auth);
  }, []);

  return {
    ready,
    isOwner: Boolean(ownerUid && uid && uid === ownerUid),
    signedIn: Boolean(uid),
    signIn,
    leave,
    error,
  };
}
