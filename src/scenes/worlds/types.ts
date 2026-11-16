import type { Project } from "@/data/types";

/**
 * Contract for a world's mini-scene. Rendered inside a group positioned at
 * the station anchor (local origin = centre of attention). The planet sits
 * behind at roughly z = -4 * scale.
 *
 * - `activityRef.current` is 0..1 proximity, damped — wake up, animate in,
 *   and early-return from useFrame when it's ~0 to save work.
 * - `side` is +1 when the HTML panel is on the left (scene sits right).
 */
export interface MiniSceneProps {
  project: Project;
  trackIndex: number;
  activityRef: React.MutableRefObject<number>;
  side: number;
  scale: number;
}
