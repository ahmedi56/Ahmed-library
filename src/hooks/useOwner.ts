import { useCallback, useEffect, useState } from 'react';
import { adminWanted, ownerUid, rememberAdmin } from '../lib/firebaseConfig';
import { loadFirebase } from '../lib/firebaseLazy';

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
  // Only the owner's visits load the Firebase SDK (see adminWanted); for
  // everyone else this is settled at once: nobody signed in.
  const [admin] = useState(adminWanted);
  const [ready, setReady] = useState(!admin);
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    loadFirebase()
      .then((firebase) => {
        if (cancelled) return;
        unsubscribe = firebase.watchAuth((user) => {
          setUid(user?.uid ?? null);
          setReady(true);
          // A sign-in that ultimately worked must not leave a failure message
          // on screen, whatever the popup did on its way there.
          if (user) setError(null);
          // So this browser keeps getting the SETTINGS button without
          // ?admin=1 next time.
          if (user && ownerUid && user.uid === ownerUid) rememberAdmin(true);
        });
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [admin]);

  const signIn = useCallback(async () => {
    const firebase = await loadFirebase();
    setError(null);
    try {
      await firebase.signInWithGoogle();
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
      if (firebase.currentUser()) return;

      // Anything left is a real failure, and the code is the useful part:
      // auth/unauthorized-domain and auth/popup-blocked are by far the
      // most common, and each needs a different fix.
      setError(code ? `Sign-in failed (${code})` : 'Sign-in did not complete');
    }
  }, []);

  const leave = useCallback(async () => {
    rememberAdmin(false);
    const firebase = await loadFirebase();
    await firebase.signOutUser();
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
