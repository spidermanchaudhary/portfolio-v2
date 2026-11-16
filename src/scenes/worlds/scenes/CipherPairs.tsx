"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MiniSceneProps } from "../types";
import { palette } from "@/lib/palette";
import { canvasTexture, labelTexture, rng, roundRect } from "../../shared/canvasTexture";

const COLS = 4;
const ROWS = 5;
const PER_WALL = COLS * ROWS;
const TILE = 0.3;
const GAP_X = 1.35; // distance of each wall from centre
const PAIRS = 14;
const SIGNAL = new THREE.Color(palette.signalHi);

// Beams: 2 vertices per pair; aEnd interpolates 0→1 along the segment
const beamVertex = /* glsl */ `
attribute float aEnd;
attribute float aPhase;
varying float vAlong;
varying float vPhase;
void main() {
  vAlong = aEnd;
  vPhase = aPhase;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const beamFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uPlain;
uniform vec3 uCipher;
varying float vAlong;
varying float vPhase;
void main() {
  float packet = fract(uTime * 0.3 + vPhase);
  float head = smoothstep(0.08, 0.0, abs(vAlong - packet));
  // In transit (middle stretch) the message is ciphertext: blue + flicker
  float transit = smoothstep(0.15, 0.25, vAlong) * smoothstep(0.85, 0.75, vAlong);
  float flick = 0.55 + 0.45 * fract(sin(floor(uTime * 24.0) + vPhase * 91.0) * 4375.5);
  vec3 c = mix(uPlain, uCipher, transit);
  float a = (0.08 + head * mix(1.0, flick, transit) * 1.5) * uOpacity;
  gl_FragColor = vec4(c * (1.0 + head), a);
}`;

/**
 * BlindBook — two walls of anonymous students face each other. Encrypted
 * beams link pairs across the gap: plaintext at each end, ciphertext in
 * transit, beating through a padlock in the middle.
 */
export default function CipherPairs({ activityRef, side }: MiniSceneProps) {
  const lock = useRef<THREE.Group>(null);
  const walls = useRef<THREE.InstancedMesh>(null);

  const { tiles, beamGeo, avatar, label } = useMemo(() => {
    const r = rng(1337);
    // Each wall is angled toward the centre, like two crowds facing off
    const tiles: { pos: THREE.Vector3; rot: THREE.Euler; lit: number }[] = [];
    for (const dir of [-1, 1]) {
      for (let i = 0; i < PER_WALL; i++) {
        const c = i % COLS;
        const row = Math.floor(i / COLS);
        const localX = (c - (COLS - 1) / 2) * (TILE + 0.06);
        const yaw = -dir * 0.65;
        const pos = new THREE.Vector3(
          dir * GAP_X + Math.cos(yaw) * localX,
          ((ROWS - 1) / 2 - row) * (TILE + 0.06),
          -Math.sin(yaw) * localX
        );
        tiles.push({ pos, rot: new THREE.Euler(0, yaw, 0), lit: r() });
      }
    }

    const bPos = new Float32Array(PAIRS * 6);
    const bEnd = new Float32Array(PAIRS * 2);
    const bPhase = new Float32Array(PAIRS * 2);
    for (let k = 0; k < PAIRS; k++) {
      const a = tiles[Math.floor(r() * PER_WALL)].pos;
      const b = tiles[PER_WALL + Math.floor(r() * PER_WALL)].pos;
      const [from, to] = k % 2 ? [b, a] : [a, b];
      bPos.set([from.x, from.y, from.z + 0.02, to.x, to.y, to.z + 0.02], k * 6);
      bEnd.set([0, 1], k * 2);
      bPhase.set([k / PAIRS, k / PAIRS], k * 2);
    }
    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    beamGeo.setAttribute("aEnd", new THREE.BufferAttribute(bEnd, 1));
    beamGeo.setAttribute("aPhase", new THREE.BufferAttribute(bPhase, 1));

    // Anonymous avatar: a silhouette behind a mask band
    const avatar = canvasTexture(128, 128, (c, w, h) => {
      roundRect(c, 3, 3, w - 6, h - 6, 18);
      c.fillStyle = "#16171d";
      c.fill();
      c.strokeStyle = "rgba(236,234,227,0.35)";
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = "#ECEAE3";
      c.beginPath();
      c.arc(w / 2, 50, 21, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(w / 2, h + 6, 44, Math.PI, 0);
      c.fill();
      c.fillStyle = "#3D5CFF";
      c.fillRect(w / 2 - 26, 43, 52, 11);
    });
    return { tiles, beamGeo, avatar, label: labelTexture("end-to-end encrypted", { color: "#96948C", size: 36 }) };
  }, []);

  const tileGeo = useMemo(() => new THREE.PlaneGeometry(TILE, TILE), []);
  const tileMat = useMemo(() => new THREE.MeshBasicMaterial({ map: avatar, transparent: true, side: THREE.DoubleSide, toneMapped: false }), [avatar]);
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
          uOpacity: { value: 0 },
          uPlain: { value: new THREE.Color(palette.paper) },
          uCipher: { value: new THREE.Color(palette.signalHi).multiplyScalar(1.5) },
        },
      }),
    []
  );
  const lockMat = useMemo(() => new THREE.MeshBasicMaterial({ color: palette.paper, toneMapped: false }), []);
  const labelMat = useMemo(() => new THREE.MeshBasicMaterial({ map: label.tex, transparent: true, opacity: 0 }), [label]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), p: new THREE.Vector3(), c: new THREE.Color() }), []);

  useFrame((state) => {
    const a = activityRef.current;
    const t = state.clock.elapsedTime;
    beamMat.uniforms.uTime.value = t;
    beamMat.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(a, 0.3, 1);
    labelMat.opacity = THREE.MathUtils.smoothstep(a, 0.7, 1) * 0.9;

    const inst = walls.current;
    if (inst) {
      const { m, q, s, p, c } = tmp;
      tiles.forEach((tile, i) => {
        // Walls slide in from wider apart as you arrive
        p.copy(tile.pos);
        p.x += Math.sign(tile.pos.x) * (1 - a) * 0.9;
        q.setFromEuler(tile.rot);
        s.setScalar(0.5 + a * 0.5);
        m.compose(p, q, s);
        inst.setMatrixAt(i, m);
        // Someone in the crowd is always typing
        const typing = Math.pow(Math.max(0, Math.sin(t * 1.3 + tile.lit * 40)), 20);
        c.setScalar(0.55 + typing * 0.6);
        inst.setColorAt(i, c);
      });
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }

    if (lock.current) {
      const beat = Math.pow(Math.max(0, Math.sin(t * 0.3 * Math.PI * 2 * 2)), 12);
      lock.current.scale.setScalar((0.6 + a * 0.4) * (1 + beat * 0.12));
      lockMat.color.set(palette.paper).lerp(SIGNAL, beat).multiplyScalar(0.9 + beat * 1.2);
    }
  });

  return (
    <group rotation={[0.05, -side * 0.12, 0]}>
      <instancedMesh ref={walls} args={[tileGeo, tileMat, PER_WALL * 2]} frustumCulled={false} />
      <lineSegments geometry={beamGeo} material={beamMat} frustumCulled={false} />
      {/* Padlock */}
      <group ref={lock} position={[0, 0, 0.3]}>
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
      <mesh material={labelMat} position={[0, -1.25, 0.3]}>
        <planeGeometry args={[0.16 * label.aspect, 0.16]} />
      </mesh>
    </group>
  );
}
