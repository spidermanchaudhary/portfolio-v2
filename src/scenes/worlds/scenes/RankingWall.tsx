"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MiniSceneProps } from "../types";
import { palette } from "@/lib/palette";
import { canvasTexture, labelTexture, rng } from "../../shared/canvasTexture";

const COLS = 8;
const ROWS = 7;
const N = COLS * ROWS;
const CW = 0.36;
const CH = 0.22;
const GX = 0.42;
const GY = 0.28;

/**
 * JEE College Predictor — a drifting wall of college cards. As the camera
 * arrives they sort into ranked columns, best match first, and #1 lifts
 * out of the wall.
 */
export default function RankingWall({ activityRef, side }: MiniSceneProps) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const label = useRef<THREE.Mesh>(null);

  const { cards, face, tag, title } = useMemo(() => {
    const r = rng(42);
    const cards = Array.from({ length: N }, (_, i) => {
      const rank = i; // instance i ends at rank i
      const col = rank % COLS;
      const row = Math.floor(rank / COLS);
      return {
        rank,
        scatter: new THREE.Vector3((r() - 0.5) * 6, (r() - 0.5) * 3.6, (r() - 0.5) * 2.6),
        scatterRot: new THREE.Euler((r() - 0.5) * 1.6, (r() - 0.5) * 2.4, (r() - 0.5) * 1.2),
        grid: new THREE.Vector3((col - (COLS - 1) / 2) * GX, ((ROWS - 1) / 2 - row) * GY, 0),
        drift: r() * Math.PI * 2,
      };
    });
    // Shuffle so the scattered wall isn't secretly ordered
    const face = canvasTexture(256, 156, (c, w, h) => {
      c.fillStyle = "#ECEAE3";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#1A1C23";
      c.fillRect(14, 16, w * 0.55, 16);
      c.fillStyle = "#96948C";
      c.fillRect(14, 46, w * 0.38, 9);
      c.fillRect(14, 64, w * 0.3, 9);
      c.fillStyle = "#3D5CFF";
      c.fillRect(14, h - 34, w * 0.72, 14);
      c.strokeStyle = "#1A1C23";
      c.lineWidth = 3;
      c.strokeRect(1.5, 1.5, w - 3, h - 3);
      c.fillStyle = "#1A1C23";
      c.beginPath();
      c.arc(w - 40, 40, 20, 0, Math.PI * 2);
      c.fill();
    });
    return {
      cards,
      face,
      tag: labelTexture("#1 · best match", { color: "#7D92FF", size: 40 }),
      title: labelTexture("your rank → colleges, sorted", { color: "#96948C", size: 36 }),
    };
  }, []);

  const geo = useMemo(() => new THREE.BoxGeometry(CW, CH, 0.012), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: face, toneMapped: false }), [face]);
  const tagMat = useMemo(() => new THREE.MeshBasicMaterial({ map: tag.tex, transparent: true, opacity: 0, toneMapped: false }), [tag]);
  const titleMat = useMemo(() => new THREE.MeshBasicMaterial({ map: title.tex, transparent: true, opacity: 0 }), [title]);

  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), qa: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(), c: new THREE.Color() }),
    []
  );
  const colors = useMemo(() => {
    const top = new THREE.Color(palette.signalHi).multiplyScalar(1.6);
    return cards.map((card) => {
      if (card.rank === 0) return top;
      // Dimmer as rank falls — the wall reads as a gradient of fit
      const k = 0.62 - (card.rank / N) * 0.4;
      return new THREE.Color(k, k, k * 0.97);
    });
  }, [cards]);

  const identity = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state) => {
    const inst = mesh.current;
    const a = activityRef.current;
    if (!inst) return; // 56 instances — cheap enough to always lay out
    const t = state.clock.elapsedTime;
    const { m, p, q, qa, e, s } = tmp;

    cards.forEach((card, i) => {
      // Staggered sort: best ranks settle first
      const k = THREE.MathUtils.clamp(a * 1.7 - (card.rank / N) * 0.7, 0, 1);
      const ease = k * k * (3 - 2 * k);
      p.copy(card.scatter).lerp(card.grid, ease);
      p.y += Math.sin(t * 0.7 + card.drift) * 0.08 * (1 - ease);
      e.set(card.scatterRot.x + Math.sin(t * 0.3 + card.drift) * 0.2, card.scatterRot.y + t * 0.1, card.scatterRot.z);
      qa.setFromEuler(e);
      q.copy(qa).slerp(identity, ease);
      let sc = 0.85 + ease * 0.15;
      if (card.rank === 0) {
        const lift = THREE.MathUtils.smoothstep(a, 0.75, 1);
        p.z += lift * 0.9;
        p.y += lift * 0.12;
        sc *= 1 + lift * 0.55;
      }
      s.setScalar(sc);
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
      inst.setColorAt(i, colors[i]);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

    const show = THREE.MathUtils.smoothstep(a, 0.8, 1);
    tagMat.opacity = show;
    titleMat.opacity = show * 0.9;
    if (label.current) label.current.position.y = (ROWS - 1) / 2 * GY + 0.32 + Math.sin(t * 2) * 0.02;
  });

  const topLeft = cards[0].grid;
  return (
    <group rotation={[0, side * -0.28, 0]}>
      <instancedMesh ref={mesh} args={[geo, mat, N]} frustumCulled={false} />
      <mesh ref={label} material={tagMat} position={[topLeft.x + 0.55, topLeft.y + 0.32, 0.9]}>
        <planeGeometry args={[0.2 * tag.aspect, 0.2]} />
      </mesh>
      <mesh material={titleMat} position={[0, -((ROWS - 1) / 2) * GY - 0.38, 0]}>
        <planeGeometry args={[0.17 * title.aspect, 0.17]} />
      </mesh>
    </group>
  );
}
