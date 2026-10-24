/**
 * Whether this browser has been through the tutorial. Its own module, not
 * Tutorial.tsx's, because Home reads it and must not import the room chunk
 * (Tutorial pulls in bookLayout, and with it three.js).
 */
const KEY = 'library-tutorial-v1';

export function markTutorialSeen() {
  try {
    localStorage.setItem(KEY, 'done');
  } catch {
    // Private mode / blocked storage: the tutorial simply offers itself again.
  }
}

export function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === 'done';
  } catch {
    return false;
  }
}
