"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MiniSceneProps } from "../types";
import { palette } from "@/lib/palette";
import { canvasTexture, fonts, labelTexture, rng, roundRect } from "../../shared/canvasTexture";

const NOTES = 36;
const LINKS = 16;
const LIFE = 6;

/**
 * WTF — one profile, one shareable link. Anonymous notes stream in from
 * every direction in real time, dock against the profile, then get
 * absorbed (the core pings on each arrival).
 */
export default function FeedbackSwarm({ activityRef, side }: MiniSceneProps) {
  const root = useRef<THREE.Group>(null);
  const notes = useRef<THREE.InstancedMesh>(null);
  const ring = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const flash = useRef(0);

  const { data, bubble, linkLabel } = useMemo(() => {
    const r = rng(99);
    const data = Array.from({ length: NOTES }, (_, i) => {
      const dir = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.8, r() - 0.5).normalize();
      return {
        from: dir.clone().multiplyScalar(3.6 + r() * 1.5),
        dock: new THREE.Vector3((r() - 0.5) * 2, (r() - 0.5) * 1.4, 0).normalize().multiplyScalar(1.05 + r() * 0.35),
        bend: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.4),
        offset: (i / NOTES) * LIFE + r() * 0.4,
        size: 0.8 + r() * 0.4,
      };
    });
    const { mono } = fonts();
    const bubble = canvasTexture(192, 140, (c, w, h) => {
      roundRect(c, 4, 4, w - 8, h - 34, 22);
      c.fillStyle = "#ECEAE3";
      c.fill();
      c.beginPath();
      c.moveTo(w - 56, h - 32);
      c.lineTo(w - 36, h - 6);
      c.lineTo(w - 82, h - 32);
      c.fill();
      c.fillStyle = "#3D5CFF";
      c.font = `700 46px ${mono}`;
      c.fillText("?", 22, 62);
      c.fillStyle = "#96948C";
      c.fillRect(64, 30, 96, 10);
      c.fillRect(64, 52, 70, 10);
      c.fillRect(64, 74, 84, 10);
    });
    return { data, bubble, linkLabel: labelTexture("one profile · one shareable link", { color: "#7D92FF", size: 38 }) };
  }, []);

  const noteGeo = useMemo(() => new THREE.PlaneGeometry(0.42, 0.306), []);
  const noteMat = useMemo(() => new THREE.MeshBasicMaterial({ map: bubble, color: new THREE.Color(0.72, 0.72, 0.72), transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }), [bubble]);
  const linkGeo = useMemo(() => new THREE.TorusGeometry(0.075, 0.016, 8, 20), []);
  const linkMat = useMemo(() => new THREE.MeshStandardMaterial({ color: palette.paper, metalness: 0.8, roughness: 0.25, emissive: palette.signal, emissiveIntensity: 0.25 }), []);
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: palette.signalHi, toneMapped: false }), []);
  const labelMat = useMemo(() => new THREE.MeshBasicMaterial({ map: linkLabel.tex, transparent: true, opacity: 0 }), [linkLabel]);

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      mid2: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      gq: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      c: new THREE.Color(palette.signalHi),
    }),
    []
  );

  useFrame((state, dt) => {
    const a = activityRef.current;
    const inst = notes.current;
    if (!inst || !root.current) return;
    const t = state.clock.elapsedTime;
    const { m, p, mid, mid2, q, gq, s } = tmp;

    // Billboard: notes face the camera regardless of the group's rotation
    root.current.getWorldQuaternion(gq);
    q.copy(gq).invert().multiply(state.camera.quaternion);

    let arrivals = 0;
    data.forEach((n, i) => {
      const life = ((t + n.offset) % LIFE) / LIFE;
      let scale = n.size;
      if (life < 0.45) {
        // Fly in along a bent path (quadratic Bézier)
        const k = life / 0.45;
        const e = 1 - Math.pow(1 - k, 3);
        mid.copy(n.from).lerp(n.dock, 0.5).add(n.bend);
        mid2.copy(mid).lerp(n.dock, e);
        p.copy(n.from).lerp(mid, e).lerp(mid2, e);
        scale *= 0.4 + e * 0.6;
      } else if (life < 0.85) {
        p.copy(n.dock);
        p.y += Math.sin(t * 1.5 + i) * 0.03;
      } else {
        // Absorbed into the profile
        const k = (life - 0.85) / 0.15;
        p.copy(n.dock).multiplyScalar(1 - k * k);
        scale *= 1 - k;
        if (k > 0.9) arrivals++;
      }
      s.setScalar(Math.max(0.0001, scale * (0.25 + a * 0.75)));
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;

    if (arrivals) flash.current = 1;
    flash.current = Math.max(0, flash.current - dt * 2.5);
    if (core.current) core.current.scale.setScalar(0.24 * (1 + flash.current * 0.3));
    coreMat.color.copy(tmp.c).multiplyScalar(0.75 + flash.current * 1.4);

    if (ring.current) ring.current.rotation.z = t * 0.25;
    labelMat.opacity = THREE.MathUtils.smoothstep(a, 0.7, 1) * 0.9;
  });

  return (
    <group ref={root} rotation={[0, -side * 0.2, 0]}>
      <mesh ref={core} material={coreMat}>
        <icosahedronGeometry args={[1, 4]} />
      </mesh>
      {/* The shareable link, as an actual chain */}
      <group ref={ring}>
        {Array.from({ length: LINKS }).map((_, i) => {
          const ang = (i / LINKS) * Math.PI * 2;
          return (
            <mesh key={i} geometry={linkGeo} material={linkMat} position={[Math.cos(ang) * 0.62, Math.sin(ang) * 0.62, 0]} rotation={[0, i % 2 ? Math.PI / 2 : 0, ang + Math.PI / 2]} />
          );
        })}
      </group>
      <instancedMesh ref={notes} args={[noteGeo, noteMat, NOTES]} frustumCulled={false} />
      <mesh material={labelMat} position={[0, -1.75, 0]}>
        <planeGeometry args={[0.16 * linkLabel.aspect, 0.16]} />
      </mesh>
    </group>
  );
}
