"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Project, WorldKind } from "@/data/types";
import type { Station } from "../track";
import { activity, damp, isNear } from "../shared/activity";
import Planet from "./Planet";
import type { MiniSceneProps } from "./types";
import Moons from "./scenes/Moons";
import OcrScan from "./scenes/OcrScan";
import RankingWall from "./scenes/RankingWall";
import CipherPairs from "./scenes/CipherPairs";
import FeedbackSwarm from "./scenes/FeedbackSwarm";
import Vault from "./scenes/Vault";
import RollSearch from "./scenes/RollSearch";
import Rolodex from "./scenes/Rolodex";

/** One bespoke mini-scene per kind; `planet` is the generic fallback */
const SCENES: Record<WorldKind, React.ComponentType<MiniSceneProps>> = {
  "ocr-scan": OcrScan,
  "ranking-wall": RankingWall,
  "cipher-pairs": CipherPairs,
  "feedback-swarm": FeedbackSwarm,
  vault: Vault,
  "roll-search": RollSearch,
  rolodex: Rolodex,
  planet: Moons,
};

/** Reported users → 0..1 glow (log scale; null = 0, nothing invented) */
export function impactGlow(users: number | null) {
  if (!users) return 0;
  return THREE.MathUtils.clamp((Math.log10(users) - 2.5) / 3, 0, 1);
}

export default function Worlds({ stations, projects }: { stations: Station[]; projects: Project[] }) {
  return (
    <>
      {projects.map((project, i) => {
        const trackIndex = stations.findIndex((s) => s.kind === "world" && s.index === i);
        if (trackIndex < 0) return null;
        return <World key={project.id} project={project} station={stations[trackIndex]} trackIndex={trackIndex} />;
      })}
    </>
  );
}

function World({ project, station, trackIndex }: { project: Project; station: Station; trackIndex: number }) {
  const group = useRef<THREE.Group>(null);
  const act = useRef(0);
  const Scene = SCENES[project.world.kind] ?? Moons;
  const impact = impactGlow(project.users);
  const s = station.scale;

  // A horizon, not a globe: a huge body below and behind the scene, so only
  // its backlit limb sweeps through the frame. Radius grows with reported
  // users (flatter horizon, brighter air); unreported = base size.
  const R = 14 + (s - 1) * 11;
  const planetPos = useMemo(
    () => new THREE.Vector3(station.side * R * 0.3, -R * 1.07, -R * 0.85 - 3),
    [station.side, R]
  );
  // Sun far behind the planet → night side faces you, only the limb is lit
  const lightDir = useMemo(() => new THREE.Vector3(-station.side * 0.3, 0.35, -1).normalize(), [station.side]);

  useFrame((_, dt) => {
    const near = isNear(trackIndex, 2.6, project.slug);
    if (group.current) group.current.visible = near;
    if (!near) {
      act.current = 0;
      return;
    }
    act.current = damp(act.current, activity(trackIndex, 1, project.slug), 5, dt);
  });

  return (
    <group ref={group} position={station.anchor}>
      <group position={planetPos}>
        <Planet radius={R} impact={impact} seed={station.index + 1} activityRef={act} lightDir={lightDir} />
      </group>
      <Scene project={project} trackIndex={trackIndex} activityRef={act} side={station.side} scale={s} />
    </group>
  );
}
