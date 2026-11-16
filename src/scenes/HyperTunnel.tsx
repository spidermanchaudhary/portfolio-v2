"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { palette } from "@/lib/palette";
import { warpAmount } from "@/lib/warp";

const COUNT = 1400;
const DEPTH = 140;

const vertex = /* glsl */ `
uniform float uOffset;
uniform float uLength;
attribute vec3 aSeed;   // x,y: position in the tube cross-section, z: depth phase
attribute float aEnd;   // 0 = head (nearest), 1 = tail
varying float vFade;
varying float vTint;
void main() {
  // Each streak travels toward the camera (+z in camera space) and wraps
  float z = mod(aSeed.z * ${DEPTH}.0 + uOffset, ${DEPTH}.0) - ${DEPTH}.0;
  vec3 p = vec3(aSeed.xy, z - aEnd * uLength);
  // (smoothstep edges must ascend — reversed edges are undefined in GLSL)
  vFade = smoothstep(-${DEPTH}.0, -${DEPTH}.0 * 0.55, z) * (1.0 - smoothstep(-12.0, -0.5, z)) * (1.0 - aEnd * 0.85);
  vTint = fract(aSeed.x * 13.7 + aSeed.y * 7.1);
  gl_Position = projectionMatrix * vec4(p, 1.0); // already in camera space
}`;

const fragment = /* glsl */ `
uniform float uOpacity;
uniform vec3 uPaper;
uniform vec3 uSignal;
varying float vFade;
varying float vTint;
void main() {
  vec3 c = mix(uPaper, uSignal, step(0.72, vTint));
  float a = vFade * uOpacity;
  gl_FragColor = vec4(c * a * 1.6, a);
}`;

/**
 * Hyperspace tunnel, locked to the camera. Streaks stream past
 * continuously while a page transition is running; speed and length come
 * from the warp envelope, so the jump accelerates, cruises and
 * decelerates — it never stops dead or reverses.
 */
export default function HyperTunnel() {
  const offset = useRef(0);

  const geometry = useMemo(() => {
    const seed = new Float32Array(COUNT * 2 * 3);
    const end = new Float32Array(COUNT * 2);
    for (let i = 0; i < COUNT; i++) {
      // Hollow tube so nothing streaks straight through the middle of the view
      const a = Math.random() * Math.PI * 2;
      const r = 2.2 + Math.pow(Math.random(), 0.6) * 16;
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r * 0.75;
      const sz = Math.random();
      for (let k = 0; k < 2; k++) {
        seed.set([sx, sy, sz], (i * 2 + k) * 3);
        end[i * 2 + k] = k;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 2 * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
    g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uOffset: { value: 0 },
          uLength: { value: 0 },
          uOpacity: { value: 0 },
          uPaper: { value: new THREE.Color(palette.paper) },
          uSignal: { value: new THREE.Color(palette.signalHi) },
        },
      }),
    []
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const w = warpAmount();
    // Always in the scene (so its shader is compiled at load, not mid-jump);
    // just invisible when idle
    if (w <= 0.003) {
      material.uniforms.uOpacity.value = 0;
      return;
    }
    // Forward speed: up to ~260 units/s at full warp
    offset.current += dt * (8 + w * 250);
    material.uniforms.uOffset.value = offset.current;
    material.uniforms.uLength.value = 0.4 + w * 22;
    material.uniforms.uOpacity.value = Math.min(1, w * 1.4);
  });

  return <lineSegments geometry={geometry} material={material} frustumCulled={false} renderOrder={10} />;
}
