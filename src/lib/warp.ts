import { flight, useUniverse } from "@/store/universe";

/**
 * Hyperspace jump used for page transitions.
 *
 *   0 ─ CHARGE ─▶ peak ─ RELEASE ─▶ 0
 *
 * The route swaps at the peak (hidden behind full streaks + zoom blur),
 * then the new page lands as the warp releases.
 */
export const WARP_CHARGE = 0.55;
export const WARP_RELEASE = 0.95;

/** Start a jump from rest (click on a link) */
export function startWarp() {
  if (useUniverse.getState().reducedMotion) return;
  flight.warpAt = performance.now() / 1000;
}

/** Arrive already at peak (direct visit / route mounted) — release only */
export function landWarp() {
  if (useUniverse.getState().reducedMotion) return;
  const now = performance.now() / 1000;
  const since = now - flight.warpAt;
  // Mid-jump already? let it continue; otherwise start at the peak
  if (!(since >= 0 && since < WARP_CHARGE + 0.2)) flight.warpAt = now - WARP_CHARGE;
}

/** 0..1 warp intensity right now */
export function warpAmount(now = performance.now() / 1000) {
  const s = now - flight.warpAt;
  if (flight.warpAt < 0 || s < 0) return 0;
  if (s < WARP_CHARGE) {
    const k = s / WARP_CHARGE;
    return k * k * k; // accelerate hard into the jump
  }
  const k = (s - WARP_CHARGE) / WARP_RELEASE;
  if (k >= 1) return 0;
  return (1 - k) * (1 - k); // decelerate out
}
