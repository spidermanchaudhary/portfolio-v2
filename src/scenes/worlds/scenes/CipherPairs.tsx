"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MiniSceneProps } from "../types";
import { palette } from "@/lib/palette";
import { labelTexture, rng } from "../../shared/canvasTexture";

const CROWD = 240;
const PAIRS = 18;
const GAP = 1.3;
const SIGNAL = new THREE.Color(palette.signalHi);

const crowdVertex = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uSpread;
attribute float aSeed;
varying float vSeed;
void main() {
  vec3 p = position;
  p.x += sign(p.x) * uSpread;
  p += 0.05 * vec3(sin(uTime * 0.7 + aSeed * 30.0), cos(uTime * 0.6 + aSeed * 21.0), sin(uTime * 0.5 + aSeed * 11.0));
  vSeed = aSeed;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (2.0 + aSeed * 2.5) * uPixelRatio * (7.0 / -mv.z);
}`;
const crowdFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vSeed;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(uColor, smoothstep(0.5, 0.15, d) * uOpacity * (0.45 + vSeed * 0.55));
}`;

// Beams: 2 vertices per pair; aEnd interpolates 0→1 along the segment
const beamVertex = /* glsl */ `
uniform float uSpread;
attribute float aEnd;
attribute float aPhase;
varying float vAlong;
varying float vPhase;
void main() {
  vec3 p = position;
  p.x += sign(p.x) * uSpread;
  vAlong = aEnd;
  vPhase = aPhase;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const beamFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uPlain;
uniform vec3 uCipher;
varying float vAlong;
varying float vPhase;
void main() {
  float packet = fract(uTime * 0.32 + vPhase);
  float head = smoothstep(0.07, 0.0, abs(vAlong - packet));
  // In transit (middle 70%) the message is ciphertext: blue + flicker
  float transit = smoothstep(0.12, 0.2, vAlong) * smoothstep(0.88, 0.8, vAlong);
  float flick = 0.6 + 0.4 * fract(sin(floor(uTime * 24.0) + vPhase * 91.0) * 4375.5);
  vec3 c = mix(uPlain, uCipher, transit);
  float a = (0.1 + head * mix(1.0, flick, transit) * 1.4) * uOpacity;
  gl_FragColor = vec4(c * (1.0 + head), a);
}`;

/**
 * BlindBook — two crowds of anonymous students. Encrypted beams link
 * pairs across the gap: plaintext at each end, ciphertext in transit,
 * through a padlock in the middle.
 */
export default function CipherPairs({ activityRef, side }: MiniSceneProps) {
  const lock = useRef<THREE.Group>(null);

  const { crowdGeo, beamGeo } = useMemo(() => {
    const r = rng(1337);
    const pos = new Float32Array(CROWD * 2 * 3);
    const seed = new Float32Array(CROWD * 2);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < CROWD * 2; i++) {
      const left = i < CROWD;
      // Uniform-ish ball
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const rad = 0.85 * Math.cbrt(r());
      const s = Math.sqrt(1 - u * u);
      const v = new THREE.Vector3(s * Math.cos(th) * rad * 0.8 + (left ? -GAP : GAP), u * rad, s * Math.sin(th) * rad * 0.8);
      pts.push(v);
      pos.set([v.x, v.y, v.z], i * 3);
      seed[i] = r();
    }
    const crowdGeo = new THREE.BufferGeometry();
    crowdGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    crowdGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));

    const bPos = new Float32Array(PAIRS * 6);
    const bEnd = new Float32Array(PAIRS * 2);
    const bPhase = new Float32Array(PAIRS * 2);
    for (let k = 0; k < PAIRS; k++) {
      const a = pts[Math.floor(r() * CROWD)];
      const b = pts[CROWD + Math.floor(r() * CROWD)];
      // Alternate direction so messages flow both ways
      const [from, to] = k % 2 ? [b, a] : [a, b];
      bPos.set([from.x, from.y, from.z, to.x, to.y, to.z], k * 6);
      bEnd.set([0, 1], k * 2);
      const ph = k / PAIRS;
      bPhase.set([ph, ph], k * 2);
    }
    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    beamGeo.setAttribute("aEnd", new THREE.BufferAttribute(bEnd, 1));
    beamGeo.setAttribute("aPhase", new THREE.BufferAttribute(bPhase, 1));
    return { crowdGeo, beamGeo };
  }, []);

  const crowdMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: crowdVertex,
        fragmentShader: crowdFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uSpread: { value: 0.4 }, uColor: { value: new THREE.Color(palette.paper) }, uOpacity: { value: 0 } },
      }),
    []
  );
  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSpread: { value: 0.4 },
          uOpacity: { value: 0 },
          uPlain: { value: new THREE.Color(palette.paper) },
          uCipher: { value: new THREE.Color(palette.signalHi).multiplyScalar(1.5) },
        },
      }),
    []
  );
  const lockMat = useMemo(() => new THREE.MeshBasicMaterial({ color: palette.paper, toneMapped: false, transparent: true, opacity: 0.9 }), []);
  const label = useMemo(() => labelTexture("end-to-end encrypted", { color: "#96948C", size: 36 }), []);
  const labelMat = useMemo(() => new THREE.MeshBasicMaterial({ map: label.tex, transparent: true, opacity: 0 }), [label]);

  useFrame((state) => {
    const a = activityRef.current;
    const t = state.clock.elapsedTime;
    crowdMat.uniforms.uTime.value = t;
    crowdMat.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    beamMat.uniforms.uTime.value = t;
    // Crowds start apart and drift into range as you arrive
    const spread = 0.9 * (1 - a) + Math.sin(t * 0.4) * 0.05;
    crowdMat.uniforms.uSpread.value = spread;
    beamMat.uniforms.uSpread.value = spread;
    crowdMat.uniforms.uOpacity.value = 0.35 + a * 0.65;
    beamMat.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(a, 0.3, 1);
    labelMat.opacity = THREE.MathUtils.smoothstep(a, 0.7, 1) * 0.9;
    if (lock.current) {
      // Heartbeat in step with the packets passing through
      const beat = Math.pow(Math.max(0, Math.sin(t * 0.32 * Math.PI * 2 * 3)), 12);
      lock.current.scale.setScalar((0.6 + a * 0.4) * (1 + beat * 0.12));
      lockMat.color.set(palette.paper).lerp(SIGNAL, beat).multiplyScalar(1 + beat * 1.5);
    }
  });

  return (
    <group rotation={[0.08, -side * 0.14, 0]}>
      <points geometry={crowdGeo} material={crowdMat} frustumCulled={false} />
      <lineSegments geometry={beamGeo} material={beamMat} frustumCulled={false} />
      {/* Padlock */}
      <group ref={lock}>
        <mesh material={lockMat} position={[0, -0.08, 0]}>
          <boxGeometry args={[0.34, 0.26, 0.08]} />
        </mesh>
        <mesh material={lockMat} position={[0, 0.07, 0]}>
          <torusGeometry args={[0.11, 0.022, 10, 32, Math.PI]} />
        </mesh>
        <mesh position={[0, -0.08, 0.045]}>
          <circleGeometry args={[0.035, 16]} />
          <meshBasicMaterial color={palette.void} />
        </mesh>
      </group>
      <mesh material={labelMat} position={[0, -1.25, 0]}>
        <planeGeometry args={[0.16 * label.aspect, 0.16]} />
      </mesh>
    </group>
  );
}
