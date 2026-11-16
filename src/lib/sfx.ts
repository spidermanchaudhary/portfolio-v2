/**
 * Synthesised sound design — no audio files, ~0 KB of assets.
 *
 * OFF by default. Nothing (not even an AudioContext) is created until the
 * visitor turns sound on, which is always a user gesture.
 *
 *   ambient bed   three detuned voices through a lowpass; each section
 *                 retunes the chord and filter (crossfaded, never cut)
 *   flight wind   band-passed noise whose level follows scroll speed
 *   ui sounds     distinct per element type — hovering a button, leaving
 *                 the site, entering a world and typing all sound different
 *
 * To use recorded assets instead, see README → "Customizing → Audio".
 */

type SectionKey = "top" | "origin" | "toolbox" | "worlds" | "signals" | "launch";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = false;

// Ambient graph
let voices: OscillatorNode[] = [];
let bedFilter: BiquadFilterNode | null = null;
let bedGain: GainNode | null = null;
let windGain: GainNode | null = null;
let windFilter: BiquadFilterNode | null = null;
let noiseBuf: AudioBuffer | null = null;

/** Chords as semitone offsets from A1 (55Hz), plus filter cutoff */
const SECTION_TONES: Record<SectionKey, { notes: [number, number, number]; cutoff: number }> = {
  top: { notes: [0, 7, 15], cutoff: 520 }, // A  E  C — open, suspended
  origin: { notes: [-4, 3, 12], cutoff: 680 }, // F  C  F — warm
  toolbox: { notes: [2, 9, 17], cutoff: 900 }, // B  F# D — brighter
  worlds: { notes: [-5, 2, 10], cutoff: 460 }, // E  B  G — deep
  signals: { notes: [3, 10, 19], cutoff: 1100 }, // C  G  E — airy
  launch: { notes: [5, 12, 21], cutoff: 1400 }, // D  A  F# — lift
};

const hz = (semi: number) => 55 * Math.pow(2, semi / 12);

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
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
  bedFilter = c.createBiquadFilter();
  bedFilter.type = "lowpass";
  bedFilter.frequency.value = 500;
  bedFilter.Q.value = 0.7;
  bedGain = c.createGain();
  bedGain.gain.value = 0.0001;
  bedFilter.connect(bedGain).connect(master!);

  // Slow LFO breathes the filter
  const lfo = c.createOscillator();
  const lfoAmt = c.createGain();
  lfo.frequency.value = 0.07;
  lfoAmt.gain.value = 140;
  lfo.connect(lfoAmt).connect(bedFilter.frequency);
  lfo.start();

  voices = SECTION_TONES.top.notes.map((n, i) => {
    const o = c.createOscillator();
    o.type = i === 0 ? "sine" : "triangle";
    o.frequency.value = hz(n);
    o.detune.value = (i - 1) * 7;
    const g = c.createGain();
    g.gain.value = i === 0 ? 0.5 : 0.22;
    o.connect(g).connect(bedFilter!);
    o.start();
    return o;
  });
  bedGain.gain.setTargetAtTime(0.11, c.currentTime, 1.5);

  // Flight wind
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  windFilter = c.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 600;
  windFilter.Q.value = 0.9;
  windGain = c.createGain();
  windGain.gain.value = 0;
  src.connect(windFilter).connect(windGain).connect(master!);
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

  /** Crossfade the ambient bed to a section's chord */
  setSection(id: SectionKey, worldIndex = -1) {
    if (!enabled || !ctx || !bedFilter) return;
    const tone = SECTION_TONES[id];
    // Each world shifts the bed by a scale step so worlds feel distinct
    const shift = worldIndex >= 0 ? [0, 2, 3, 5, 7, 8, 10][worldIndex % 7] : 0;
    voices.forEach((o, i) => o.frequency.setTargetAtTime(hz(tone.notes[i] + shift), ctx!.currentTime, 0.9));
    bedFilter.frequency.setTargetAtTime(tone.cutoff, ctx.currentTime, 1.2);
  },

  /** Scroll speed → wind level/brightness. Call per frame-ish. */
  setVelocity(v: number) {
    if (!enabled || !ctx || !windGain || !windFilter) return;
    const s = Math.min(1, Math.abs(v) / 50);
    windGain.gain.setTargetAtTime(s * 0.09, ctx.currentTime, 0.12);
    windFilter.frequency.setTargetAtTime(400 + s * 1800, ctx.currentTime, 0.12);
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
  /** Hover: project worlds — a short scanner chirp */
  scan: () => tone(900, { dur: 0.09, gain: 0.02, slide: 1600, type: "triangle" }),
  /** Hover: inline items like skills — a muted wood tap */
  tap: () => noise({ dur: 0.03, gain: 0.03, freq: jitter(1400, 0.15), q: 6 }),
  /** Leaving the site — two notes up */
  out: () => {
    tone(660, { dur: 0.08, gain: 0.03 });
    tone(990, { dur: 0.12, gain: 0.03, delay: 0.06 });
  },
  /** Entering a world — falling whoosh + low thump */
  enter: () => {
    noise({ dur: 0.7, gain: 0.07, freq: 3000, sweepTo: 200, q: 0.8 });
    tone(110, { dur: 0.6, gain: 0.09, slide: 55, delay: 0.45, attack: 0.02 });
  },
  /** Leaving a world — rising whoosh */
  back: () => noise({ dur: 0.55, gain: 0.06, freq: 250, sweepTo: 2600, q: 0.8 }),
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
  buzz: () => tone(130, { type: "sawtooth", dur: 0.2, gain: 0.04 }),
  /** Loader exit */
  ignite: () => {
    noise({ dur: 1.4, gain: 0.05, freq: 120, sweepTo: 900, q: 0.6, type: "lowpass" });
    tone(55, { dur: 1.4, gain: 0.08, slide: 82, attack: 0.3 });
  },
  /** Contact form launch */
  launch: () => {
    noise({ dur: 2.6, gain: 0.09, freq: 90, sweepTo: 1800, q: 0.5, type: "lowpass" });
    tone(41, { dur: 2.4, gain: 0.12, slide: 98, attack: 0.15 });
  },
  /** Easter eggs */
  unlock: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, { dur: 0.25, gain: 0.04, delay: i * 0.09, type: "triangle" })),
};

export type SfxName = keyof typeof sfx;
