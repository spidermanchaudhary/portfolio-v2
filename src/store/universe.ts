"use client";

import { create } from "zustand";
import type { SectionId } from "@/data/types";

export type Quality = "high" | "medium" | "low";
export type CursorMode = "default" | "button" | "scan" | "drag" | "text" | "hidden";

/**
 * Reactive UI state (things React should re-render on).
 * Per-frame values (scroll position, velocity, pointer) live in `flight`
 * below and are mutated directly — never through React.
 */
interface UniverseState {
  /** Boot loader finished */
  booted: boolean;
  /** WebGL canvas has rendered its first frame */
  sceneReady: boolean;
  /** WebGL available and not disabled */
  webgl: boolean;
  reducedMotion: boolean;
  isTouch: boolean;
  quality: Quality;
  /** Quality pinned via ?q= — adaptive monitor is ignored */
  qualityLocked: boolean;

  showFps: boolean;
  /** Konami easter egg */
  blueprint: boolean;

  paletteOpen: boolean;
  terminalOpen: boolean;

  activeSection: SectionId;
  /** Index of the project chapter currently in view, -1 if none */
  activeProject: number;
  /** Project slug the camera is flying into / parked at (/work/[slug]) */
  focusSlug: string | null;

  cursor: { mode: CursorMode; label: string | null };

  set: (partial: Partial<Omit<UniverseState, "set">>) => void;
}

export const useUniverse = create<UniverseState>((set) => ({
  booted: false,
  sceneReady: false,
  webgl: true,
  reducedMotion: false,
  isTouch: false,
  quality: "high",
  qualityLocked: false,
  showFps: false,
  blueprint: false,
  paletteOpen: false,
  terminalOpen: false,
  activeSection: "top",
  activeProject: -1,
  focusSlug: null,
  cursor: { mode: "default", label: null },
  set: (partial) => set(partial),
}));

/**
 * Mutable per-frame flight data, written by the scroll driver and pointer
 * listeners, read inside useFrame. Plain object = zero React overhead.
 */
export const flight = {
  /** Continuous track position: station index + fraction */
  t: 0,
  /** Smoothed scroll velocity in px/frame (signed) */
  velocity: 0,
  /** Overall page progress 0..1 */
  progress: 0,
  /** 0..1 progress from the last station's centre to the bottom of the page */
  tail: 0,
  /** Camera speed along the track, world units/sec (signed, + = forward) */
  speed: 0,
  /** Smoothed camera velocity vector, world units/sec */
  vel: { x: 0, y: 0, z: 0 },
  /** Pointer in normalized device coords (-1..1). Starts off-screen so the
   *  hero name isn't carved open before the visitor moves the mouse. */
  pointer: { x: 0, y: -3 },
  /** Device tilt from gyroscope (-1..1), 0 when unavailable */
  tilt: { x: 0, y: 0 },
  /** Contact form completion 0..1 — lights the gantry lamps */
  fuel: 0,
  /** performance.now()/1000 when the contact form last launched; <0 = never */
  launchAt: -1,
  /** Launch sequence progress 0..1 (scroll-scrubbed or submit-triggered) */
  launchP: 0,
  /** Rocket altitude above the pad, world units — the camera follows it */
  rocketAlt: 0,
};
