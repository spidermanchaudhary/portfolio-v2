"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { UniverseDataContext } from "@/hooks/useUniverseData";
import { useUniverse } from "@/store/universe";
import { readCapabilities } from "@/lib/capabilities";
import type { Project, Skill } from "@/data/types";
import TopBar from "./chrome/TopBar";
import Loader from "./chrome/Loader";
import FlightDriver from "./chrome/FlightDriver";
import RevealDirector from "./chrome/RevealDirector";
import AudioDirector from "./chrome/AudioDirector";
import SceneBoundary from "./SceneBoundary";

// three.js + R3F + postprocessing live in their own chunk, fetched after
// first paint — they never block the HTML, LCP or hydration.
const Universe = dynamic(() => import("@/scenes/Universe"), { ssr: false });

/**
 * Persistent client shell. Lives in the root layout so the WebGL universe,
 * HUD and overlays survive route changes — page transitions are camera
 * moves, never hard cuts.
 */
export default function Shell({
  projects,
  skills,
  children,
}: {
  projects: Project[];
  skills: Skill[];
  children: React.ReactNode;
}) {
  const [mountScene, setMountScene] = useState(false);
  const set = useUniverse((s) => s.set);

  useEffect(() => {
    const cap = readCapabilities();
    set({
      webgl: cap.webgl,
      reducedMotion: cap.reducedMotion,
      isTouch: cap.isTouch,
      quality: cap.tier,
      qualityLocked: cap.locked,
    });
    if (cap.lite) return;

    // Wait for the display font (the particle name is rasterised from it),
    // then for an idle slot, before pulling in the 3D chunk.
    let cancelled = false;
    const idle = (cb: () => void) =>
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(cb, { timeout: 600 })
        : setTimeout(cb, 120); // Safari < 18
    document.fonts.ready.then(() => idle(() => !cancelled && setMountScene(true)));
    return () => {
      cancelled = true;
    };
  }, [set]);

  return (
    <UniverseDataContext.Provider value={{ projects, skills }}>
      <div aria-hidden className="static-sky pointer-events-none fixed inset-0 -z-10" />
      {mountScene && (
        <SceneBoundary>
          <Universe />
        </SceneBoundary>
      )}
      <div aria-hidden className="grain pointer-events-none" />
      <Loader />
      <FlightDriver />
      <RevealDirector />
      <AudioDirector />
      <TopBar />
      <main id="main" className="relative z-10">
        {children}
      </main>
    </UniverseDataContext.Provider>
  );
}
