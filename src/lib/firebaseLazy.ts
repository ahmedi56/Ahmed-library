/**
 * Loads the Firebase SDK (lib/firebaseClient.ts) on demand, once.
 *
 * `loadedFirebase()` answers synchronously whether it has arrived: the
 * room's save calls run from event handlers and only ever matter for the
 * signed-in owner, whose visit loaded the SDK at the start (useOwner).
 */
type FirebaseClient = typeof import('./firebaseClient');

let client: FirebaseClient | null = null;
let request: Promise<FirebaseClient> | null = null;

export function loadFirebase(): Promise<FirebaseClient> {
  request ??= import('./firebaseClient').then((m) => (client = m));
  return request;
}

export function loadedFirebase(): FirebaseClient | null {
  return client;
}
