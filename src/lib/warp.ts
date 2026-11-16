import { flight, useUniverse } from "@/store/universe";

/**
 * Hyperspace jump used for page transitions — always moving forward:
 *
 *   CHARGE (accelerate) ─▶ HOLD at full speed until the new route mounts
 *   ─▶ RELEASE (decelerate smoothly, still travelling forward) ─▶ 0
 */
export const WARP_CHARGE = 0.5;
export const WARP_RELEASE = 1.4;
const MAX_HOLD = 3; // safety: never cruise forever if a route hangs

/** Begin a jump (link clicked). Holds at full speed until landWarp(). */
export function startWarp() {
  if (useUniverse.getState().reducedMotion) return;
  flight.warpAt = performance.now() / 1000;
  flight.warpHold = true;
  flight.warpRelease = -1;
}

/** The destination has mounted: start decelerating. For direct visits
 *  (no jump in progress) it arrives from full speed. */
export function landWarp() {
  if (useUniverse.getState().reducedMotion) return;
  const now = performance.now() / 1000;
  if (flight.warpHold) {
    flight.warpHold = false;
    flight.warpRelease = Math.max(now, flight.warpAt + WARP_CHARGE);
  } else if (flight.warpRelease < 0 || now - flight.warpRelease > WARP_RELEASE) {
    flight.warpAt = now - WARP_CHARGE;
    flight.warpRelease = now;
  }
}

/** 0..1 warp speed right now */
export function warpAmount(now = performance.now() / 1000) {
  if (flight.warpAt < 0) return 0;
  const s = now - flight.warpAt;
  if (s < 0) return 0;
  if (s < WARP_CHARGE) {
    const k = s / WARP_CHARGE;
    return k * k * (3 - 2 * k) * k; // ease in, hard push at the end
  }
  let release = flight.warpRelease;
  if (release < 0) {
    if (s < WARP_CHARGE + MAX_HOLD) return 1; // cruising
    release = flight.warpAt + WARP_CHARGE + MAX_HOLD;
  }
  const k = (now - release) / WARP_RELEASE;
  if (k <= 0) return 1;
  if (k >= 1) return 0;
  return Math.pow(1 - k, 2.2); // long, smooth deceleration
}
