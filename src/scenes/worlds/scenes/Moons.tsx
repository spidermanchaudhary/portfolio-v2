"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MiniSceneProps } from "../types";
import { palette } from "@/lib/palette";
import { useLazyTexture } from "../../shared/useLazyTexture";

/**
 * Generic world for projects that arrive from the API without a bespoke
 * scene: the real screenshot, received as a floating transmission panel.
 * (File keeps its old name so existing imports stay stable.)
 */
export default function Transmission({ project, activityRef, side }: MiniSceneProps) {
  const group = useRef<THREE.Group>(null);
  const url = project.thumbnail.includes("/image/upload/")
    ? project.thumbnail.replace("/image/upload/", "/image/upload/f_jpg,q_75,w_960/")
    : project.thumbnail;
  const map = useLazyTexture(url);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        uniforms: { uMap: { value: null }, uHas: { value: 0 }, uReveal: { value: 0 }, uTime: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `
          uniform sampler2D uMap; uniform float uHas; uniform float uReveal; uniform float uTime; varying vec2 vUv;
          void main(){
            if (1.0 - vUv.y > uReveal * 1.1) discard;
            vec3 c = uHas > 0.5 ? texture2D(uMap, vUv).rgb : vec3(0.08);
            c *= 0.9 + 0.1 * sin(vUv.y * 600.0 + uTime * 4.0);
            gl_FragColor = vec4(c * 0.85, 1.0);
          }`,
      }),
    []
  );
  const frame = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(3.24, 1.86)), []);

  useFrame((state) => {
    mat.uniforms.uMap.value = map;
    mat.uniforms.uHas.value = map ? 1 : 0;
    mat.uniforms.uReveal.value = activityRef.current;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    if (group.current) group.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.05;
  });

  return (
    <group ref={group} rotation={[0, -side * 0.25, 0]}>
      <mesh material={mat}>
        <planeGeometry args={[3.2, 1.8]} />
      </mesh>
      <lineSegments geometry={frame}>
        <lineBasicMaterial color={palette.paper} transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}
