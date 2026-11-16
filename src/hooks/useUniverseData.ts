"use client";

import { createContext, useContext } from "react";
import type { Project, Skill } from "@/data/types";

export interface UniverseData {
  projects: Project[];
  skills: Skill[];
}

export const UniverseDataContext = createContext<UniverseData>({
  projects: [],
  skills: [],
});

/** Projects and skills, fetched once on the server and shared client-side. */
export function useUniverseData() {
  return useContext(UniverseDataContext);
}
