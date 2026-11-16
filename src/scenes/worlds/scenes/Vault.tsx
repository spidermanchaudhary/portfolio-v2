"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MiniSceneProps } from "../types";
import { palette } from "@/lib/palette";
import { canvasTexture, labelTexture, rng } from "../../shared/canvasTexture";

const FILES = 48;
const TYPE_COLORS = [
  new THREE.Color(palette.paper).multiplyScalar(0.85), // docs
  new THREE.Color(palette.signalHi).multiplyScalar(1.2), // images
  new THREE.Color("#9a988f"), // code
  new THREE.Color("#5f6070"), // archives
];

/**
 * Sdrive — loose files orbit the vault. On arrival they sort by type:
 * half onto an open public shelf, half into a private vault whose lid
 * seals shut.
 */
export default function Vault({ activityRef, side }: MiniSceneProps) {
  const files = useRef<THREE.InstancedMesh>(null);
  const lid = useRef<THREE.Group>(null);
  const seam = useRef<THREE.MeshBasicMaterial>(null);

  const pub = -side; // public rack sits toward screen centre
  const priv = side;

  const { data, sheet, labels } = useMemo(() => {
    const r = rng(2024);
    let pubSlot = 0;
    let privSlot = 0;
    const data = Array.from({ length: FILES }, (_, i) => {
      const isPublic = i % 2 === 0;
      const type = Math.floor(r() * 4);
      let target: THREE.Vector3;
      let hidden = false;
      if (isPublic) {
        // 8 per shelf × 3 shelves, standing on the shelf boards
        const s = pubSlot++;
        target = new THREE.Vector3(pub * 1.0 + ((s % 8) - 3.5) * 0.115, -0.215 + Math.floor(s / 8) * 0.36, 0.05);
      } else {
        const s = privSlot++;
        target = new THREE.Vector3(priv * 1.0 + ((s % 4) - 1.5) * 0.18, -0.35 + Math.floor(s / 4) * 0.035, -0.05);
        hidden = true;
      }
      const ang = r() * Math.PI * 2;
      const rad = 1.9 + r() * 0.8;
      return {
        type,
        isPublic,
        hidden,
        orbit: { ang, rad, y: (r() - 0.5) * 1.6, speed: 0.15 + r() * 0.2 },
        target,
        spin: new THREE.Euler(r() * 6, r() * 6, r() * 6),
        delay: r() * 0.35,
      };
    });
    // Public shelf: sort slots by type so the rack reads as organised
    const pubs = data.filter((d) => d.isPublic);
    const slots = pubs.map((d) => d.target.clone()).sort((a, b) => a.y - b.y || a.x - b.x);
    pubs.sort((a, b) => a.type - b.type).forEach((d, i) => d.target.copy(slots[i]));

    const sheet = canvasTexture(96, 128, (c, w, h) => {
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(w - 26, 0);
      c.lineTo(w, 26);
      c.lineTo(w, h);
      c.lineTo(0, h);
      c.closePath();
      c.fill();
      c.fillStyle = "rgba(0,0,0,0.25)";
      c.beginPath();
      c.moveTo(w - 26, 0);
      c.lineTo(w - 26, 26);
      c.lineTo(w, 26);
      c.fill();
      c.fillStyle = "rgba(0,0,0,0.3)";
      for (let k = 0; k < 4; k++) c.fillRect(12, 46 + k * 16, w - 30 - (k % 2) * 18, 6);
    });
    return {
      data,
      sheet,
      labels: { pub: labelTexture("public", { color: "#96948C", size: 36 }), priv: labelTexture("private", { color: "#7D92FF", size: 36 }) },
    };
  }, [pub, priv]);

  const geo = useMemo(() => new THREE.PlaneGeometry(0.13, 0.17), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: sheet, transparent: true, side: THREE.DoubleSide, toneMapped: false }), [sheet]);
  const hull = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1d1e25", metalness: 0.7, roughness: 0.35 }), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1.0, 1.1, 0.4)), []);
  const vaultEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(0.96, 0.61, 0.61)), []);
  const edgeMat = useMemo(() => new THREE.LineBasicMaterial({ color: palette.paper, transparent: true, opacity: 0.55 }), []);
  const pubMat = useMemo(() => new THREE.MeshBasicMaterial({ map: labels.pub.tex, transparent: true }), [labels]);
  const privMat = useMemo(() => new THREE.MeshBasicMaterial({ map: labels.priv.tex, transparent: true }), [labels]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), o: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(), id: new THREE.Quaternion() }), []);

  useFrame((state) => {
    const inst = files.current;
    if (!inst) return;
    const a = activityRef.current;
    const t = state.clock.elapsedTime;
    const { m, p, o, q, e, s, id } = tmp;

    data.forEach((d, i) => {
      const k = THREE.MathUtils.clamp(a * 1.6 - d.delay - (d.isPublic ? 0 : 0.15), 0, 1);
      const ease = k * k * (3 - 2 * k);
      const ang = d.orbit.ang + t * d.orbit.speed;
      o.set(Math.cos(ang) * d.orbit.rad, d.orbit.y + Math.sin(t + i) * 0.05, Math.sin(ang) * d.orbit.rad * 0.6);
      p.copy(o).lerp(d.target, ease);
      e.set(d.spin.x + t * 0.6, d.spin.y + t * 0.4, d.spin.z);
      q.setFromEuler(e).slerp(id, ease);
      // Private files shrink as they drop inside the vault
      const sc = d.hidden ? 1 - THREE.MathUtils.smoothstep(ease, 0.85, 1) : 1;
      s.setScalar(Math.max(0.0001, sc));
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, TYPE_COLORS[d.type]);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

    // Lid seals once the private files are in
    const seal = THREE.MathUtils.smoothstep(a, 0.82, 0.98);
    if (lid.current) lid.current.rotation.x = -1.25 * (1 - seal);
    if (seam.current) seam.current.color.set(palette.signalHi).multiplyScalar(0.2 + seal * 2.2);
  });

  return (
    <group rotation={[0.18, -side * 0.22, 0]} scale={1.4} position={[0, 0, 0.6]}>
      <instancedMesh ref={files} args={[geo, mat, FILES]} frustumCulled={false} />

      {/* Public rack: an open wireframe shelf */}
      <group position={[pub * 1.0, 0.15, -0.1]}>
        <lineSegments geometry={edges} material={edgeMat} />
        {[-0.45, -0.09, 0.27].map((y) => (
          <mesh key={y} position={[0, y, 0]} material={hull}>
            <boxGeometry args={[1.0, 0.015, 0.4]} />
          </mesh>
        ))}
        <mesh material={pubMat} position={[0, -0.75, 0.2]}>
          <planeGeometry args={[0.14 * labels.pub.aspect, 0.14]} />
        </mesh>
      </group>

      {/* Private vault */}
      <group position={[priv * 1.0, -0.15, -0.1]}>
        <mesh material={hull}>
          <boxGeometry args={[0.95, 0.6, 0.6]} />
        </mesh>
        <lineSegments geometry={vaultEdges} material={edgeMat} />
        <group ref={lid} position={[0, 0.3, -0.3]}>
          <mesh material={hull} position={[0, 0.02, 0.3]}>
            <boxGeometry args={[0.97, 0.04, 0.62]} />
          </mesh>
        </group>
        <mesh position={[0, 0.3, 0.305]}>
          <boxGeometry args={[0.95, 0.012, 0.01]} />
          <meshBasicMaterial ref={seam} color={palette.signalHi} toneMapped={false} />
        </mesh>
        {/* Keyhole */}
        <mesh position={[0, 0.05, 0.302]}>
          <circleGeometry args={[0.05, 24]} />
          <meshBasicMaterial color={palette.signalHi} toneMapped={false} />
        </mesh>
        <mesh material={privMat} position={[0, -0.45, 0.32]}>
          <planeGeometry args={[0.14 * labels.priv.aspect, 0.14]} />
        </mesh>
      </group>
    </group>
  );
}
