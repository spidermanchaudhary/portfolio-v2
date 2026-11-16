"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

/** Publishes a smoothed FPS + draw-call count to window for the HUD. */
export const stats = { fps: 60, calls: 0 };

export default function FpsProbe() {
  const acc = useRef({ t: 0, n: 0 });
  useFrame(({ gl }, dt) => {
    const a = acc.current;
    a.t += dt;
    a.n++;
    if (a.t >= 0.5) {
      stats.fps = Math.round(a.n / a.t);
      stats.calls = gl.info.render.calls;
      a.t = 0;
      a.n = 0;
    }
  });
  return null;
}
