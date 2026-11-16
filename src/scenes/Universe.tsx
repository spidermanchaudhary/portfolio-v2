"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { useUniverse, type Quality } from "@/store/universe";
import { MAX_DPR } from "@/lib/capabilities";
import { warpAmount } from "@/lib/warp";
import { palette } from "@/lib/palette";
import { useUniverseData } from "@/hooks/useUniverseData";
import { buildTrack } from "./track";
import CameraRig from "./CameraRig";
import Starfield from "./Starfield";
import HeroField from "./hero/HeroField";
import Post from "./Post";
import Landmarks from "./landmarks/Landmarks";
import FpsProbe from "./FpsProbe";
import CursorLight from "./CursorLight";
import HyperTunnel from "./HyperTunnel";

const TIERS: Quality[] = ["low", "medium", "high"];

/**
 * The persistent WebGL universe. Mounted once in the layout (client-only,
 * lazy), sits behind the HTML at z-0 and never receives pointer events —
 * the DOM stays fully interactive and accessible on top.
 */
export default function Universe() {
  const quality = useUniverse((s) => s.quality);
  const set = useUniverse((s) => s.set);
  const [dpr, setDpr] = useState(() => Math.min(window.devicePixelRatio, MAX_DPR[quality]));
  const readyAt = useRef(performance.now());

  useEffect(() => {
    setDpr(Math.min(window.devicePixelRatio, MAX_DPR[quality]));
    // Low tier drops WebGL post — the CSS grain overlay takes over
    document.documentElement.classList.toggle("q-low", quality === "low");
  }, [quality]);

  const step = (dir: 1 | -1) => {
    const st = useUniverse.getState();
    if (st.qualityLocked) return;
    // Ignore dips that are expected and brief: shader warm-up right after
    // load, and page-transition jumps
    if (dir < 0 && (performance.now() - readyAt.current < 6000 || warpAmount() > 0)) return;
    const i = TIERS.indexOf(useUniverse.getState().quality);
    const next = TIERS[THREE.MathUtils.clamp(i + dir, 0, TIERS.length - 1)];
    if (next !== TIERS[i]) set({ quality: next });
  };

  return (
    <Canvas
      aria-hidden
      tabIndex={-1}
      className="!fixed inset-0 !h-[100lvh] !w-screen"
      style={{ pointerEvents: "none" }}
      dpr={dpr}
      gl={{ antialias: false, alpha: false, stencil: false, depth: true, powerPreference: "high-performance" }}
      camera={{ fov: 42, near: 0.1, far: 500, position: [0, 0, 10] }}
      onCreated={({ gl }) => {
        gl.setClearColor(palette.void);
        gl.toneMapping = THREE.NoToneMapping;
      }}
    >
      <PerformanceMonitor
        // Sample ~2s windows; three flips and it settles for good
        flipflops={8}
        bounds={(refresh) => (refresh > 90 ? [48, 80] : [38, 55])}
        onDecline={() => step(-1)}
        onIncline={() => step(1)}
        onFallback={() => !useUniverse.getState().qualityLocked && set({ quality: "low" })}
      >
        <Scene />
      </PerformanceMonitor>
    </Canvas>
  );
}

function Scene() {
  const { projects } = useUniverseData();
  const size = useThree((s) => s.size);
  const aspect = size.width / size.height;
  const wide = aspect >= 1.1;
  // Rebuild the track only when crossing the layout breakpoint
  const stations = useMemo(() => buildTrack(projects, aspect), [projects, wide]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <fog attach="fog" args={[palette.void, 26, 95]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[-6, 8, 6]} intensity={1.4} color={palette.paper} />
      <CursorLight />
      <CameraRig stations={stations} />
      <Starfield />
      <HyperTunnel />
      <HeroField />
      <Suspense fallback={null}>
        <Landmarks stations={stations} />
      </Suspense>
      <Post />
      <FirstFrame />
      <FpsProbe />
    </>
  );
}

/** Flags the scene as ready after two rendered frames (shaders compiled). */
function FirstFrame() {
  const frames = useRef(0);
  const set = useUniverse((s) => s.set);
  useFrame(() => {
    if (frames.current < 3 && ++frames.current === 2) set({ sceneReady: true });
  });
  return null;
}
