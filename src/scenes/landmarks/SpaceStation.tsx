"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Station } from "../track";
import { canvasTexture } from "../shared/canvasTexture";
import { activity, damp, isNear } from "../shared/activity";

/**
 * Signals — an orbital station receiving the transmissions.
 *
 * Built from primitives in the station's own frame: X runs along the
 * truss, Z along the pressurised modules, Y is zenith. Everything that
 * shares a material is merged, so the whole station is ~10 draw calls
 * and costs next to nothing on phones. The solar wings turn slowly on
 * their joints to track the sun; nav lights blink.
 */

const TRUSS = 5; // half-length
const BAY = 0.32;

/** Box between two points, `t` thick */
function strut(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(t, len, t);
  const m = new THREE.Matrix4().compose(
    a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()),
    new THREE.Vector3(1, 1, 1)
  );
  return g.applyMatrix4(m);
}

/** Cylinder along Z from z0 to z1 */
function tube(r: number, z0: number, z1: number, x = 0, y = 0, seg = 20) {
  const g = new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), seg, 1);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, (z0 + z1) / 2);
  return g;
}

/** Cylinder along X from x0 to x1 */
function tubeX(r: number, x0: number, x1: number, y = 0, z = 0, seg = 20) {
  const g = new THREE.CylinderGeometry(r, r, Math.abs(x1 - x0), seg, 1);
  g.rotateZ(Math.PI / 2);
  g.translate((x0 + x1) / 2, y, z);
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}

function buildTruss() {
  const parts: THREE.BufferGeometry[] = [];
  const s = 0.16;
  const corners = [
    [-s, -s],
    [s, -s],
    [s, s],
    [-s, s],
  ];
  // Longerons
  for (const [y, z] of corners) parts.push(strut(new THREE.Vector3(-TRUSS, y, z), new THREE.Vector3(TRUSS, y, z), 0.028));
  // Bays: a square frame and one diagonal per face
  const bays = Math.round((TRUSS * 2) / BAY);
  for (let i = 0; i <= bays; i++) {
    const x = -TRUSS + i * BAY;
    for (let k = 0; k < 4; k++) {
      const [y0, z0] = corners[k];
      const [y1, z1] = corners[(k + 1) % 4];
      parts.push(strut(new THREE.Vector3(x, y0, z0), new THREE.Vector3(x, y1, z1), 0.018));
      if (i < bays) {
        const flip = i % 2 === 0;
        parts.push(strut(new THREE.Vector3(x, flip ? y0 : y1, flip ? z0 : z1), new THREE.Vector3(x + BAY, flip ? y1 : y0, flip ? z1 : z0), 0.012));
      }
    }
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
}

/** One wing: two blankets either side of a mast, rooted at the origin, extending +Y */
function wingPanels(len: number) {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const g = new THREE.PlaneGeometry(0.5, len);
    g.translate(side * 0.31, len / 2 + 0.18, 0);
    parts.push(g);
  }
  return mergeGeometries(parts)!;
}

function wingFrame(len: number) {
  return mergeGeometries([
    new THREE.CylinderGeometry(0.016, 0.016, len, 6).translate(0, len / 2 + 0.18, 0).toNonIndexed(),
    box(1.18, 0.07, 0.07, 0, 0.14, 0).toNonIndexed(), // blanket box
    box(1.18, 0.05, 0.05, 0, len + 0.2, 0).toNonIndexed(), // tip bar
  ])!;
}

function buildModules() {
  const y = -0.52;
  const parts: THREE.BufferGeometry[] = [
    tube(0.25, -0.32, 0.32, 0, y), // central node
    tube(0.23, 0.32, 1.65, 0, y), // lab
    tube(0.25, 1.65, 2.2, 0, y), // forward node
    tube(0.13, 2.2, 2.45, 0, y), // docking adapter
    tubeX(0.21, 0.25, 1.25, y, 1.92), // side lab (starboard)
    tubeX(0.23, -1.45, -0.25, y, 1.92), // side lab (port), the long one
    box(0.75, 0.08, 0.6, -1.0, y, 2.55), // exposed platform
    tube(0.24, -0.95, -0.32, 0, y), // aft node
    tube(0.21, -2.2, -0.95, 0, y), // cargo block
    tube(0.21, -3.0, -2.2, 0, y), // service module, wide
    tube(0.15, -3.45, -3.0, 0, y), // service module, narrow
    tube(0.1, -3.62, -3.45, 0, y), // aft port
    box(0.12, 0.35, 0.12, 0, -0.16, 0), // truss mount
  ];
  // Airlock pointing out to starboard
  parts.push(tubeX(0.16, 0.25, 0.75, y, -0.6));
  // Observation dome under the aft node
  const dome = new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI).translate(0, y - 0.24, -0.62);
  parts.push(dome);
  return mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
}

