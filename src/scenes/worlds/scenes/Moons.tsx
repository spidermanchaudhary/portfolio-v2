"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MiniSceneProps } from "../types";
import { palette } from "@/lib/palette";

/**
 * Generic fallback for projects that arrive from the API without a bespoke
 * world: three small moons on inclined orbits around a beacon.
 */
export default function Moons({ activityRef, scale }: MiniSceneProps) {
  const group = useRef<THREE.Group>(null);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(0.22, 2), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: palette.paper, roughness: 0.6, metalness: 0.1, emissive: palette.signal, emissiveIntensity: 0.2 }),
    []
  );
  useFrame((state) => {
    const a = activityRef.current;
    if (!group.current || a < 0.01) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((m, i) => {
      const r = (1.1 + i * 0.55) * scale;
      const sp = 0.5 - i * 0.12;
      m.position.set(Math.cos(t * sp + i * 2) * r, Math.sin(t * sp * 0.7 + i) * 0.4, Math.sin(t * sp + i * 2) * r);
      m.scale.setScalar(a);
    });
  });
  return (
    <group ref={group}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={geo} material={mat} />
      ))}
    </group>
  );
}
