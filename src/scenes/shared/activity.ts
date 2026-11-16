import { flight, useUniverse } from "@/store/universe";

/**
 * How "present" a station is: 1 when the camera is parked there, falling
 * to 0 at `range` stations away. A focused world (/work/[slug]) is always 1.
 * Scenes use this to wake up, animate in, and skip work when far away.
 */
export function activity(trackIndex: number, range = 1, slug?: string) {
  if (slug && useUniverse.getState().focusSlug === slug) return 1;
  if (useUniverse.getState().focusSlug) return 0;
  return Math.max(0, 1 - Math.abs(flight.t - trackIndex) / range);
}

/** True when a station is close enough to be worth rendering at all */
export function isNear(trackIndex: number, range = 3.2, slug?: string) {
  const focus = useUniverse.getState().focusSlug;
  if (focus) return focus === slug;
  return Math.abs(flight.t - trackIndex) < range;
}

export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));
