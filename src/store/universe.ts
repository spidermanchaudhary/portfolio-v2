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

  soundOn: boolean;
  showFps: boolean;
  /** Konami easter egg */
  blueprint: boolean;

  paletteOpen: boolean;
  terminalOpen: boolean;

  activeSection: SectionId;
  /** Index into projects of the world currently in view, -1 if none */
  activeWorld: number;
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
  soundOn: false,
  showFps: false,
  blueprint: false,
  paletteOpen: false,
  terminalOpen: false,
  activeSection: "top",
  activeWorld: -1,
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
  /** Pointer in normalized device coords (-1..1), smoothed in scenes */
  pointer: { x: 0, y: 0 },
  /** Device tilt from gyroscope (-1..1), 0 when unavailable */
  tilt: { x: 0, y: 0 },
  /** Contact form completion 0..1 — lights the gantry lamps */
  fuel: 0,
  /** performance.now()/1000 when the contact form last launched; <0 = never */
  launchAt: -1,
};
