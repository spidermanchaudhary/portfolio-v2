"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { origin } from "@/data/origin";
import { palette } from "@/lib/palette";
import type { Station } from "../track";
import { activity, damp, isNear } from "../shared/activity";
import { flight, useUniverse } from "@/store/universe";
import { useLazyTexture } from "../shared/useLazyTexture";

const trailVertex = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
attribute float aU;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // A pulse of light travels the trail toward the future
  float pulse = smoothstep(0.06, 0.0, abs(fract(aU * 3.0 - uTime * 0.12) - 0.5) - 0.44);
  gl_PointSize = min((2.0 + pulse * 3.0) * (10.0 / -mv.z), 7.0) * uPixelRatio;
  // Fade far away and right at the lens
  vAlpha = (0.35 + pulse * 0.65) * smoothstep(60.0, 4.0, -mv.z) * smoothstep(1.5, 6.0, -mv.z);
}`;
const trailFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  if (length(gl_PointCoord - 0.5) > 0.5) discard;
  gl_FragColor = vec4(uColor, vAlpha);
}`;

const photoVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const photoFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uReveal;
uniform float uTime;
uniform vec3 uDark;
uniform vec3 uLight;
uniform float uHasMap;
varying vec2 vUv;
void main() {
  // Wipe-in from the bottom like a scanner printing the memory
  float edge = uReveal * 1.15 - 0.075;
  if (vUv.y > edge + 0.04) discard;
  vec3 tex = uHasMap > 0.5 ? texture2D(uMap, vUv).rgb : vec3(0.2);
  float l = dot(tex, vec3(0.299, 0.587, 0.114));
  vec3 col = mix(uDark, uLight, smoothstep(0.08, 0.85, l));
  col *= 0.86 + 0.14 * sin(vUv.y * 420.0 + uTime * 3.0);   // scanlines
  float lead = smoothstep(0.04, 0.0, abs(vUv.y - edge));    // printing head
  col += uLight * lead * 1.4;
  gl_FragColor = vec4(col, 0.92);
}`;

/**
 * Origin as a timeline through space: a dotted trail from the galaxy
 * through four beacons, each with a duotone "memory" photo that prints
 * itself in as you arrive.
 */
export default function OriginTrail({ stations }: { stations: Station[] }) {
  const beacons = stations.filter((s) => s.kind === "origin");
  const firstIdx = stations.findIndex((s) => s.kind === "origin");
  const toolbox = stations.find((s) => s.kind === "toolbox");

  const { geo, mat } = useMemo(() => {
    // From just beyond the galaxy disc, through each beacon, to the belt
    const pts = [new THREE.Vector3(0, -0.5, -9), ...beacons.map((b) => b.anchor), toolbox ? toolbox.anchor.clone().add(new THREE.Vector3(1.5, -1, 16)) : new THREE.Vector3(0, 0, -85)];
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const n = 900;
    const pos = new Float32Array(n * 3);
    const u = new Float32Array(n);
    const p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      curve.getPointAt(i / (n - 1), p);
      pos.set([p.x, p.y, p.z], i * 3);
      u[i] = i / (n - 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aU", new THREE.BufferAttribute(u, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: trailVertex,
      fragmentShader: trailFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uColor: { value: new THREE.Color(palette.signalHi) } },
    });
    return { geo, mat };
  }, [beacons, toolbox]);

  const trail = useRef<THREE.Points>(null);
  useFrame(({ gl }, dt) => {
    mat.uniforms.uTime.value += dt;
    mat.uniforms.uPixelRatio.value = gl.getPixelRatio();
    // Only once the galaxy has unravelled, and gone before the belt
    if (trail.current) trail.current.visible = flight.t > 0.9 && flight.t < firstIdx + beacons.length + 0.6 && !useUniverse.getState().focusSlug;
  });

  return (
    <>
      <points ref={trail} geometry={geo} material={mat} frustumCulled={false} />
      {beacons.map((b, i) => (
        <Beacon key={b.key} station={b} trackIndex={firstIdx + i} texture={origin[i]?.texture ?? null} />
      ))}
    </>
  );
}

function Beacon({ station, trackIndex, texture }: { station: Station; trackIndex: number; texture: string | null }) {
  const group = useRef<THREE.Group>(null);
  const act = useRef(0);
  const map = useLazyTexture(texture);

  const photoMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: photoVertex,
        fragmentShader: photoFragment,
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
          uMap: { value: null },
          uHasMap: { value: 0 },
          uReveal: { value: 0 },
          uTime: { value: 0 },
          uDark: { value: new THREE.Color("#0d1030") },
          uLight: { value: new THREE.Color(palette.paper) },
        },
      }),
    []
  );
  const aspect = map?.image ? (map.image as HTMLImageElement).width / (map.image as HTMLImageElement).height : 0.8;


  useFrame((state, dt) => {
    const near = isNear(trackIndex, 1.7);
    if (group.current) group.current.visible = near;
    if (!near) return;
    act.current = damp(act.current, activity(trackIndex, 0.9), 3, dt);
    const t = state.clock.elapsedTime;
    photoMat.uniforms.uMap.value = map;
    photoMat.uniforms.uHasMap.value = map ? 1 : 0;
    photoMat.uniforms.uReveal.value = act.current;
    photoMat.uniforms.uTime.value = t;
  });

  const h = 2.0;
  return (
    <group ref={group} position={station.anchor}>
      <mesh material={photoMat} position={[station.side * 0.2, 0, 0]} rotation={[0, -station.side * 0.22, station.side * 0.03]}>
        <planeGeometry args={[h * aspect, h]} />
      </mesh>
    </group>
  );
}
