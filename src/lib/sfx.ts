/**
 * Synthesised sound design — no audio files, ~0 KB of assets.
 *
 * OFF by default. Nothing (not even an AudioContext) is created until the
 * visitor turns sound on, which is always a user gesture.
 *
 *   ambient pad   soft sine voices in the mid/high register with slow
 *                 vibrato and a feedback-delay "room" — airy, never a
 *                 drone (no sub-bass, no saw/triangle rumble). Each
 *                 section gently retunes the chord.
 *   air           a faint high hiss that rises with scroll speed
 *   ui sounds     distinct per element type — hovering a button, leaving
 *                 the site, opening a project and typing all sound different
 *
 * To use recorded assets instead, see README → "Customizing → Audio".
 */

type SectionKey = "top" | "origin" | "toolbox" | "work" | "signals" | "launch";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;

// Ambient graph
let voices: OscillatorNode[] = [];
let padGain: GainNode | null = null;
let airGain: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

/** Chords as semitone offsets from A3 (220Hz) — open voicings, no thirds
 *  in the bass, so they float rather than hum */
const SECTION_TONES: Record<SectionKey, [number, number, number, number]> = {
  top: [0, 7, 14, 19], // A E B E — open fifths
  origin: [-4, 3, 10, 15], // F C G C
  toolbox: [2, 9, 14, 21], // B F# B F#
  work: [-2, 5, 12, 17], // G D A D
  signals: [3, 10, 17, 22], // C G D G
  launch: [5, 12, 19, 24], // D A E A
};

const hz = (semi: number) => 220 * Math.pow(2, semi / 12);

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(comp).connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function startBed() {
  const c = ctx!;
  // Gentle "room": a filtered feedback delay the pad sends into
  const tone = c.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2400;
  const delay = c.createDelay(1);
  delay.delayTime.value = 0.38;
  const feedback = c.createGain();
  feedback.gain.value = 0.42;
  const wet = c.createGain();
  wet.gain.value = 0.5;
  delay.connect(tone).connect(feedback).connect(delay);
  tone.connect(wet).connect(master!);

  padGain = c.createGain();
  padGain.gain.value = 0.0001;
  padGain.connect(master!);
  padGain.connect(delay);

  voices = SECTION_TONES.top.map((n, i) => {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = hz(n);
    // Slow, slightly different vibrato per voice → a shimmering chorus
    const vib = c.createOscillator();
    const vibAmt = c.createGain();
    vib.frequency.value = 0.11 + i * 0.07;
    vibAmt.gain.value = 3 + i;
    vib.connect(vibAmt).connect(o.detune);
    vib.start();
    // Each voice swells in and out on its own slow cycle
    const g = c.createGain();
    g.gain.value = [0.32, 0.22, 0.14, 0.08][i];
    const trem = c.createOscillator();
    const tremAmt = c.createGain();
    trem.frequency.value = 0.05 + i * 0.031;
    tremAmt.gain.value = g.gain.value * 0.6;
    trem.connect(tremAmt).connect(g.gain);
    trem.start();
    o.connect(g).connect(padGain!);
    o.start();
    return o;
  });
  padGain.gain.setTargetAtTime(0.045, c.currentTime, 2);

  // Air: high, quiet hiss — like wind at altitude, not an engine
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3200;
  airGain = c.createGain();
  airGain.gain.value = 0;
  src.connect(hp).connect(airGain).connect(master!);
  src.start();
}

export const audio = {
  isEnabled: () => enabled,

  enable() {
    const c = ensure();
    if (!c || !master) return;
    enabled = true;
    if (!voices.length) startBed();
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setTargetAtTime(0.9, c.currentTime, 0.4);
  },

  disable() {
    enabled = false;
    if (!ctx || !master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  },

  /** Glide the pad to a section's chord */
  setSection(id: SectionKey, projectIndex = -1) {
    if (!enabled || !ctx) return;
    const notes = SECTION_TONES[id];
    // Each project shifts the chord by a scale step so they feel distinct
    const shift = projectIndex >= 0 ? [0, 2, -3, 5, -1, 3, 7][projectIndex % 7] : 0;
    voices.forEach((o, i) => o.frequency.setTargetAtTime(hz(notes[i] + shift), ctx!.currentTime, 1.4));
  },

  /** Scroll speed → a faint rush of air. Call ~10×/s. */
  setVelocity(v: number) {
    if (!enabled || !ctx || !airGain) return;
    const s = Math.min(1, Math.abs(v) / 60);
    airGain.gain.setTargetAtTime(s * s * 0.018, ctx.currentTime, 0.2);
  },
};

// ───────────── one-shot UI sounds ─────────────

interface Tone {
  type?: OscillatorType;
  dur?: number;
  gain?: number;
  delay?: number;
  slide?: number;
  attack?: number;
}

function tone(freq: number, { type = "sine", dur = 0.1, gain = 0.05, delay = 0, slide, attack = 0.004 }: Tone = {}) {
  if (!enabled || !ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.05, gain = 0.04, freq = 3000, q = 1.5, delay = 0, type = "bandpass" as BiquadFilterType, sweepTo = 0 }) {
  if (!enabled || !ctx || !master || !noiseBuf) return;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t0);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0, Math.random());
  src.stop(t0 + dur + 0.05);
}

