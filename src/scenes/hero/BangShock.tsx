"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { bangProgress } from "@/lib/bang";
import { palette } from "@/lib/palette";

const vertex = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const fragment = /* glsl */ `
uniform vec3 uColor;
uniform float uFade;
varying vec3 vN;
varying vec3 vV;
void main() {
  // Bright at the bubble's edge, nearly clear in the middle
  float rim = pow(1.0 - abs(dot(normalize(vN), vV)), 2.5);
  float a = (rim * 0.9 + 0.06) * uFade;
  gl_FragColor = vec4(uColor * a, a);
}`;

/**
 * The Big Bang shockwave: two blast bubbles (a fast white one and a slower
 * blue one) racing out from the singularity and fading as they go.
 */
export default function BangShock() {
  const fast = useRef<THREE.Mesh>(null);
  const slowShell = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 64, 48), []);
  const mats = useMemo(
    () =>
      [palette.paper, palette.signal].map(
        (c) =>
          new THREE.ShaderMaterial({
            vertexShader: vertex,
            fragmentShader: fragment,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            uniforms: { uColor: { value: new THREE.Color(c).multiplyScalar(1.8) }, uFade: { value: 0 } },
          })
      ),
    []
  );

  useFrame(() => {
    const k = bangProgress();
    const on = k > 0 && k < 0.6;
    [fast.current, slowShell.current].forEach((m, i) => {
      if (!m) return;
      m.visible = on;
      if (!on) return;
      const speed = i === 0 ? 1 : 0.62;
      const p = Math.min(1, (k / 0.6) * (1 / speed));
      const e = 1 - Math.pow(1 - p, 3);
      m.scale.setScalar(0.2 + e * (i === 0 ? 34 : 22));
      // Soft: one gentle white wave, the blue one barely there
      mats[i].uniforms.uFade.value = (1 - p) * (1 - p) * (i === 0 ? 0.45 : 0.18);
    });
  });

  return (
    <>
      <mesh ref={fast} geometry={geo} material={mats[0]} visible={false} frustumCulled={false} />
      <mesh ref={slowShell} geometry={geo} material={mats[1]} visible={false} frustumCulled={false} />
    </>
  );
}
