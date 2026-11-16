"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MiniSceneProps } from "../types";
import { palette } from "@/lib/palette";
import { canvasTexture, fonts, labelTexture, rng, roundRect } from "../../shared/canvasTexture";

const ROWS = 12;
const SHEET_W = 2.3;
const SHEET_H = 3.0;
const CYCLE = 6.5;

const sheetVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const sheetFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uBeam;     // 0..1 from top, <0 = idle
uniform float uOpacity;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  vec3 tex = texture2D(uMap, vUv).rgb;
  float y = 1.0 - vUv.y;
  float glow = uBeam >= 0.0 ? smoothstep(0.09, 0.0, abs(y - uBeam)) : 0.0;
  float read = uBeam >= 0.0 ? step(y, uBeam) : 0.0;
  vec3 col = tex * (0.34 + glow * 0.7);
  col = mix(col, col * uTint * 1.6, read * 0.22);
  gl_FragColor = vec4(col, uOpacity);
}`;

/**
 * Hajiri — "hi" → Tesseract reads the CAPTCHA → the attendance sheet is
 * scanned and ticks light up row by row. Loops every CYCLE seconds.
 */
export default function OcrScan({ activityRef, side }: MiniSceneProps) {
  const root = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Group>(null);
  const ticks = useRef<THREE.Mesh[]>([]);
  const bubble = useRef<THREE.Mesh>(null);
  const decoded = useRef<THREE.Mesh>(null);

  const tex = useMemo(() => {
    const { mono } = fonts();
    const r = rng(7);
    const sheet = canvasTexture(512, 668, (c, w, h) => {
      c.fillStyle = "#ECEAE3";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#1A1C23";
      c.font = `600 22px ${mono}`;
      c.fillText("ATTENDANCE", 28, 44);
      c.font = `400 13px ${mono}`;
      c.fillStyle = "#5C5B56";
      c.fillText("ROLL", 28, 82);
      c.fillText("COURSE", 150, 82);
      c.fillText("%", 380, 82);
      c.strokeStyle = "#1A1C23";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(24, 94);
      c.lineTo(w - 24, 94);
      c.stroke();
      const rowH = (h - 120) / ROWS;
      for (let i = 0; i < ROWS; i++) {
        const y = 110 + i * rowH;
        c.fillStyle = "#2E2E32";
        c.font = `400 15px ${mono}`;
        c.fillText(String(Math.floor(1000 + r() * 8999)), 28, y + rowH * 0.6);
        c.fillStyle = "#96948C";
        c.fillRect(150, y + rowH * 0.35, 90 + r() * 120, 8);
        c.fillStyle = "#2E2E32";
        c.fillText(`${Math.floor(62 + r() * 37)}`, 372, y + rowH * 0.6);
        c.strokeStyle = "rgba(26,28,35,0.18)";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(24, y + rowH);
        c.lineTo(w - 24, y + rowH);
        c.stroke();
        c.strokeStyle = "rgba(26,28,35,0.35)";
        c.strokeRect(w - 64, y + rowH * 0.2, rowH * 0.6, rowH * 0.6);
      }
      // Notebook red margin rule — a nod to the previous identity
      c.strokeStyle = "rgba(220,70,60,0.45)";
      c.beginPath();
      c.moveTo(18, 0);
      c.lineTo(18, h);
      c.stroke();
    });

    const captcha = canvasTexture(320, 90, (c, w, h) => {
      c.fillStyle = "#121215";
      c.fillRect(0, 0, w, h);
      const chars = "7XK2P";
      for (let i = 0; i < chars.length; i++) {
        c.save();
        c.translate(40 + i * 56, h / 2 + 6);
        c.rotate((r() - 0.5) * 0.7);
        c.font = `700 ${46 + r() * 10}px ${mono}`;
        c.fillStyle = "#ECEAE3";
        c.fillText(chars[i], -14, 14);
        c.restore();
      }
      c.strokeStyle = "rgba(125,146,255,0.8)";
      c.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        c.moveTo(0, r() * h);
        c.bezierCurveTo(w * 0.3, r() * h, w * 0.6, r() * h, w, r() * h);
        c.stroke();
      }
    });

    const tick = canvasTexture(64, 64, (c) => {
      c.strokeStyle = "#ffffff";
      c.lineWidth = 9;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      c.moveTo(12, 34);
      c.lineTo(27, 49);
      c.lineTo(53, 15);
      c.stroke();
    });

    const hi = canvasTexture(200, 120, (c, w, h) => {
      roundRect(c, 4, 4, w - 8, h - 30, 26);
      c.fillStyle = "#3D5CFF";
      c.fill();
      c.beginPath();
      c.moveTo(40, h - 28);
      c.lineTo(30, h - 4);
      c.lineTo(66, h - 28);
      c.fill();
      c.fillStyle = "#ECEAE3";
      c.font = `600 48px ${fonts().display}`;
      c.fillText("hi", 72, 66);
    });

    return {
      sheet,
      captcha,
      tick,
      hi,
      decoded: labelTexture("ocr → 7XK2P", { color: "#7D92FF", size: 40 }),
      time: labelTexture("3–5 min  →  1–2 s", { color: "#ECEAE3", size: 40 }),
    };
  }, []);

  const sheetMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: sheetVertex,
        fragmentShader: sheetFragment,
        transparent: true,
        uniforms: { uMap: { value: tex.sheet }, uBeam: { value: -1 }, uOpacity: { value: 1 }, uTint: { value: new THREE.Color(palette.signalHi) } },
      }),
    [tex]
  );
  const tickMats = useMemo(
    () => Array.from({ length: ROWS }, () => new THREE.MeshBasicMaterial({ map: tex.tick, transparent: true, color: palette.signalHi, toneMapped: false, opacity: 0 })),
    [tex]
  );
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.signalHi).multiplyScalar(2.5), transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const haloMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(palette.signal) }, uO: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `uniform vec3 uColor; uniform float uO; varying vec2 vUv; void main(){ float a = pow(1.0 - abs(vUv.y-0.5)*2.0, 3.0) * uO; gl_FragColor = vec4(uColor*a, a);} `,
      }),
    []
  );
  const bubbleMat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex.hi, transparent: true, toneMapped: false }), [tex]);
  const decodedMat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex.decoded.tex, transparent: true, opacity: 0, toneMapped: false }), [tex]);
  const captchaMat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex.captcha, transparent: true }), [tex]);
  const timeMat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex.time.tex, transparent: true, opacity: 0.8 }), [tex]);

  const rowH = (SHEET_H * (668 - 120)) / 668 / ROWS;
  const rowY = (i: number) => SHEET_H / 2 - (SHEET_H * 110) / 668 - (i + 0.5) * rowH;
  const tickX = SHEET_W / 2 - (SHEET_W * 64) / 512 + rowH * 0.3;

  useFrame((state, dt) => {
    const a = activityRef.current;
    if (!root.current) return;
    root.current.scale.setScalar(0.6 + a * 0.4);
    if (a < 0.02) return;
    const t = (state.clock.elapsedTime % CYCLE) / CYCLE * CYCLE;

    // 0 – 0.7s: "hi" pops in
    const pop = THREE.MathUtils.smoothstep(t, 0, 0.35) * (1 - THREE.MathUtils.smoothstep(t, 5.4, 6));
    if (bubble.current) {
      bubble.current.scale.setScalar(Math.max(0.001, pop * (1 + Math.sin(Math.min(t, 0.5) * 12) * 0.08 * (1 - t / 0.5))));
    }
    // 0.7 – 1.5s: CAPTCHA decoded
    const dec = THREE.MathUtils.smoothstep(t, 0.7, 1.3) * (1 - THREE.MathUtils.smoothstep(t, 5.4, 6));
    decodedMat.opacity = dec;
    captchaMat.opacity = 1 - dec * 0.35;
    // 1.5 – 3.9s: sheet scan
    const scan = THREE.MathUtils.clamp((t - 1.5) / 2.4, 0, 1);
    const scanning = t > 1.5 && t < 4.1;
    sheetMat.uniforms.uBeam.value = scanning ? scan : -1;
    if (beam.current) {
      beam.current.visible = scanning;
      beam.current.position.y = SHEET_H / 2 - scan * SHEET_H;
    }
    haloMat.uniforms.uO.value = scanning ? 0.9 : 0;
    const fade = 1 - THREE.MathUtils.smoothstep(t, 5.4, 6.2);
    for (let i = 0; i < ROWS; i++) {
      const rowPos = (SHEET_H / 2 - rowY(i)) / SHEET_H;
      const lit = t > 1.5 && scan >= rowPos;
      const m = tickMats[i];
      m.opacity = THREE.MathUtils.lerp(m.opacity, lit ? fade : 0, 1 - Math.exp(-dt * 14));
      const tm = ticks.current[i];
      if (tm) tm.scale.setScalar(0.4 + m.opacity * 0.6);
    }
    // Gentle float
    root.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.06;
  });

  return (
    <group ref={root} rotation={[-0.04, -side * 0.3, side * 0.02]}>
      <mesh material={sheetMat}>
        <planeGeometry args={[SHEET_W, SHEET_H]} />
      </mesh>
      {Array.from({ length: ROWS }).map((_, i) => (
        <mesh
          key={i}
          material={tickMats[i]}
          position={[tickX, rowY(i), 0.02]}
          ref={(el) => {
            if (el) ticks.current[i] = el;
          }}
        >
          <planeGeometry args={[rowH * 0.8, rowH * 0.8]} />
        </mesh>
      ))}
      <group ref={beam} position={[0, 0, 0.04]}>
        <mesh material={beamMat}>
          <planeGeometry args={[SHEET_W * 1.12, 0.018]} />
        </mesh>
        <mesh material={haloMat}>
          <planeGeometry args={[SHEET_W * 1.12, 0.5]} />
        </mesh>
      </group>
      {/* CAPTCHA strip + decoded readout */}
      <mesh material={captchaMat} position={[SHEET_W / 2 - 0.62, SHEET_H / 2 + 0.34, 0.12]}>
        <planeGeometry args={[1.12, 0.315]} />
      </mesh>
      <mesh material={decodedMat} position={[SHEET_W / 2 - 0.62, SHEET_H / 2 + 0.66, 0.12]}>
        <planeGeometry args={[0.32 * tex.decoded.aspect * 0.6, 0.32 * 0.6]} />
      </mesh>
      {/* The chatbot trigger */}
      <mesh ref={bubble} material={bubbleMat} position={[-side * (SHEET_W / 2 + 0.55), 0.9, 0.5]}>
        <planeGeometry args={[0.8, 0.48]} />
      </mesh>
      {/* Stated speed-up, verbatim from the project description */}
      <mesh material={timeMat} position={[0, -SHEET_H / 2 - 0.3, 0.05]}>
        <planeGeometry args={[0.24 * tex.time.aspect, 0.24]} />
      </mesh>
    </group>
  );
}
