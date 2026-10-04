/**
 * The one AudioContext the room uses, and the master volume every sound
 * passes through — so a single mute switch silences footsteps and effects
 * alike.
 *
 * Every sound in the project is synthesized (see footsteps.ts for why: no
 * audio assets exist here, and none of unknown license get added). That
 * also keeps the whole sound kit to a few kB of code, no downloads.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

const MUTE_KEY = 'library-muted';
let muted = readMuted();
const listeners = new Set<(muted: boolean) => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function getAudio(): { ctx: AudioContext; out: AudioNode } | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  }
  return { ctx, out: master! };
}

/**
 * Browsers keep audio suspended until a user gesture. Call from inside a
 * click/keydown/touch handler; harmless to call again and again.
 */
export function unlockAudio() {
  const a = getAudio();
  if (a && a.ctx.state === 'suspended') void a.ctx.resume();
}

/** A running context to play into, or null when there is nothing to hear. */
export function audioReady(): { ctx: AudioContext; out: AudioNode } | null {
  if (muted) return null;
  const a = getAudio();
  return a && a.ctx.state === 'running' ? a : null;
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    // Remembered for this visit only.
  }
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.02);
  listeners.forEach((l) => l(next));
}

export function onMutedChange(listener: (muted: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
