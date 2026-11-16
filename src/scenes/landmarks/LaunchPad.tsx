"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { palette } from "@/lib/palette";
import { flight } from "@/store/universe";
import type { Station } from "../track";
import { activity, isNear } from "../shared/activity";
import { canvasTexture } from "../shared/canvasTexture";
import Rocket from "./rocket/Rocket";

const LAMPS = 5;
const SMOKE = 70;
/** Seconds the submit-triggered launch takes to reach the top */
export const AUTO_LAUNCH_SECONDS = 9;
const TOWER_H = 3.9;

/* Launch progress p (0..1):
 *   0.00–0.12  countdown — steam venting, lamps strobe
 *   0.12–0.22  ignition  — flame builds, arms swing away, clamps open
 *   0.22–1.00  ascent    — accelerating climb; boosters separate at 0.62 */
const IGNITE = 0.12;
const LIFT = 0.22;
const SEP = 0.62;

export function rocketAltitude(p: number) {
  if (p <= LIFT) return 0;
  const k = (p - LIFT) / (1 - LIFT);
  return 24 * Math.pow(k, 2.1);
}

const flameVertex = /* glsl */ `
varying vec2 vUv;
varying float vY;
void main() {
  vUv = uv;
  vY = -position.y; // 0 at nozzle → 1 at tail (geometry spans 0..-1)
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const flameFragment = /* glsl */ `
uniform float uTime;
uniform float uPower;
uniform vec3 uCore;
uniform vec3 uOuter;
varying vec2 vUv;
varying float vY;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float y = clamp(vY, 0.0, 1.0);
  // Flicker noise scrolling down the plume
  float n = hash(vec2(floor(vUv.x * 24.0), floor((y - uTime * 3.0) * 18.0)));
  // Mach diamonds: bright periodic nodes near the nozzle
  float diamonds = pow(0.5 + 0.5 * cos(y * 34.0), 6.0) * smoothstep(0.55, 0.0, y);
  float body = pow(1.0 - y, 1.6);
  float a = body * (0.55 + n * 0.45) * uPower + diamonds * 0.9 * uPower;
  vec3 c = mix(uOuter, uCore, smoothstep(0.35, 0.0, y) + diamonds);
  gl_FragColor = vec4(c * a * 1.6, a);
}`;

// Exhaust trail: a column of soft points from the pad to the rocket.
// Stateless — driven by uAlt, so it rewinds when you scroll back up.
const trailVertex = /* glsl */ `
uniform float uAlt;
uniform float uTime;
uniform float uPixelRatio;
attribute vec3 aSeed;
varying float vA;
void main() {
  float u = aSeed.x;                    // 0 = pad, 1 = rocket
  float age = 1.0 - u;                  // older smoke lower down
  vec3 p = vec3(0.0, u * uAlt, 0.0);
  float spread = 0.12 + age * age * 1.6;
  float ang = aSeed.y * 6.2831 + uTime * 0.05;
  p.x += cos(ang) * spread * aSeed.z + age * 0.6 * sin(u * 6.0 + aSeed.y);
  p.z += sin(ang) * spread * aSeed.z;
  vA = smoothstep(0.0, 0.05, u) * (1.0 - smoothstep(0.85, 1.0, u)) * (0.35 + 0.65 * age);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (18.0 + age * 90.0) * uPixelRatio * (1.0 / -mv.z);
}`;

const smokeVertex = /* glsl */ `
uniform float uTime;
uniform float uBurst;
uniform float uPixelRatio;
attribute vec4 aSeed;
varying float vA;
void main() {
  float life = fract(uTime * (0.12 + aSeed.x * 0.08) + aSeed.y);
  float ang = aSeed.z * 6.2831;
  // Billows out along the flame trench, then rises and spreads
  vec3 p = position;
  p.x += cos(ang) * life * (0.6 + uBurst * 3.4);
  p.z += sin(ang) * life * (0.4 + uBurst * 2.4);
  p.y += life * life * (0.4 + uBurst * 1.6);
  vA = (1.0 - life) * smoothstep(0.0, 0.08, life);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (30.0 + life * 160.0 * (0.4 + uBurst)) * uPixelRatio * (1.0 / -mv.z) * (0.6 + aSeed.w);
}`;
const smokeFragment = /* glsl */ `
uniform float uOpacity;
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d) * vA * uOpacity;
  gl_FragColor = vec4(uColor * a, a);
}`;

/**
 * Launch — background of the contact section. When the section comes into
 * view the rocket counts down, ignites and flies out of frame on its own.
 * Leaving and returning resets it for another launch; a successful form
 * send restarts the sequence too.
 */
export default function LaunchPad({ station, trackIndex }: { station: Station; trackIndex: number }) {
  const group = useRef<THREE.Group>(null);
  const rocket = useRef<THREE.Group>(null);
  const boosters = useRef<THREE.Group[]>([]);
  const flame = useRef<THREE.Mesh>(null);
  const boosterFlames = useRef<THREE.Mesh[]>([]);
  const arms = useRef<THREE.Group[]>([]);
  const clamps = useRef<THREE.Group[]>([]);
  const light = useRef<THREE.PointLight>(null);
  const smokePts = useRef<THREE.Points>(null);

  const hull = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2b31", roughness: 0.5, metalness: 0.65 }), []);
  const concrete = useMemo(() => {
    const tex = canvasTexture(512, 512, (c, w, h) => {
      c.fillStyle = "#1c1d22";
      c.fillRect(0, 0, w, h);
      // Hazard ring
      const cx = w / 2;
      const cy = h / 2;
      for (let i = 0; i < 48; i++) {
        c.fillStyle = i % 2 ? "#1c1d22" : "#3D5CFF";
        c.beginPath();
        c.moveTo(cx, cy);
        c.arc(cx, cy, w * 0.47, (i / 48) * Math.PI * 2, ((i + 1) / 48) * Math.PI * 2);
        c.fill();
      }
      c.fillStyle = "#1c1d22";
      c.beginPath();
      c.arc(cx, cy, w * 0.44, 0, Math.PI * 2);
      c.fill();
      // Flame trench
      c.fillStyle = "#08080a";
      c.fillRect(cx - 34, cy - w * 0.4, 68, w * 0.8);
      c.strokeStyle = "rgba(236,234,227,0.12)";
      c.lineWidth = 2;
      for (let r = 60; r < w * 0.44; r += 40) {
        c.beginPath();
        c.arc(cx, cy, r, 0, Math.PI * 2);
        c.stroke();
      }
    });
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.1 });
  }, []);
  const lampMats = useMemo(() => Array.from({ length: LAMPS }, () => new THREE.MeshBasicMaterial({ color: "#2a2a30", toneMapped: false })), []);
  const flameMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: flameVertex,
        fragmentShader: flameFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPower: { value: 0 },
          uCore: { value: new THREE.Color("#ffffff").multiplyScalar(2.2) },
          uOuter: { value: new THREE.Color(palette.signal).multiplyScalar(1.6) },
        },
      }),
    []
  );
  const flameGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.16, 0.05, 1, 32, 24, true);
    g.translate(0, -0.5, 0); // spans y 0 → -1
    return g;
  }, []);

  const smokeGeo = useMemo(() => {
    const pos = new Float32Array(SMOKE * 3);
    const seed = new Float32Array(SMOKE * 4);
    for (let i = 0; i < SMOKE; i++) {
      pos.set([(Math.random() - 0.5) * 0.4, 0.05, (Math.random() - 0.5) * 0.4], i * 3);
      seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    return g;
  }, []);
  const smokeMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: smokeVertex,
        fragmentShader: smokeFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uBurst: { value: 0 },
          uOpacity: { value: 0.12 },
          uPixelRatio: { value: 1 },
          uColor: { value: new THREE.Color("#b9bcd0") },
        },
      }),
    []
  );

  const trailGeo = useMemo(() => {
    const n = 520;
    const seed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) seed.set([Math.random(), Math.random(), Math.random()], i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
    return g;
  }, []);
  const trailMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: trailVertex,
        fragmentShader: smokeFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uAlt: { value: 0 },
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uOpacity: { value: 0.22 },
          uColor: { value: new THREE.Color("#c2c6dc") },
        },
      }),
    []
  );

  const lit = useMemo(() => new THREE.Color(palette.signalHi).multiplyScalar(2.2), []);
  const dim = useMemo(() => new THREE.Color("#2a2a30"), []);
  const boosterDrift = useMemo(() => [new THREE.Vector3(-1, -0.4, 0.3), new THREE.Vector3(1, -0.5, -0.2)], []);

  useFrame((state, dt) => {
    const near = isNear(trackIndex, 1.6);
    if (group.current) group.current.visible = near;
    if (!near) {
      // Out of view: quietly reset so a fresh rocket waits on the pad
      flight.launchAt = -1;
      flight.rocketAlt = 0;
      flight.launchP = 0;
      return;
    }
    const t = state.clock.elapsedTime;
    const now = performance.now() / 1000;

    // Launches by itself once the contact section is in view (a successful
    // form send also restarts the sequence via flight.launchAt)
    if (flight.launchAt < 0 && activity(trackIndex, 1) > 0.5) flight.launchAt = now + 0.6;
    const since = flight.launchAt > 0 ? now - flight.launchAt : -1;
    // Stays at 1 (gone) after the flight until the section leaves view
    const p = since < 0 ? 0 : Math.min(1, since / AUTO_LAUNCH_SECONDS);
    flight.launchP = p;

    const alt = rocketAltitude(p);
    // Camera glances up during the climb, then settles back once it is gone
    flight.rocketAlt = p >= 1 ? 0 : alt;
    const ignition = THREE.MathUtils.smoothstep(p, IGNITE, LIFT);
    const countdown = p > 0.005 && p < IGNITE;
    const power = p >= IGNITE && p < 0.995 ? 0.35 + ignition * 0.65 : 0;

    // Lamps: form completion, strobing through the countdown
    const litCount = p > 0 ? LAMPS : Math.round(flight.fuel * LAMPS);
    lampMats.forEach((m, i) => {
      const on = i < litCount;
      const strobe = countdown ? (Math.floor(t * 6 + i) % 2 ? 1 : 0.35) : litCount === LAMPS ? 0.65 + 0.35 * Math.sin(t * 6 - i) : 1;
      m.color.copy(on ? lit : dim).multiplyScalar(on ? strobe : 1);
    });

    // Rocket: shake at ignition, then climb
    if (rocket.current) {
      const shake = ignition > 0 && p < LIFT + 0.08 ? 0.012 * ignition : 0;
      rocket.current.position.set((Math.random() - 0.5) * shake, 0.24 + alt, (Math.random() - 0.5) * shake);
      rocket.current.rotation.z = alt > 0 ? Math.min(alt * 0.004, 0.06) : 0; // gentle gravity turn
      rocket.current.visible = p < 0.995;
    }

    // Booster separation: drift outward, tumble, flames out
    const sep = THREE.MathUtils.smoothstep(p, SEP, SEP + 0.2);
    boosters.current.forEach((b, i) => {
      if (!b) return;
      const d = boosterDrift[i];
      b.position.set((i === 0 ? -0.37 : 0.37) + d.x * sep * 1.4, 0.12 + d.y * sep * 3, d.z * sep);
      b.rotation.set(d.z * sep * 2, 0, -d.x * sep * 1.1);
      const bf = boosterFlames.current[i];
      if (bf) bf.visible = power > 0 && sep < 0.05;
    });

    // Flames
    flameMat.uniforms.uTime.value = t;
    flameMat.uniforms.uPower.value = power * (0.9 + Math.random() * 0.1);
    if (flame.current) {
      flame.current.visible = power > 0;
      flame.current.scale.set(1, 0.6 + power * 1.6 + Math.min(alt, 10) * 0.05, 1);
    }
    boosterFlames.current.forEach((f) => f && f.scale.set(0.7, 0.4 + power * 1.1, 0.7));

    // Pad light from the engine
    if (light.current) {
      light.current.intensity = power * (30 + Math.random() * 6) * Math.max(0.2, 1 - alt * 0.06);
      light.current.position.set(0, 0.1 + Math.min(alt, 3), 0.6);
    }

    // Smoke / steam: a little venting during countdown, a burst at ignition
    smokeMat.uniforms.uTime.value = t;
    smokeMat.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    const burst = ignition * (1 - THREE.MathUtils.smoothstep(p, 0.5, 0.95));
    smokeMat.uniforms.uBurst.value = THREE.MathUtils.lerp(smokeMat.uniforms.uBurst.value, burst, 1 - Math.exp(-dt * 3));
    smokeMat.uniforms.uOpacity.value = 0.06 + (countdown ? 0.08 : 0) + burst * 0.22;

    trailMat.uniforms.uAlt.value = alt + 0.3;
    trailMat.uniforms.uTime.value = t;
    trailMat.uniforms.uPixelRatio.value = state.gl.getPixelRatio();

    // Swing arms retract, hold-down clamps open
    arms.current.forEach((a, i) => a && (a.rotation.y = -ignition * (1.2 + i * 0.25)));
    clamps.current.forEach((c) => c && (c.rotation.z = -ignition * 0.9));
  });

  return (
    <group ref={group} position={station.anchor}>
      {/* Pad */}
      <mesh material={concrete} position={[0, -0.12, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[1.9, 2.1, 0.24, 64]} />
      </mesh>
      <mesh material={concrete} position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.9, 64]} />
      </mesh>
      {/* Launch mount */}
      <mesh material={hull} position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.5, 0.58, 0.24, 6, 1, true]} />
      </mesh>
      {/* Hold-down clamps */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 2 + Math.PI / 4, 0]}>
          <group
            position={[0.42, 0.24, 0]}
            ref={(el) => {
              if (el) clamps.current[i] = el;
            }}
          >
            <mesh material={hull} position={[-0.04, 0.09, 0]}>
              <boxGeometry args={[0.06, 0.18, 0.08]} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Lattice tower */}
      <group position={[-1.05, 0, -0.25]}>
        {[
          [-0.16, -0.16],
          [0.16, -0.16],
          [-0.16, 0.16],
          [0.16, 0.16],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} material={hull} position={[x, TOWER_H / 2, z]}>
            <boxGeometry args={[0.035, TOWER_H, 0.035]} />
          </mesh>
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <group key={i} position={[0, 0.2 + i * 0.38, 0]}>
            {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r) => (
              <group key={r} rotation={[0, r, 0]}>
                <mesh material={hull} position={[0, 0.19, 0.16]} rotation={[0, 0, i % 2 ? 0.95 : -0.95]}>
                  <boxGeometry args={[0.016, 0.44, 0.016]} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
        {/* Lamps up the tower */}
        {lampMats.map((m, i) => (
          <mesh key={i} material={m} position={[0.2, 0.5 + i * 0.66, 0.2]}>
            <sphereGeometry args={[0.045, 12, 12]} />
          </mesh>
        ))}
        {/* Swing arms (pivot at the tower) */}
        {/* Lower arm reaches the booster, upper arm the upper stage */}
        {[
          [1.7, 0.4],
          [2.95, 0.66],
        ].map(([y, len], i) => (
          <group
            key={y}
            position={[0.16, y, 0.25]}
            ref={(el) => {
              if (el) arms.current[i] = el;
            }}
          >
            <mesh material={hull} position={[len / 2, 0, 0]}>
              <boxGeometry args={[len, 0.06, 0.1]} />
            </mesh>
          </group>
        ))}
        {/* Beacon on top */}
        <mesh position={[0, TOWER_H + 0.08, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshBasicMaterial color={new THREE.Color(palette.signalHi).multiplyScalar(2)} toneMapped={false} />
        </mesh>
      </group>

      {/* Vehicle */}
      <group ref={rocket} position={[0, 0.24, 0]}>
        <Rocket boosterRefs={boosters} />
        <mesh ref={flame} geometry={flameGeo} material={flameMat} position={[0, 0.02, 0]} visible={false} />
        {[-1, 1].map((d, i) => (
          <mesh
            key={d}
            geometry={flameGeo}
            material={flameMat}
            position={[d * 0.37, 0.0, 0]}
            visible={false}
            ref={(el) => {
              if (el) boosterFlames.current[i] = el;
            }}
          />
        ))}
      </group>

      <points ref={smokePts} geometry={smokeGeo} material={smokeMat} frustumCulled={false} />
      <points geometry={trailGeo} material={trailMat} frustumCulled={false} />
      <pointLight ref={light} color={palette.signalHi} intensity={0} distance={8} decay={1.5} />
    </group>
  );
}
