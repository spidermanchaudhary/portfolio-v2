"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Skill } from "@/data/types";
import { palette } from "@/lib/palette";
import type { Station } from "../track";
import { activity, damp, isNear } from "../shared/activity";
import { cloudinaryPng, useLazyTexture } from "../shared/useLazyTexture";
import { useUniverse } from "@/store/universe";

const RADIUS = 4.4;

const badgeVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const badgeFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uHas;
uniform float uAspect;
uniform float uGlow;
uniform vec3 uRing;
uniform vec3 uPlate;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  // Badge: dark plate + thin signal ring
  vec3 col = uPlate;
  float ring = smoothstep(0.012, 0.0, abs(d - 0.47));
  col += uRing * ring * (0.6 + uGlow);
  // Logo, fitted inside the badge
  vec2 size = uAspect > 1.0 ? vec2(0.6, 0.6 / uAspect) : vec2(0.6 * uAspect, 0.6);
  vec2 luv = c / size + 0.5;
  if (uHas > 0.5 && all(greaterThan(luv, vec2(0.0))) && all(lessThan(luv, vec2(1.0)))) {
    vec4 t = texture2D(uMap, luv);
    vec3 lc = t.rgb;
    // Dark logos (Next.js, GitHub) would vanish on a dark plate — ink them paper
    float l = dot(lc, vec3(0.299, 0.587, 0.114));
    lc = mix(lc, vec3(0.93, 0.92, 0.89), step(l, 0.22));
    col = mix(col, lc, t.a);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * The toolbox as an asteroid belt the camera flies through: every skill is
 * a badge on the ring, tumbling rocks fill the gaps. Drag across the
 * section to spin it.
 */
export default function ToolboxBelt({ station, trackIndex, skills }: { station: Station; trackIndex: number; skills: Skill[] }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Group>(null);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const spin = useRef({ angle: 0, vel: 0.08 });
  const act = useRef(0);
  const quality = useUniverse((s) => s.quality);
  const ROCKS = quality === "high" ? 220 : quality === "medium" ? 140 : 70;

  // Drag to spin — listeners on the HTML section (the canvas never gets events)
  useEffect(() => {
    const el = document.getElementById("toolbox");
    if (!el) return;
    let dragging = false;
    let lastX = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      spin.current.vel += (e.clientX - lastX) * 0.0025;
      lastX = e.clientX;
    };
    const up = () => (dragging = false);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const rockData = useMemo(() => {
    return Array.from({ length: ROCKS }, () => ({
      a: Math.random() * Math.PI * 2,
      r: RADIUS + (Math.random() - 0.5) * 1.6,
      z: (Math.random() - 0.5) * 1.4,
      s: 0.03 + Math.pow(Math.random(), 3) * 0.16,
      rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
      spin: (Math.random() - 0.5) * 1.5,
    }));
  }, [ROCKS]);

  const rockGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const rockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a3a40", roughness: 0.9, metalness: 0.05, flatShading: true }), []);
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const sc = useMemo(() => new THREE.Vector3(), []);
  const e = useMemo(() => new THREE.Euler(), []);

  useFrame((state, dt) => {
    const near = isNear(trackIndex, 1.8);
    if (group.current) group.current.visible = near;
    if (!near) return;
    act.current = damp(act.current, activity(trackIndex, 1.2), 3, dt);
    const s = spin.current;
    s.vel = damp(s.vel, 0.08, 0.8, dt);
    s.angle += s.vel * dt;
    if (ring.current) ring.current.rotation.z = s.angle;

    const t = state.clock.elapsedTime;
    const inst = rocks.current;
    if (inst) {
      rockData.forEach((r, i) => {
        const a = r.a + s.angle * 0.85;
        p.set(Math.cos(a) * r.r, Math.sin(a) * r.r, r.z);
        e.set(r.rot.x + t * r.spin, r.rot.y + t * r.spin * 0.7, 0);
        q.setFromEuler(e);
        sc.setScalar(r.s * (0.3 + act.current * 0.7));
        m.compose(p, q, sc);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={group} position={station.anchor}>
      <group ref={ring}>
        {skills.map((skill, i) => {
          const a = (i / skills.length) * Math.PI * 2;
          return <Badge key={skill.id} url={cloudinaryPng(skill.image)} position={[Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, 0]} angle={a} />;
        })}
      </group>
      <instancedMesh ref={rocks} args={[rockGeo, rockMat, ROCKS]} frustumCulled={false} />
    </group>
  );
}

function Badge({ url, position, angle }: { url: string; position: [number, number, number]; angle: number }) {
  const map = useLazyTexture(url);
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: badgeVertex,
        fragmentShader: badgeFragment,
        transparent: true,
        uniforms: {
          uMap: { value: null },
          uHas: { value: 0 },
          uAspect: { value: 1 },
          uGlow: { value: 0 },
          uRing: { value: new THREE.Color(palette.signalHi) },
          uPlate: { value: new THREE.Color("#15161c") },
        },
      }),
    []
  );
  useEffect(() => {
    if (!map) return;
    const img = map.image as HTMLImageElement;
    mat.uniforms.uMap.value = map;
    mat.uniforms.uHas.value = 1;
    mat.uniforms.uAspect.value = img.width / img.height;
  }, [map, mat]);

  useFrame((state) => {
    // Badges stay upright as the ring turns, with a slight bob
    if (!ref.current?.parent) return;
    ref.current.rotation.z = -ref.current.parent.rotation.z;
    ref.current.position.z = Math.sin(state.clock.elapsedTime * 0.8 + angle * 3) * 0.15;
  });

  return (
    <mesh ref={ref} material={mat} position={position}>
      <circleGeometry args={[0.36, 48]} />
    </mesh>
  );
}
