"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MiniSceneProps } from "../types";
import { palette } from "@/lib/palette";
import { canvasTexture, fonts, rng, roundRect } from "../../shared/canvasTexture";

const CARDS = 26; // A–Z
const ATLAS_COLS = 7;
const ATLAS_ROWS = 4;
const CARD_W = 1.5;
const CARD_H = 0.95;
const RADIUS = 0.42;
const CYCLE = 6.5;

/**
 * NSUT Students Directory — a rolodex with A–Z index tabs. It spins,
 * decelerates and settles on one record, which slides out toward you.
 */
export default function Rolodex({ activityRef, side }: MiniSceneProps) {
  const drum = useRef<THREE.Group>(null);
  const cards = useRef<THREE.Group[]>([]);
  const state = useRef({ angle: 0, lastCycle: -1, from: 0, to: 0 });

  const textures = useMemo(() => {
    const r = rng(77);
    const { mono } = fonts();
    const cw = 256;
    const ch = 186;
    const atlas = canvasTexture(cw * ATLAS_COLS, ch * ATLAS_ROWS, (c) => {
      for (let i = 0; i < CARDS; i++) {
        const x = (i % ATLAS_COLS) * cw;
        const y = Math.floor(i / ATLAS_COLS) * ch;
        const letter = String.fromCharCode(65 + i);
        // Index tab
        const tabX = x + 20 + (i % 5) * 40;
        roundRect(c, tabX, y + 4, 44, 30, 6);
        c.fillStyle = "#3D5CFF";
        c.fill();
        c.fillStyle = "#ECEAE3";
        c.font = `700 20px ${mono}`;
        c.fillText(letter, tabX + 14, y + 26);
        // Card body
        roundRect(c, x + 6, y + 26, cw - 12, ch - 32, 10);
        c.fillStyle = "#ECEAE3";
        c.fill();
        // Generic record — no real student data
        c.fillStyle = "#1A1C23";
        c.beginPath();
        c.arc(x + 46, y + 78, 22, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#96948C";
        c.beginPath();
        c.arc(x + 46, y + 72, 8, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#1A1C23";
        c.fillRect(x + 80, y + 62, 90 + r() * 50, 14);
        c.fillStyle = "#96948C";
        for (let k = 0; k < 3; k++) c.fillRect(x + 80, y + 92 + k * 16, 70 + r() * 80, 7);
        c.fillStyle = "#5C5B56";
        c.font = `400 12px ${mono}`;
        c.fillText("NSUT · DIRECTORY", x + 22, y + ch - 18);
      }
    });
    return Array.from({ length: CARDS }, (_, i) => {
      const t = atlas.clone();
      t.needsUpdate = true;
      t.repeat.set(1 / ATLAS_COLS, 1 / ATLAS_ROWS);
      t.offset.set((i % ATLAS_COLS) / ATLAS_COLS, 1 - (Math.floor(i / ATLAS_COLS) + 1) / ATLAS_ROWS);
      return t;
    });
  }, []);

  const mats = useMemo(() => textures.map((map) => new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide, toneMapped: false })), [textures]);
  const hull = useMemo(() => new THREE.MeshStandardMaterial({ color: "#24252c", metalness: 0.75, roughness: 0.3 }), []);
  const step = (Math.PI * 2) / CARDS;

  useFrame(({ clock }) => {
    const a = activityRef.current;
    const t = clock.elapsedTime;
    const s = state.current;
    const cycle = Math.floor(t / CYCLE);
    const ct = t % CYCLE;
    if (cycle !== s.lastCycle) {
      s.lastCycle = cycle;
      s.from = s.to;
      // Spin ~1.5 turns, landing exactly on a card
      const pick = (cycle * 11 + 3) % CARDS;
      const turns = Math.PI * 2 * 1.5;
      const base = s.from + turns;
      s.to = base + ((((pick * step - base) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
    }
    // Ease-out spin over 2.4s, then hold
    const k = Math.min(1, ct / 2.4);
    s.angle = s.from + (s.to - s.from) * (1 - Math.pow(1 - k, 4));
    if (drum.current) drum.current.rotation.x = -s.angle;

    // The settled card slides out toward the camera
    const out = THREE.MathUtils.smoothstep(ct, 2.4, 3.0) * (1 - THREE.MathUtils.smoothstep(ct, 5.6, 6.3));
    const settled = Math.round(s.to / step) % CARDS;
    cards.current.forEach((g, i) => {
      if (!g) return;
      const sel = i === ((settled + CARDS) % CARDS) ? out : 0;
      g.position.y = RADIUS + CARD_H / 2 + sel * 0.45;
      g.position.z = sel * 0.15;
      mats[i].color.setScalar(sel > 0 ? 0.62 + sel * 0.3 : 0.4);
    });
    if (drum.current) drum.current.scale.setScalar(0.7 + a * 0.3);
  });

  return (
    <group rotation={[0.1, -side * 0.45, 0]} position={[0, -0.25, 0]} scale={1.25}>
      <group ref={drum}>
        {Array.from({ length: CARDS }).map((_, i) => (
          <group key={i} rotation={[i * step, 0, 0]}>
            <group
              ref={(el) => {
                if (el) cards.current[i] = el;
              }}
            >
              <mesh material={mats[i]}>
                <planeGeometry args={[CARD_W, CARD_H]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
      {/* Axle, side wheels, stand */}
      <mesh material={hull} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, CARD_W + 0.5, 20]} />
      </mesh>
      {[-1, 1].map((d) => (
        <group key={d} position={[d * (CARD_W / 2 + 0.18), 0, 0]}>
          <mesh material={hull} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.36, 0.36, 0.05, 40]} />
          </mesh>
          <mesh material={hull} position={[0, -0.55, 0]}>
            <boxGeometry args={[0.05, 1.1, 0.12]} />
          </mesh>
        </group>
      ))}
      <mesh material={hull} position={[0, -1.12, 0]}>
        <boxGeometry args={[CARD_W + 0.7, 0.06, 0.8]} />
      </mesh>
      <mesh position={[0, -1.085, 0.405]}>
        <boxGeometry args={[CARD_W + 0.7, 0.01, 0.01]} />
        <meshBasicMaterial color={palette.signalHi} toneMapped={false} />
      </mesh>
    </group>
  );
}
