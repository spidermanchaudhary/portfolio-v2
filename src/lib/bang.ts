import { flight } from "@/store/universe";

/** Seconds the Big Bang expansion takes */
export const BANG_SECONDS = 1.8;

/** Mark the moment of the bang (called when the intro hands off) */
export function triggerBang() {
  flight.bootAt = performance.now() / 1000;
}

/**
 * 0 = singularity (everything at one point), 1 = fully expanded.
 * Exponential-out: violent at first, gently settling.
 */
let slow = 0;
export function bangAmount(now = performance.now() / 1000) {
  if (flight.bootAt < 0) return 0;
  // ?slowbang plays it 8× slower (QA / debugging)
  if (!slow) slow = typeof location !== "undefined" && location.search.includes("slowbang") ? 8 : 1;
  const k = Math.min(1, Math.max(0, (now - flight.bootAt) / (BANG_SECONDS * slow)));
  return k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);
}
