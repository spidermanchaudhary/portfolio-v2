"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { flight, useUniverse } from "@/store/universe";
import { palette } from "@/lib/palette";
import { warpAmount } from "@/lib/warp";
import { bangAmount } from "@/lib/bang";

const STARS = { high: 9000, medium: 6000, low: 3500 } as const;

/** Volume the stars fill — wraps the whole flight path */
const Z_NEAR = 40;
const Z_FAR = -420;

const starVertex = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uBang;
attribute vec2 aSeed;
varying float vAlpha;
varying float vTint;
void main() {
  // Stars are flung out from the singularity at the origin
  vec4 mv = modelViewMatrix * vec4(position * uBang, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.65 + 0.35 * sin(uTime * (0.6 + aSeed.x * 2.2) + aSeed.y * 40.0);
  gl_PointSize = (0.6 + aSeed.x * 1.9) * uPixelRatio * (34.0 / -mv.z);
  gl_PointSize = clamp(gl_PointSize, 0.0, 6.0 * uPixelRatio);
  vAlpha = tw * smoothstep(240.0, 30.0, -mv.z) * smoothstep(0.0, 0.15, uBang);
  vTint = step(0.93, aSeed.y);
}`;

const starFragment = /* glsl */ `
uniform vec3 uPaper;
uniform vec3 uSignal;
varying float vAlpha;
varying float vTint;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(mix(uPaper, uSignal, vTint), smoothstep(0.5, 0.05, d) * vAlpha);
}`;

const streakVertex = /* glsl */ `
uniform vec3 uStreak;
attribute float aEnd;
varying float vEnd;
void main() {
  vec3 p = position + uStreak * aEnd;
  vEnd = aEnd;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const streakFragment = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
varying float vEnd;
void main() {
  gl_FragColor = vec4(uColor, uOpacity * (1.0 - vEnd));
}`;

/**
 * Background stars that twinkle at rest and stretch into hyperspace
 * streaks when you scroll fast. Two draw calls total.
 */
export default function Starfield() {
  const quality = useUniverse((s) => s.quality);
  const count = STARS[quality];

  const { stars, streaks } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      // Keep a clear tube around the flight path so stars never hit the lens
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.pow(Math.random(), 0.7) * 70;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.sin(a) * r * 0.7;
      pos[i * 3 + 2] = Z_NEAR + Math.random() * (Z_FAR - Z_NEAR);
      seed[i * 2] = Math.random();
      seed[i * 2 + 1] = Math.random();
    }
    const stars = new THREE.BufferGeometry();
    stars.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    stars.setAttribute("aSeed", new THREE.BufferAttribute(seed, 2));

    // Streaks: a subset of stars as 2-vertex segments (head, tail)
    const n = Math.floor(count / 3);
    const sPos = new Float32Array(n * 6);
    const sEnd = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 2; k++) {
        sPos[i * 6 + k * 3] = pos[i * 3];
        sPos[i * 6 + k * 3 + 1] = pos[i * 3 + 1];
        sPos[i * 6 + k * 3 + 2] = pos[i * 3 + 2];
        sEnd[i * 2 + k] = k;
      }
    }
    const streaks = new THREE.BufferGeometry();
    streaks.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    streaks.setAttribute("aEnd", new THREE.BufferAttribute(sEnd, 1));
    return { stars, streaks };
  }, [count]);

  useEffect(
    () => () => {
      stars.dispose();
      streaks.dispose();
    },
    [stars, streaks]
  );

  const [starMat, streakMat] = useMemo(
    () => [
      new THREE.ShaderMaterial({
        vertexShader: starVertex,
        fragmentShader: starFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uBang: { value: 0 },
          uPaper: { value: new THREE.Color(palette.paper) },
          uSignal: { value: new THREE.Color(palette.signalHi) },
        },
      }),
      new THREE.ShaderMaterial({
        vertexShader: streakVertex,
        fragmentShader: streakFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uStreak: { value: new THREE.Vector3() },
          uOpacity: { value: 0 },
          uColor: { value: new THREE.Color(palette.paper) },
        },
      }),
    ],
    []
  );

  useFrame(({ gl }, dt) => {
    starMat.uniforms.uTime.value += dt;
    starMat.uniforms.uPixelRatio.value = gl.getPixelRatio();
    starMat.uniforms.uBang.value = bangAmount();
    // Streaks trail opposite the camera's motion — forward flight smears
    // along z, the rocket chase smears vertically
    const { x, y, z } = flight.vel;
    const speed = Math.hypot(x, y, z);
    const len = THREE.MathUtils.clamp(speed * 0.09, 0, 9);
    if (speed > 1e-3) streakMat.uniforms.uStreak.value.set(x, y, z).multiplyScalar(-len / speed);
    // Hidden during a jump — the hyperspace tunnel owns the streaks then
    streakMat.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(len, 0.4, 3.5) * 0.55 * (1 - warpAmount());
  });

  return (
    <>
      <points geometry={stars} material={starMat} frustumCulled={false} />
      <lineSegments geometry={streaks} material={streakMat} frustumCulled={false} />
    </>
  );
}
