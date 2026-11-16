import { flight } from "@/store/universe";

/** Seconds the whole Big Bang takes (detonation → settled dust) */
export const BANG_SECONDS = 1.5;

/** Mark the moment of the bang (called when the intro hands off) */
export function triggerBang() {
  flight.bootAt = performance.now() / 1000;
}

let slow = 0;
/** Raw progress 0..1 through the bang (linear time) */
export function bangProgress(now = performance.now() / 1000) {
  if (flight.bootAt < 0) return 0;
  // ?slowbang plays it 8× slower (QA / debugging)
  if (!slow) slow = typeof location !== "undefined" && location.search.includes("slowbang") ? 8 : 1;
  return Math.min(1, Math.max(0, (now - flight.bootAt) / (BANG_SECONDS * slow)));
}

/**
 * Expansion scale for positions: 0 = singularity. Explodes exponentially,
 * overshoots well past 1 (the debris flies out too far), then drifts back
 * and settles at exactly 1.
 */
export function bangAmount(now = performance.now() / 1000) {
  const k = bangProgress(now);
  if (k >= 1) return flight.bootAt < 0 ? 0 : 1;
  const e = 1 - Math.pow(2, -14 * k);
  return e + 0.35 * e * Math.pow(1 - k, 2.4);
}

/** Violence of the blast right now: 1 at detonation, fading to 0 */
export function blastAmount(now = performance.now() / 1000) {
  if (flight.bootAt < 0) return 0;
  const k = bangProgress(now);
  return k >= 1 ? 0 : Math.pow(1 - k, 3);
}
