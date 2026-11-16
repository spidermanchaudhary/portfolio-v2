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

  // Planet sits behind the mini-scene, pushed outward from the text panel
  const planetPos = useMemo(
    () => new THREE.Vector3(station.side * (1.5 + s * 1.0), 0.6 * s, -5.2 * s),
    [station.side, s]
  );

  useFrame((_, dt) => {
    const near = isNear(trackIndex, 3.2, project.slug);
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
        <Planet radius={1.75 * s} impact={impact} activityRef={act} tilt={station.side * 0.35} />
        <OrbitRing radius={1.75 * s * 1.6} activityRef={act} />
      </group>
      <Scene project={project} trackIndex={trackIndex} activityRef={act} side={station.side} scale={s} />
    </group>
  );
}

/** Dotted orbit ring around the planet, drawn with points */
function OrbitRing({ radius, activityRef }: { radius: number; activityRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = 180;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      p[i * 3] = Math.cos(a) * radius;
      p[i * 3 + 2] = Math.sin(a) * radius;
    }
    return new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(p, 3));
  }, [radius]);
  const mat = useMemo(
    () => new THREE.PointsMaterial({ color: "#7D92FF", size: 0.045, transparent: true, opacity: 0.5, depthWrite: false }),
    []
  );
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.05;
    mat.opacity = 0.15 + activityRef.current * 0.45;
  });
  return <points ref={ref} geometry={geo} material={mat} rotation={[0.42, 0, 0.18]} />;
}
