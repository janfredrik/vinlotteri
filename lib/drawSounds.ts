"use client";

/**
 * The big screen's sounds, made in the browser with Web Audio: no audio files to ship or license.
 * Browsers only start audio after a click, so `unlock()` must run inside one; until then every
 * sound is a silent no-op.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = true;

/** Muted sounds are skipped entirely rather than played silently. */
export function setMuted(m: boolean) {
  muted = m;
  if (m) stopDrumroll(false);
}

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (muted || !ctx || !master || ctx.state !== "running") return null;
  return { ctx, out: master };
}

/** Call from a click. Resolves true once sound can play. */
export async function unlock(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    // A gentle limiter so the fanfare over a drumroll never clips a TV's speakers.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state !== "running") await ctx.resume().catch(() => {});
  return ctx.state === "running";
}

/** The browser lets this page play sound (after the first click). */
export function audioUnlocked(): boolean {
  return ctx?.state === "running";
}

function noiseBurst(
  a: { ctx: AudioContext; out: AudioNode },
  at: number,
  dur: number,
  gain: number,
  filter: { type: BiquadFilterType; freq: number; q?: number },
) {
  if (!noise) return;
  const src = a.ctx.createBufferSource();
  src.buffer = noise;
  const f = a.ctx.createBiquadFilter();
  f.type = filter.type;
  f.frequency.value = filter.freq;
  f.Q.value = filter.q ?? 0.8;
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(a.out);
  src.start(at, Math.random() * 1.5, dur + 0.05);
}

function tone(
  a: { ctx: AudioContext; out: AudioNode },
  type: OscillatorType,
  freq: number,
  at: number,
  dur: number,
  gain: number,
  { to, attack = 0.01, lowpass }: { to?: number; attack?: number; lowpass?: number } = {},
) {
  const o = a.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let node: AudioNode = o;
  if (lowpass) {
    const f = a.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lowpass;
    node = o.connect(f);
  }
  node.connect(g).connect(a.out);
  o.start(at);
  o.stop(at + dur + 0.05);
  return o;
}

/** A die landing: a dry wooden knock. */
export function tick() {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime;
  tone(a, "triangle", 1250, t, 0.09, 0.5, { to: 700, attack: 0.002 });
  tone(a, "sine", 420, t, 0.12, 0.35, { to: 260, attack: 0.002 });
  noiseBurst(a, t, 0.03, 0.25, { type: "bandpass", freq: 3200, q: 1.2 });
}

let rollStop: (() => void) | null = null;

/** A snare roll that builds until `stopDrumroll()`; it gives up on its own after 20 s. */
export function startDrumroll() {
  const a = audio();
  if (!a || rollStop) return;
  const bus = a.ctx.createGain();
  bus.gain.value = 1;
  bus.connect(a.out);
  const t0 = a.ctx.currentTime + 0.02;
  let next = t0;
  let hit = 0;
  const schedule = () => {
    // Schedule ahead in small slices so the roll stays tight even when the tab is busy animating.
    while (next < a.ctx.currentTime + 0.15) {
      const swell = Math.min(1, (next - t0) / 3);
      const accent = hit % 2 === 0 ? 1 : 0.72;
      noiseBurst({ ctx: a.ctx, out: bus }, next, 0.07, (0.12 + 0.3 * swell) * accent, { type: "highpass", freq: 1400 });
      tone({ ctx: a.ctx, out: bus }, "triangle", 190, next, 0.05, (0.05 + 0.08 * swell) * accent, { attack: 0.002 });
      next += 0.052 + Math.random() * 0.006;
      hit += 1;
    }
  };
  schedule();
  const timer = setInterval(schedule, 50);
  const giveUp = setTimeout(() => stopDrumroll(false), 20_000);
  rollStop = () => {
    clearInterval(timer);
    clearTimeout(giveUp);
    const now = a.ctx.currentTime;
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    setTimeout(() => bus.disconnect(), 400);
  };
}

/** End the roll; with `hit`, on a cymbal crash. */
export function stopDrumroll(hit = true) {
  const stop = rollStop;
  rollStop = null;
  stop?.();
  const a = audio();
  if (!a || !hit || !stop) return;
  const t = a.ctx.currentTime;
  noiseBurst(a, t, 1.4, 0.32, { type: "highpass", freq: 5200, q: 0.5 });
  noiseBurst(a, t, 0.35, 0.3, { type: "bandpass", freq: 2400, q: 0.6 });
  tone(a, "triangle", 110, t, 0.25, 0.4, { to: 60, attack: 0.002 });
}

/** A cork leaving the bottle, then the fizz. */
export function corkPop() {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + 0.02;
  tone(a, "sine", 520, t, 0.11, 0.8, { to: 90, attack: 0.002 });
  noiseBurst(a, t, 0.06, 0.55, { type: "lowpass", freq: 1800 });
  for (let i = 0; i < 26; i++) {
    const at = t + 0.12 + Math.random() * 1.6;
    noiseBurst(a, at, 0.025, 0.05 + Math.random() * 0.06, { type: "bandpass", freq: 5000 + Math.random() * 4000, q: 3 });
  }
  noiseBurst(a, t + 0.1, 1.8, 0.07, { type: "highpass", freq: 6500 });
}

/** First prize: a short brass fanfare. */
export function fanfare() {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + 0.03;
  // Bb major: three pick-ups, then the held chord.
  const notes: [number, number, number][] = [
    [466.16, 0, 0.16],
    [466.16, 0.17, 0.16],
    [466.16, 0.34, 0.16],
    [622.25, 0.52, 0.32],
    [587.33, 0.86, 0.14],
    [622.25, 1.02, 0.14],
    [698.46, 1.18, 1.3],
  ];
  for (const [f, at, dur] of notes) {
    for (const detune of [-4, 4]) {
      const o = tone(a, "sawtooth", f, t + at, dur, 0.13, { attack: 0.03, lowpass: 2600 });
      o.detune.value = detune;
    }
  }
  for (const f of [349.23, 466.16, 587.33]) tone(a, "sawtooth", f, t + 1.18, 1.3, 0.07, { attack: 0.05, lowpass: 1800 });
  tone(a, "sine", 116.54, t + 1.18, 1.3, 0.25, { attack: 0.05 });
}

/** An empty square: the sad trombone. */
export function womp() {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + 0.03;
  const steps: [number, number, number][] = [
    [293.66, 0, 0.3],
    [277.18, 0.32, 0.3],
    [261.63, 0.64, 0.3],
  ];
  for (const [f, at, dur] of steps) tone(a, "sawtooth", f, t + at, dur, 0.2, { attack: 0.04, lowpass: 900 });
  // The last note sags and wobbles.
  const o = tone(a, "sawtooth", 246.94, t + 0.96, 1.0, 0.22, { to: 220, attack: 0.04, lowpass: 900 });
  const lfo = a.ctx.createOscillator();
  lfo.frequency.value = 6;
  const depth = a.ctx.createGain();
  depth.gain.value = 9;
  lfo.connect(depth).connect(o.frequency);
  lfo.start(t + 1.1);
  lfo.stop(t + 2);
}

/** A prize chosen: a glass rung with a spoon. */
export function chime() {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + 0.02;
  for (const [f, g] of [
    [1567.98, 0.22],
    [2349.32, 0.08],
    [3951.07, 0.04],
  ] as const)
    tone(a, "sine", f, t, 1.8, g, { attack: 0.004 });
  tone(a, "sine", 2093, t + 0.14, 1.4, 0.12, { attack: 0.004 });
}
