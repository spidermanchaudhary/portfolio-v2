"use client";

import { forwardRef, useMemo } from "react";
import * as THREE from "three";
import { canvasTexture, fonts } from "../../shared/canvasTexture";

/**
 * A two-stage launcher with strap-on boosters, built procedurally:
 * lathed core (boat tail → body → interstage → upper stage → ogive
 * fairing), engine bells, swept fins, booster struts, RCS pods.
 * Origin = bottom of the core engine bell. Total height ≈ 3.4 units.
 */

const v2 = (x: number, y: number) => new THREE.Vector2(x, y);

// Core profile (radius, height), bottom → top
const CORE_PROFILE = [
  v2(0.0, 0.3),
  v2(0.17, 0.3),
  v2(0.235, 0.44),
  v2(0.24, 0.5),
  v2(0.24, 2.08),
  v2(0.246, 2.1),
  v2(0.246, 2.22),
  v2(0.226, 2.26),
  v2(0.226, 2.74),
  v2(0.238, 2.78),
  v2(0.232, 2.92),
  v2(0.2, 3.08),
  v2(0.145, 3.2),
  v2(0.08, 3.3),
  v2(0.0, 3.38),
];

const BOOSTER_PROFILE = [
  v2(0.0, 0.22),
  v2(0.11, 0.22),
  v2(0.13, 0.32),
  v2(0.13, 1.78),
  v2(0.115, 1.92),
  v2(0.07, 2.04),
  v2(0.0, 2.1),
];

const BELL_PROFILE = [v2(0.06, 0.32), v2(0.075, 0.26), v2(0.1, 0.18), v2(0.14, 0.08), v2(0.165, 0.0)];

export interface RocketHandles {
  boosters: THREE.Group[];
}

function bodyTexture(rows: number, label: boolean) {
  const { mono } = fonts();
  return canvasTexture(512, 1024, (c, w, h) => {
    c.fillStyle = "#E6E4DC";
    c.fillRect(0, 0, w, h);
    // Panel seams + stringers
    c.strokeStyle = "rgba(26,28,35,0.22)";
    c.lineWidth = 2;
    for (let i = 1; i < rows; i++) {
      const y = (i / rows) * h;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    c.strokeStyle = "rgba(26,28,35,0.08)";
    for (let x = 0; x < w; x += 32) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
    }
    // Roll pattern: alternating black quadrants (Saturn-style)
    c.fillStyle = "#16171c";
    const band = (y0: number, y1: number, offset: number) => {
      for (let q = 0; q < 4; q++) if ((q + offset) % 2 === 0) c.fillRect((q * w) / 4, y0 * h, w / 4, (y1 - y0) * h);
    };
    band(0.1, 0.17, 0);
    band(0.72, 0.78, 1);
    // Signal stripe
    c.fillStyle = "#3D5CFF";
    c.fillRect(0, h * 0.84, w, h * 0.012);
    if (label) {
      c.save();
      c.translate(w * 0.38, h * 0.26);
      c.rotate(Math.PI / 2);
      c.fillStyle = "#16171c";
      c.font = `600 54px ${mono}`;
      c.fillText("SUJAL", 0, 0);
      c.font = `400 22px ${mono}`;
      c.fillText("SC·01", 0, 40);
      c.restore();
    }
  });
}

const Rocket = forwardRef<THREE.Group, { boosterRefs: React.MutableRefObject<THREE.Group[]> }>(function Rocket({ boosterRefs }, ref) {
  const parts = useMemo(() => {
    const coreTex = bodyTexture(14, true);
    coreTex.wrapS = THREE.RepeatWrapping;
    const boosterTex = bodyTexture(10, false);
    const metal = new THREE.MeshStandardMaterial({ color: "#3a3b42", metalness: 0.9, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: "#1b1c22", metalness: 0.4, roughness: 0.6 });
    const skin = new THREE.MeshStandardMaterial({ map: coreTex, metalness: 0.15, roughness: 0.55, color: new THREE.Color(0.86, 0.86, 0.86) });
    const boosterSkin = new THREE.MeshStandardMaterial({ map: boosterTex, metalness: 0.15, roughness: 0.6, color: new THREE.Color(0.8, 0.8, 0.8) });

    const core = new THREE.LatheGeometry(CORE_PROFILE, 64);
    const booster = new THREE.LatheGeometry(BOOSTER_PROFILE, 40);
    const bell = new THREE.LatheGeometry(BELL_PROFILE, 40);
    const interstage = new THREE.CylinderGeometry(0.248, 0.248, 0.12, 64, 1, true);

    // Swept fin
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.26, -0.1);
    finShape.lineTo(0.3, 0.06);
    finShape.lineTo(0, 0.42);
    finShape.closePath();
    const fin = new THREE.ExtrudeGeometry(finShape, { depth: 0.018, bevelEnabled: false });
    fin.translate(0, 0, -0.009);

    return { metal, dark, skin, boosterSkin, core, booster, bell, interstage, fin };
  }, []);

  const { metal, dark, skin, boosterSkin, core, booster, bell, interstage, fin } = parts;

  return (
    <group ref={ref}>
      {/* Core stage */}
      <mesh geometry={core} material={skin} />
      <mesh geometry={interstage} material={dark} position={[0, 2.16, 0]} />
      <mesh geometry={bell} material={metal} />
      {/* Fins */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 2 + Math.PI / 4, 0]}>
          <mesh geometry={fin} material={dark} position={[0.22, 0.42, 0]} />
        </group>
      ))}
      {/* RCS pods near the top of the upper stage */}
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
          <mesh material={dark} position={[0.235, 2.62, 0]}>
            <boxGeometry args={[0.04, 0.07, 0.05]} />
          </mesh>
        </group>
      ))}
      {/* Antenna */}
      <mesh material={metal} position={[0.12, 3.05, 0.17]} rotation={[0.3, 0, -0.2]}>
        <cylinderGeometry args={[0.005, 0.005, 0.16, 6]} />
      </mesh>
      {/* Strap-on boosters (separate during flight) */}
      {[-1, 1].map((d, i) => (
        <group
          key={d}
          ref={(el) => {
            if (el) boosterRefs.current[i] = el;
          }}
          position={[d * 0.37, 0.12, 0]}
        >
          <mesh geometry={booster} material={boosterSkin} position={[0, -0.12, 0]} />
          <mesh geometry={bell} material={metal} position={[0, -0.12, 0]} scale={0.72} />
          {/* Struts */}
          {[0.35, 1.55].map((y) => (
            <mesh key={y} material={dark} position={[-d * 0.07, y, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.012, 0.012, 0.16, 6]} />
            </mesh>
          ))}
          {/* Booster fins */}
          <group rotation={[0, d > 0 ? 0 : Math.PI, 0]}>
            <mesh geometry={fin} material={dark} position={[0.1, 0.08, 0]} scale={0.6} />
          </group>
        </group>
      ))}
    </group>
  );
});

export default Rocket;
