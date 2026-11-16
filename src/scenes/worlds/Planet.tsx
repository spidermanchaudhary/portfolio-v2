"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { atmosphereFragment, atmosphereVertex, planetFragment, planetVertex } from "@/shaders/planet";
import { palette } from "@/lib/palette";

const sphere = new THREE.SphereGeometry(1, 96, 64);

/**
 * A world's planet. `impact` (0..1, from reported users) drives ink
 * brightness and atmosphere glow; size is set by the parent via `radius`.
 */
export default function Planet({
  radius,
  impact,
  activityRef,
  tilt = 0.4,
}: {
  radius: number;
  impact: number;
  activityRef: React.MutableRefObject<number>;
  tilt?: number;
}) {
  const body = useRef<THREE.Mesh>(null);

  const [planetMat, atmoMat] = useMemo(
    () => [
      new THREE.ShaderMaterial({
        vertexShader: planetVertex,
        fragmentShader: planetFragment,
        uniforms: {
          uInk: { value: new THREE.Color(palette.signalHi) },
          uBody: { value: new THREE.Color("#1b1c24") },
          uLightDir: { value: new THREE.Vector3(-0.6, 0.5, 0.65) },
          uImpact: { value: impact },
          uActive: { value: 0 },
          uTime: { value: 0 },
        },
      }),
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: new THREE.Color(palette.signal) },
          uIntensity: { value: 0.35 + impact * 0.85 },
        },
      }),
    ],
    [impact]
  );

  useFrame((_, dt) => {
    planetMat.uniforms.uTime.value += dt;
    planetMat.uniforms.uActive.value = activityRef.current;
    if (body.current) body.current.rotation.y += dt * 0.04;
  });

  return (
    <group rotation={[tilt * 0.3, 0, tilt]}>
      <mesh ref={body} geometry={sphere} material={planetMat} scale={radius} />
      <mesh geometry={sphere} material={atmoMat} scale={radius * 1.16} />
    </group>
  );
}
