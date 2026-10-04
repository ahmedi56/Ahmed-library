// No footstep audio asset exists anywhere in this project (checked public/
// and the whole src tree before adding this), and sourcing a third-party
// sound file isn't something to do without knowing its license — so this
// synthesizes a soft carpeted-floor footstep with the Web Audio API instead
// of playing a file. Swapping in a real asset later is a one-line change:
// replace playFootstep()'s body with an <audio>/AudioBufferSourceNode that
// decodes a file at a well-known path (e.g. /sfx/footstep.mp3) — the
// call site (CameraRig.tsx) doesn't need to change either way.

import { audioReady, unlockAudio } from './audio';

let noiseBuffer: AudioBuffer | null = null;

/** Built once and reused for every footstep — never allocate a new buffer per step. */
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const duration = 0.11;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / length;
    // Sharp attack, quick decay — reads as a soft "thud" rather than a hiss.
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4);
  }
  noiseBuffer = buffer;
  return buffer;
}

/**
 * Must be called from within a real user-gesture handler (click/keydown) —
 * browsers block audio until then. Safe to call repeatedly; only the first
 * call actually does anything.
 */
export function unlockFootstepAudio() {
  // The context is shared with every other sound now (lib/audio.ts).
  unlockAudio();
}

export function playFootstep(volume = 0.1) {
  const audio = audioReady();
  if (!audio) return;
  const { ctx, out } = audio;

  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer(ctx);
  source.playbackRate.value = 0.92 + Math.random() * 0.16;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 650 + Math.random() * 250;

  const gain = ctx.createGain();
  gain.gain.value = volume * (0.8 + Math.random() * 0.35);

  source.connect(filter).connect(gain).connect(out);
  source.start();
  source.stop(ctx.currentTime + 0.13);
}