const jitter = (f: number, amt = 0.04) => f * (1 + (Math.random() * 2 - 1) * amt);

export const sfx = {
  /** Hover: primary buttons — a soft glassy tick */
  hover: () => tone(jitter(1760, 0.02), { dur: 0.05, gain: 0.018, type: "sine" }),
  /** Hover: project images — a short scanner chirp */
  scan: () => tone(900, { dur: 0.09, gain: 0.02, slide: 1600, type: "triangle" }),
  /** Hover: inline items like skills — a muted wood tap */
  tap: () => noise({ dur: 0.03, gain: 0.03, freq: jitter(1400, 0.15), q: 6 }),
  /** Leaving the site — two notes up */
  out: () => {
    tone(660, { dur: 0.08, gain: 0.03 });
    tone(990, { dur: 0.12, gain: 0.03, delay: 0.06 });
  },
  /** Opening a project — falling air + two soft notes */
  enter: () => {
    noise({ dur: 0.6, gain: 0.04, freq: 5200, sweepTo: 1400, q: 1.2 });
    tone(660, { dur: 0.5, gain: 0.025, delay: 0.32, attack: 0.03 });
    tone(990, { dur: 0.6, gain: 0.018, delay: 0.38, attack: 0.03 });
  },
  /** Leaving a project — rising air */
  back: () => noise({ dur: 0.45, gain: 0.035, freq: 1400, sweepTo: 5200, q: 1.2 }),
  toggle: () => {
    tone(1200, { dur: 0.03, gain: 0.03, type: "square" });
    tone(1600, { dur: 0.03, gain: 0.025, type: "square", delay: 0.04 });
  },
  open: () => [523, 659, 988].forEach((f, i) => tone(f, { dur: 0.35, gain: 0.025, delay: i * 0.025, type: "sine" })),
  close: () => tone(700, { dur: 0.12, gain: 0.03, slide: 380 }),
  /** Terminal keystroke — randomised so typing doesn't machine-gun */
  key: () => noise({ dur: 0.025, gain: 0.035, freq: jitter(4200, 0.25), q: 3, type: "highpass" }),
  /** Command palette selection move */
  step: () => tone(jitter(1320, 0.01), { dur: 0.03, gain: 0.015, type: "triangle" }),
  /** Form field completed */
  tick: () => tone(1046, { dur: 0.07, gain: 0.04, type: "triangle" }),
  scratch: () => noise({ dur: 0.12, gain: 0.05, freq: 2500, sweepTo: 5000, q: 2 }),
  ding: () => {
    [880, 1318, 1760].forEach((f, i) => tone(f, { dur: 1.2, gain: 0.035 / (i + 1), delay: i * 0.01 }));
  },
  buzz: () => {
    tone(330, { type: "triangle", dur: 0.12, gain: 0.03 });
    tone(311, { type: "triangle", dur: 0.16, gain: 0.025, delay: 0.1 });
  },
  /** Loader exit */
  ignite: () => [440, 660, 880, 1320].forEach((f, i) => tone(f, { dur: 1.1, gain: 0.02, delay: i * 0.07, attack: 0.04 })),
  /** Contact form launch — a rising rush of air and a bright chord */
  launch: () => {
    noise({ dur: 2.2, gain: 0.035, freq: 2000, sweepTo: 7000, q: 0.8 });
    [523, 784, 1046].forEach((f, i) => tone(f, { dur: 1.4, gain: 0.02, delay: 0.2 + i * 0.12, attack: 0.05 }));
  },
  /** Easter eggs */
  unlock: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, { dur: 0.25, gain: 0.04, delay: i * 0.09, type: "triangle" })),
};

export type SfxName = keyof typeof sfx;
