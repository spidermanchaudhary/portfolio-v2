"use client";

import { UniverseDataContext } from "@/hooks/useUniverseData";
import type { Project, Skill } from "@/data/types";
import TopBar from "./chrome/TopBar";

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
  return (
    <UniverseDataContext.Provider value={{ projects, skills }}>
      <div aria-hidden className="static-sky pointer-events-none fixed inset-0 -z-10" />
      <TopBar />
      <main id="main" className="relative z-10">
        {children}
      </main>
    </UniverseDataContext.Provider>
  );
}