/** Docked capsules: one at the forward port, one under the cargo block */
function buildVehicles() {
  const y = -0.52;
  const capA = new THREE.CylinderGeometry(0.12, 0.2, 0.42, 20).rotateX(-Math.PI / 2).translate(0, y, 2.66);
  const trunkA = tube(0.2, 2.87, 3.2, 0, y);
  const capB = new THREE.SphereGeometry(0.11, 16, 12).translate(0, y - 0.38, -1.6);
  const bodyB = new THREE.CylinderGeometry(0.11, 0.11, 0.38, 16).translate(0, y - 0.66, -1.6);
  return mergeGeometries([capA, trunkA, capB, bodyB].map((p) => p.toNonIndexed()))!;
}

function buildRadiators() {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-1.8, 1.8]) {
    for (let i = 0; i < 3; i++) {
      // Accordion of panels hanging toward nadir, slightly fanned
      const g = box(0.62, 0.42, 0.012, 0, 0, 0);
      g.rotateX(0.18 * (i % 2 === 0 ? 1 : -1));
      g.translate(x, -0.42 - i * 0.44, 0.35);
      parts.push(g);
    }
    parts.push(box(0.05, 1.4, 0.05, x, -0.85, 0.35));
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
}

function buildJoints() {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-3.05, 3.05]) parts.push(tubeX(0.26, x - 0.13, x + 0.13, 0, 0, 24));
  for (const x of [-4.4, -3.6, 3.6, 4.4]) parts.push(tubeX(0.12, x - 0.06, x + 0.06, 0, 0, 12));
  return mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
}

function serviceWings() {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const g = new THREE.PlaneGeometry(1.0, 0.36);
    g.rotateX(-Math.PI / 2);
    g.translate(side * 0.75, -0.52, -2.6);
    parts.push(g);
  }
  return mergeGeometries(parts)!;
}

function panelTexture() {
  return canvasTexture(256, 1024, (ctx, w, h) => {
    ctx.fillStyle = "#0a0d18";
    ctx.fillRect(0, 0, w, h);
    const cols = 4;
    const rows = 40;
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = 0.85 + Math.random() * 0.3;
        const g = ctx.createLinearGradient(0, r * ch, 0, (r + 1) * ch);
        g.addColorStop(0, `rgb(${30 * v},${36 * v},${70 * v})`);
        g.addColorStop(1, `rgb(${52 * v},${44 * v},${58 * v})`);
        ctx.fillStyle = g;
        ctx.fillRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4);
      }
    }
    // Bus bars and section breaks
    ctx.fillStyle = "rgba(170,130,70,0.75)";
    for (let c = 0; c <= cols; c++) ctx.fillRect(c * cw - 1, 0, 2, h);
    for (let r = 0; r <= rows; r += 10) ctx.fillRect(0, r * ch - 3, w, 6);
  });
}

function mliTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#c9c6bd";
    ctx.fillRect(0, 0, w, h);
    // Quilted blanket panels with slight tonal variation
    const n = 8;
    const s = w / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = 180 + Math.floor(Math.random() * 40);
        ctx.fillStyle = `rgb(${v},${v - 3},${v - 10})`;
        ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
      }
    ctx.strokeStyle = "rgba(90,88,80,0.6)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * s);
      ctx.lineTo(w, i * s);
      ctx.stroke();
    }
    // Handrails
    ctx.fillStyle = "#c8a24a";
    for (let i = 0; i < 6; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 22, 3);
  });
}

const WING_LEN = 3.4;
/** Wing roots along the truss: two arrays per side, each with an up and a down wing */
const ARRAYS = [-4.7, -3.4, 3.4, 4.7];

