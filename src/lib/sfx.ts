import { audioReady } from './audio';

/**
 * The room's sound effects, synthesized rather than sampled (see audio.ts).
 *
 * Each one is short, quiet and soft-edged — this is a library. Every
 * function is a no-op when muted or before the first user gesture, so
 * call sites never need to check.
 */

let noise: AudioBuffer | null = null;

/** One second of white noise, built once and shared by every effect. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise = buf;
  return buf;
}

/** Envelope: silent → peak over `attack`, then exponential fade to `end`. */
function envelope(g: GainNode, t: number, peak: number, attack: number, end: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
}

function burst(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  dur: number,
  peak: number,
  filter: { type: BiquadFilterType; from: number; to?: number; q?: number }
) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = filter.type;
  f.Q.value = filter.q ?? 1;
  f.frequency.setValueAtTime(filter.from, t);
  if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, t + dur);
  const g = ctx.createGain();
  envelope(g, t, peak, Math.min(0.02, dur / 4), t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

function tone(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  dur: number,
  peak: number,
  freq: number,
  type: OscillatorType = 'sine',
  glideTo?: number
) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  const g = ctx.createGain();
  envelope(g, t, peak, 0.008, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
  return o;
}

/** A book coming off the shelf: two quick paper rustles. */
export function playPageFlip() {
  const a = audioReady();
  if (!a) return;
  const t = a.ctx.currentTime;
  burst(a.ctx, a.out, t, 0.18, 0.2, { type: 'bandpass', from: 1400, to: 3800, q: 0.8 });
  burst(a.ctx, a.out, t + 0.14, 0.22, 0.14, { type: 'bandpass', from: 2600, to: 1200, q: 0.8 });
}

/** A book going back: a soft, low thump. */
export function playBookClose() {
  const a = audioReady();
  if (!a) return;
  const t = a.ctx.currentTime;
  tone(a.ctx, a.out, t, 0.16, 0.22, 140, 'sine', 55);
  burst(a.ctx, a.out, t, 0.08, 0.06, { type: 'lowpass', from: 900 });
}

/** The front door: an old-hinge creak, rising when it opens. */
export function playDoorCreak(opening: boolean) {
  const a = audioReady();
  if (!a) return;
  const { ctx, out } = a;
  const t = ctx.currentTime;
  const dur = 0.85;

  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(opening ? 70 : 110, t);
  o.frequency.exponentialRampToValueAtTime(opening ? 120 : 65, t + dur);
  // The stick-slip judder that makes a hinge sound like a hinge.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 23;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 18;
  lfo.connect(lfoDepth).connect(o.frequency);

  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 900;
  f.Q.value = 6;
  const g = ctx.createGain();
  // Loud at source: the narrow band-pass keeps only a sliver of it.
  envelope(g, t, 0.3, 0.12, t + dur);

  o.connect(f).connect(g).connect(out);
  o.start(t);
  lfo.start(t);
  o.stop(t + dur + 0.05);
  lfo.stop(t + dur + 0.05);
}

/** The wall switch: click-clack, a touch brighter going on. */
export function playSwitch(on: boolean) {
  const a = audioReady();
  if (!a) return;
  const t = a.ctx.currentTime;
  burst(a.ctx, a.out, t, 0.02, 0.14, { type: 'highpass', from: on ? 3200 : 2200 });
  burst(a.ctx, a.out, t + 0.045, 0.025, 0.08, { type: 'bandpass', from: on ? 1800 : 1200, q: 3 });
}

/** A stamp earned: the rubber stamp thunk, then a small brass bell. */
export function playStamp() {
  const a = audioReady();
  if (!a) return;
  const t = a.ctx.currentTime + 0.12; // lands with the toast's press animation
  tone(a.ctx, a.out, t, 0.12, 0.2, 160, 'sine', 50);
  burst(a.ctx, a.out, t, 0.05, 0.12, { type: 'lowpass', from: 1200 });
  tone(a.ctx, a.out, t + 0.07, 0.9, 0.06, 1318.5);
  tone(a.ctx, a.out, t + 0.07, 0.6, 0.03, 1975.5);
}

/** The whole card stamped: a short rising flourish. */
export function playFanfare() {
  const a = audioReady();
  if (!a) return;
  const t = a.ctx.currentTime + 0.1;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(a.ctx, a.out, t + i * 0.11, i === 3 ? 1.1 : 0.3, 0.09, f, 'triangle');
  });
  tone(a.ctx, a.out, t + 0.33, 1.1, 0.05, 1318.5, 'triangle');
}

/** The secret stamp: a theremin ghost going "oooOOOooo". */
export function playGhost() {
  const a = audioReady();
  if (!a) return;
  const { ctx, out } = a;
  const t = ctx.currentTime + 0.1;
  const dur = 1.8;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(330, t);
  o.frequency.linearRampToValueAtTime(620, t + dur * 0.45);
  o.frequency.linearRampToValueAtTime(290, t + dur);
  const vib = ctx.createOscillator();
  vib.frequency.value = 6;
  const vibDepth = ctx.createGain();
  vibDepth.gain.value = 14;
  vib.connect(vibDepth).connect(o.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.07, t + 0.35);
  g.gain.linearRampToValueAtTime(0.05, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  vib.start(t);
  o.stop(t + dur + 0.05);
  vib.stop(t + dur + 0.05);
}

/** An idle-visitor nudge: two polite knocks on the bookcase. */
export function playKnock() {
  const a = audioReady();
  if (!a) return;
  const t = a.ctx.currentTime;
  [0, 0.16].forEach((dt) => {
    tone(a.ctx, a.out, t + dt, 0.09, 0.16, 210, 'sine', 120);
    burst(a.ctx, a.out, t + dt, 0.04, 0.08, { type: 'bandpass', from: 700, q: 2 });
  });
}

/** A returning visitor: the front-desk bell. */
export function playDeskBell() {
  const a = audioReady();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Inharmonic partials are what make a struck bell sound like metal.
  [
    [1760, 0.07, 1.6],
    [4211, 0.03, 0.8],
    [2638, 0.02, 1.1],
  ].forEach(([f, peak, dur]) => tone(a.ctx, a.out, t, dur, peak, f));
}

/** The PC: a short run of keyboard clacks. */
export function playTyping(keys = 5) {
  const a = audioReady();
  if (!a) return;
  let t = a.ctx.currentTime;
  for (let i = 0; i < keys; i++) {
    burst(a.ctx, a.out, t, 0.03, 0.12 + Math.random() * 0.06, {
      type: 'bandpass',
      from: 2500 + Math.random() * 1500,
      q: 2,
    });
    t += 0.055 + Math.random() * 0.05;
  }
}
