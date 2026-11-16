"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { palette } from "@/lib/palette";
import { flight } from "@/store/universe";
import type { Station } from "../track";
import { isNear } from "../shared/activity";

const LAMPS = 5;
const EXHAUST = 900;
export const LAUNCH_SECONDS = 5.5;

/** Probe height above the pad, `since` seconds after ignition. Shared with
 *  the camera rig so the camera can tilt up and follow it. */
export function probeAltitude(since: number) {
  if (since < 0.9) return 0;
  const k = since - 0.9;
  return 0.6 * k * k * k + 0.5 * k;
}

const exhaustVertex = /* glsl */ `
uniform float uTime;
uniform float uPower;
uniform float uPixelRatio;
attribute vec3 aSeed;
varying float vLife;
void main() {
  float life = fract(uTime * (0.9 + aSeed.x * 0.6) + aSeed.y);
  vec3 p = position;
  p.y -= life * (1.5 + uPower * 5.0);
  p.xz += (aSeed.xz - 0.5) * life * (0.6 + uPower * 2.2);
  vLife = life;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.0 - life) * (4.0 + uPower * 10.0) * uPixelRatio * (6.0 / -mv.z);
}`;
const exhaustFragment = /* glsl */ `
uniform vec3 uHot;
uniform vec3 uCool;
uniform float uPower;
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  vec3 c = mix(uHot, uCool, smoothstep(0.0, 0.6, vLife));
  gl_FragColor = vec4(c, smoothstep(0.5, 0.0, d) * (1.0 - vLife) * (0.15 + uPower));
}`;

/**
 * Launch — the contact form's pre-flight. Each completed field lights a
 * gantry lamp (flight.fuel); a successful send fires the probe
 * (flight.launchAt) and the camera tilts up to follow it.
 */
export default function LaunchPad({ station, trackIndex }: { station: Station; trackIndex: number }) {
  const group = useRef<THREE.Group>(null);
  const probe = useRef<THREE.Group>(null);
  const exhaust = useRef<THREE.Points>(null);
  const lamps = useRef<THREE.Mesh[]>([]);

  const hull = useMemo(() => new THREE.MeshStandardMaterial({ color: "#26262c", roughness: 0.55, metalness: 0.6 }), []);
  const paper = useMemo(() => new THREE.MeshStandardMaterial({ color: palette.paper, roughness: 0.4, metalness: 0.2 }), []);
  const lampMats = useMemo(() => Array.from({ length: LAMPS }, () => new THREE.MeshBasicMaterial({ color: "#2a2a30", toneMapped: false })), []);

  const exhaustGeo = useMemo(() => {
    const pos = new Float32Array(EXHAUST * 3);
    const seed = new Float32Array(EXHAUST * 3);
    for (let i = 0; i < EXHAUST; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.18;
      seed.set([Math.random(), Math.random(), Math.random()], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
    return g;
  }, []);
  const exhaustMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: exhaustVertex,
        fragmentShader: exhaustFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPower: { value: 0 },
          uPixelRatio: { value: 1 },
          uHot: { value: new THREE.Color(palette.paper).multiplyScalar(1.6) },
          uCool: { value: new THREE.Color(palette.signal) },
        },
      }),
    []
  );

  const lit = new THREE.Color(palette.signalHi).multiplyScalar(2.2);
  const dim = new THREE.Color("#2a2a30");

  useFrame((state, dt) => {
    const near = isNear(trackIndex, 1.8);
    if (group.current) group.current.visible = near;
    if (!near) return;
    const t = state.clock.elapsedTime;
    const now = performance.now() / 1000;
    const since = flight.launchAt > 0 ? now - flight.launchAt : -1;
    const launching = since >= 0 && since < LAUNCH_SECONDS + 2.5;

    // Lamps follow form completion; blink "go" when all lit
    const litCount = launching ? LAMPS : Math.round(flight.fuel * LAMPS);
    lampMats.forEach((m, i) => {
      const on = i < litCount;
      const blink = litCount === LAMPS ? 0.6 + 0.4 * Math.sin(t * 8 - i) : 1;
      m.color.copy(on ? lit : dim).multiplyScalar(on ? blink : 1);
    });

    // Probe: idle hover → ignition → accelerating climb → reset
    let y = 0.02 * Math.sin(t * 2);
    let power = flight.fuel * 0.15;
    let shake = 0;
    if (launching) {
      y = probeAltitude(since);
      power = since < 0.9 ? 0.4 + since : 1.4;
      shake = since < 0.9 ? 0.02 : 0;
      if (since > LAUNCH_SECONDS) power = 0;
    }
    if (probe.current) {
      probe.current.position.set((Math.random() - 0.5) * shake, 0.95 + y, (Math.random() - 0.5) * shake);
      probe.current.visible = !(launching && since > LAUNCH_SECONDS);
    }
    if (exhaust.current) exhaust.current.position.y = 0.95 + y - 0.55;
    exhaustMat.uniforms.uTime.value = t;
    exhaustMat.uniforms.uPower.value = THREE.MathUtils.lerp(exhaustMat.uniforms.uPower.value, power, 1 - Math.exp(-dt * 6));
    exhaustMat.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
  });

  return (
    <group ref={group} position={station.anchor}>
      {/* Pad */}
      <mesh material={hull} position={[0, -0.1, 0]}>
        <cylinderGeometry args={[1.6, 1.8, 0.2, 48]} />
      </mesh>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 0.93, 64]} />
        <meshBasicMaterial color={palette.signalHi} toneMapped={false} />
      </mesh>
      {/* Gantry tower with lamps */}
      <group position={[-1.05, 0, 0]}>
        {[-0.14, 0.14].map((x) => (
          <mesh key={x} material={hull} position={[x, 1.4, 0]}>
            <boxGeometry args={[0.05, 2.8, 0.05]} />
          </mesh>
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <mesh key={i} material={hull} position={[0, 0.2 + i * 0.4, 0]} rotation={[0, 0, i % 2 ? 0.9 : -0.9]}>
            <boxGeometry args={[0.03, 0.42, 0.03]} />
          </mesh>
        ))}
        {lampMats.map((m, i) => (
          <mesh
            key={i}
            material={m}
            position={[0.2, 0.45 + i * 0.5, 0.06]}
            ref={(el) => {
              if (el) lamps.current[i] = el;
            }}
          >
            <sphereGeometry args={[0.05, 12, 12]} />
          </mesh>
        ))}
      </group>
      {/* Probe */}
      <group ref={probe} position={[0, 0.95, 0]}>
        <mesh material={paper}>
          <cylinderGeometry args={[0.22, 0.26, 1.1, 32]} />
        </mesh>
        <mesh material={paper} position={[0, 0.8, 0]}>
          <coneGeometry args={[0.22, 0.5, 32]} />
        </mesh>
        <mesh position={[0, 0.25, 0.225]}>
          <circleGeometry args={[0.07, 24]} />
          <meshBasicMaterial color={palette.signalHi} toneMapped={false} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={hull} position={[Math.cos((i * Math.PI * 2) / 3) * 0.28, -0.45, Math.sin((i * Math.PI * 2) / 3) * 0.28]} rotation={[0, -(i * Math.PI * 2) / 3, 0]}>
            <boxGeometry args={[0.18, 0.3, 0.02]} />
          </mesh>
        ))}
      </group>
      <points ref={exhaust} geometry={exhaustGeo} material={exhaustMat} frustumCulled={false} />
    </group>
  );
}