export default function SpaceStation({ station, trackIndex }: { station: Station; trackIndex: number }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const port = useRef<THREE.Group>(null);
  const star = useRef<THREE.Group>(null);
  const lights = useRef<THREE.Mesh[]>([]);
  const act = useRef(0);

  const assets = useMemo(() => {
    const panelTex = panelTexture();
    const mliTex = mliTexture();
    mliTex.wrapS = mliTex.wrapT = THREE.RepeatWrapping;
    mliTex.repeat.set(3, 2);
    return {
      truss: buildTruss(),
      modules: buildModules(),
      vehicles: buildVehicles(),
      radiators: buildRadiators(),
      joints: buildJoints(),
      wing: wingPanels(WING_LEN),
      wingFrame: wingFrame(WING_LEN),
      svcWings: serviceWings(),
      trussMat: new THREE.MeshStandardMaterial({ color: "#8d8a83", metalness: 0.6, roughness: 0.45 }),
      jointMat: new THREE.MeshStandardMaterial({ color: "#3a3936", metalness: 0.7, roughness: 0.4 }),
      moduleMat: new THREE.MeshStandardMaterial({ color: "#d8d4ca", map: mliTex, metalness: 0.05, roughness: 0.7 }),
      vehicleMat: new THREE.MeshStandardMaterial({ color: "#e9e6de", metalness: 0.15, roughness: 0.5 }),
      radiatorMat: new THREE.MeshStandardMaterial({ color: "#d9d9d4", metalness: 0.1, roughness: 0.35 }),
      panelMat: new THREE.MeshStandardMaterial({
        map: panelTex,
        metalness: 0.35,
        roughness: 0.32,
        side: THREE.DoubleSide,
        emissive: new THREE.Color("#0b1640"),
        emissiveIntensity: 0.6,
      }),
      frameMat: new THREE.MeshStandardMaterial({ color: "#b49a6a", metalness: 0.5, roughness: 0.5 }),
      red: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff4a3d").multiplyScalar(3), toneMapped: false }),
      green: new THREE.MeshBasicMaterial({ color: new THREE.Color("#47ff8a").multiplyScalar(3), toneMapped: false }),
      white: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff").multiplyScalar(3), toneMapped: false }),
      bulb: new THREE.SphereGeometry(0.045, 8, 6),
    };
  }, []);

  useEffect(
    () => () => {
      for (const v of Object.values(assets)) {
        if (v instanceof THREE.Material) {
          (v as THREE.MeshStandardMaterial).map?.dispose();
          v.dispose();
        } else if (v instanceof THREE.BufferGeometry) v.dispose();
      }
    },
    [assets]
  );

  useFrame((state, dt) => {
    const near = isNear(trackIndex, 2);
    if (group.current) group.current.visible = near;
    if (!near) return;
    act.current = damp(act.current, activity(trackIndex, 1.2), 3, dt);
    const t = state.clock.elapsedTime;
    // Wide screens: up and right of the heading, clear of the review cards.
    // Phones: centred in the gap below the cards.
    const wide = state.size.width / state.size.height >= 1.1;
    if (group.current) {
      group.current.position.set(station.anchor.x + (wide ? 2.2 : 0), station.anchor.y + (wide ? 2.45 : -3.7), station.anchor.z);
      group.current.scale.setScalar(wide ? 0.55 : 0.42);
    }
    if (body.current) {
      // A slow, steady drift — it's in orbit, not spinning
      body.current.rotation.y = -0.55 + Math.sin(t * 0.05) * 0.18 + (1 - act.current) * 0.25;
      body.current.rotation.x = 0.32 + Math.sin(t * 0.07) * 0.04;
      body.current.position.y = Math.sin(t * 0.3) * 0.05;
    }
    // Solar wings track the sun on their joints
    const alpha = 0.5 + Math.sin(t * 0.04) * 0.35;
    if (port.current) port.current.rotation.x = alpha;
    if (star.current) star.current.rotation.x = alpha;
    // Nav lights: red/green steady blink, white strobe double-flash
    const [r, g, w] = lights.current;
    const phase = t % 2;
    if (r) r.visible = phase < 1;
    if (g) g.visible = phase < 1;
    if (w) w.visible = phase > 1.2 && (phase < 1.28 || (phase > 1.4 && phase < 1.48));
  });

  const wings = (xs: number[]) =>
    xs.map((x) =>
      [0, Math.PI].map((rot) => (
        // Each array feathered on its own gimbal so neighbours don't overlap
        <group key={`${x}-${rot}`} position={[x, 0, 0]} rotation={[rot, Math.abs(x) > 4 ? 0.35 : -0.25, 0]}>
          <mesh geometry={assets.wing} material={assets.panelMat} />
          <mesh geometry={assets.wingFrame} material={assets.frameMat} />
        </group>
      ))
    );

  return (
    <group ref={group} position={station.anchor}>
      <group ref={body} scale={0.72}>
        <mesh geometry={assets.truss} material={assets.trussMat} />
        <mesh geometry={assets.joints} material={assets.jointMat} />
        <mesh geometry={assets.modules} material={assets.moduleMat} />
        <mesh geometry={assets.vehicles} material={assets.vehicleMat} />
        <mesh geometry={assets.radiators} material={assets.radiatorMat} />
        <mesh geometry={assets.svcWings} material={assets.panelMat} />
        <group ref={port}>{wings(ARRAYS.filter((x) => x < 0))}</group>
        <group ref={star}>{wings(ARRAYS.filter((x) => x > 0))}</group>
        <mesh ref={(m) => void (m && (lights.current[0] = m))} geometry={assets.bulb} material={assets.red} position={[-TRUSS - 0.05, 0.18, 0]} />
        <mesh ref={(m) => void (m && (lights.current[1] = m))} geometry={assets.bulb} material={assets.green} position={[TRUSS + 0.05, 0.18, 0]} />
        <mesh ref={(m) => void (m && (lights.current[2] = m))} geometry={assets.bulb} material={assets.white} position={[0, -0.52, 3.24]} />
      </group>
    </group>
  );
}
