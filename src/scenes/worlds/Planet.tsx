"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { atmosphereFragment, atmosphereVertex, planetFragment, planetVertex } from "@/shaders/planet";
import { palette } from "@/lib/palette";

const sphere = new THREE.SphereGeometry(1, 128, 96);

/**
 * A world's planet, seen as a massive backlit horizon. `impact` (0..1,
 * from reported users) drives contour brightness and atmosphere glow;
 * `radius` is set by the parent from the same number.
 */
export default function Planet({
  radius,
  impact,
  seed,
  activityRef,
  lightDir,
}: {
  radius: number;
  impact: number;
  seed: number;
  activityRef: React.MutableRefObject<number>;
  lightDir: THREE.Vector3;
}) {
  const body = useRef<THREE.Mesh>(null);

  const [planetMat, atmoMat] = useMemo(
    () => [
      new THREE.ShaderMaterial({
        vertexShader: planetVertex,
        fragmentShader: planetFragment,
        uniforms: {
          uInk: { value: new THREE.Color(palette.signalHi) },
          uBody: { value: new THREE.Color("#23252f") },
          uLightDir: { value: lightDir },
          uImpact: { value: impact },
          uActive: { value: 0 },
          uTime: { value: 0 },
          uSeed: { value: seed },
          uDensity: { value: 9 + (seed % 3) * 3 },
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
          uLightDir: { value: lightDir },
          uIntensity: { value: 0.7 + impact * 1.1 },
        },
      }),
    ],
    [impact, seed, lightDir]
  );

  useFrame((_, dt) => {
    planetMat.uniforms.uTime.value += dt;
    planetMat.uniforms.uActive.value = activityRef.current;
    if (body.current) body.current.rotation.y += dt * 0.008;
  });

  return (
    <group>
      <mesh ref={body} geometry={sphere} material={planetMat} scale={radius} />
      <mesh geometry={sphere} material={atmoMat} scale={radius * 1.035} />
    </group>
  );
}
