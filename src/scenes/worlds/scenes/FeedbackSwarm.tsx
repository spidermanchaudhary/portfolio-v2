"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MiniSceneProps } from "../types";
import { canvasTexture, fonts, rng, roundRect } from "../../shared/canvasTexture";

const NOTES = 24;
const EVERY = 0.85; // seconds between arrivals
const FLY = 1.3; // seconds in flight
const CARD_W = 1.9;
const CARD_H = 2.7;
const SLOT_H = 0.34;
const VISIBLE_SLOTS = 5;
const FEED_TOP = CARD_H / 2 - 0.95;

/**
 * WTF — a profile card with one shareable link. Anonymous notes fly in
 * from every direction in real time, land at the top of the inbox and
 * push older ones down the feed.
 */
export default function FeedbackSwarm({ activityRef, side }: MiniSceneProps) {
  const notes = useRef<THREE.InstancedMesh>(null);
  const pill = useRef<THREE.MeshBasicMaterial>(null);
  const flash = useRef(0);
  const lastArrival = useRef(-1);

  const { data, card, bubble, pillTex } = useMemo(() => {
    const r = rng(99);
    const data = Array.from({ length: NOTES }, () => {
      const dir = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.9, r() * 0.6 - 0.1).normalize();
      return {
        from: dir.multiplyScalar(3.4 + r() * 1.4),
        spin: new THREE.Euler((r() - 0.5) * 3, (r() - 0.5) * 3, (r() - 0.5) * 2),
        bend: new THREE.Vector3(r() - 0.5, r() - 0.5, 0.4 + r() * 0.5).multiplyScalar(1.2),
      };
    });
    const { mono, display } = fonts();
    const card = canvasTexture(380, 540, (c, w, h) => {
      roundRect(c, 3, 3, w - 6, h - 6, 26);
      c.fillStyle = "#141519";
      c.fill();
      c.strokeStyle = "rgba(236,234,227,0.35)";
      c.lineWidth = 2;
      c.stroke();
      // Avatar + name
      c.fillStyle = "#2E2E32";
      c.beginPath();
      c.arc(56, 62, 30, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#96948C";
      c.beginPath();
      c.arc(56, 54, 11, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(56, 84, 19, Math.PI, 0);
      c.fill();
      c.fillStyle = "#ECEAE3";
      c.font = `700 26px ${display}`;
      c.fillText("your profile", 100, 58);
      c.fillStyle = "#5C5B56";
      c.font = `400 14px ${mono}`;
      c.fillText("ANONYMOUS INBOX", 100, 82);
      // Feed rules
      c.strokeStyle = "rgba(236,234,227,0.08)";
      for (let y = 190; y < h - 20; y += 34) {
        c.beginPath();
        c.moveTo(22, y);
        c.lineTo(w - 22, y);
        c.stroke();
      }
    });
    const bubble = canvasTexture(320, 76, (c, w, h) => {
      roundRect(c, 2, 2, w - 4, h - 4, 18);
      c.fillStyle = "#ECEAE3";
      c.fill();
      c.fillStyle = "#3D5CFF";
      c.font = `700 36px ${mono}`;
      c.fillText("?", 18, 51);
      c.fillStyle = "#96948C";
      c.fillRect(56, 24, 200, 9);
      c.fillRect(56, 43, 140, 9);
    });
    const pillTex = canvasTexture(300, 56, (c, w, h) => {
      roundRect(c, 2, 2, w - 4, h - 4, 26);
      c.fillStyle = "#3D5CFF";
      c.fill();
      c.strokeStyle = "#ECEAE3";
      c.lineWidth = 4;
      // Chain-link glyph
      roundRect(c, 20, 18, 26, 18, 9);
      c.stroke();
      roundRect(c, 36, 18, 26, 18, 9);
      c.stroke();
      c.fillStyle = "#ECEAE3";
      c.font = `500 20px ${mono}`;
      c.fillText("SHARE LINK", 80, 36);
    });
    return { data, card, bubble, pillTex };
  }, []);

  const cardMat = useMemo(() => new THREE.MeshBasicMaterial({ map: card, transparent: true }), [card]);
  const noteGeo = useMemo(() => new THREE.PlaneGeometry(CARD_W - 0.3, (CARD_W - 0.3) * (76 / 320)), []);
  const noteMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: bubble, color: new THREE.Color(0.62, 0.62, 0.62), transparent: true, toneMapped: false, side: THREE.DoubleSide }),
    [bubble]
  );

  const tmp = useMemo(
    () => ({
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      mid: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      q0: new THREE.Quaternion(),
      id: new THREE.Quaternion(),
      s: new THREE.Vector3(),
    }),
    []
  );

  useFrame((state, dt) => {
    const inst = notes.current;
    if (!inst) return;
    const act = activityRef.current;
    const t = state.clock.elapsedTime;
    const { m, p, a, b, mid, q, q0, id, s } = tmp;
    const cycle = NOTES * EVERY;

    data.forEach((n, i) => {
      // Seconds since this note last landed (0..cycle); the final FLY
      // seconds of each cycle are its next flight in.
      const since = (((t - i * EVERY) % cycle) + cycle) % cycle;
      let scale = 1;
      if (since > cycle - FLY) {
        const k = (since - (cycle - FLY)) / FLY;
        const e = 1 - Math.pow(1 - k, 3);
        a.copy(n.from);
        b.set(0, FEED_TOP, 0.03);
        mid.copy(a).lerp(b, 0.5).add(n.bend);
        p.copy(a).lerp(mid, e).lerp(mid.lerp(b, e), e);
        q0.setFromEuler(n.spin);
        q.copy(q0).slerp(id, e);
        scale = 0.5 + e * 0.5;
      } else {
        // Docked: slides down one slot per new arrival
        const slots = since / EVERY;
        const step = Math.floor(slots);
        const eased = step + Math.sqrt(Math.min(1, (slots - step) / 0.25));
        p.set(0, FEED_TOP - eased * SLOT_H, 0.03);
        q.copy(id);
        scale = eased > VISIBLE_SLOTS ? Math.max(0, 1 - (eased - VISIBLE_SLOTS)) : 1;
      }
      s.setScalar(Math.max(0.0001, scale * (0.3 + act * 0.7)));
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;

    // The link pill pings on every arrival
    const newest = Math.floor(t / EVERY);
    if (newest !== lastArrival.current) {
      lastArrival.current = newest;
      flash.current = 1;
    }
    flash.current = Math.max(0, flash.current - dt * 2.5);
    if (pill.current) pill.current.color.setScalar(1 + flash.current * 1.2);
  });

  return (
    <group rotation={[0, -side * 0.22, 0]} scale={1.05}>
      <mesh material={cardMat}>
        <planeGeometry args={[CARD_W, CARD_H]} />
      </mesh>
      <mesh position={[0, CARD_H / 2 - 0.62, 0.02]}>
        <planeGeometry args={[1.25, 1.25 * (56 / 300)]} />
        <meshBasicMaterial ref={pill} map={pillTex} transparent toneMapped={false} />
      </mesh>
      <instancedMesh ref={notes} args={[noteGeo, noteMat, NOTES]} frustumCulled={false} />
    </group>
  );
}
