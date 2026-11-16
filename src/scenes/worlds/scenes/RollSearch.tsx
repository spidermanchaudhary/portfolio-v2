"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MiniSceneProps } from "../types";
import { palette } from "@/lib/palette";
import { canvasTexture, fonts, rng, roundRect } from "../../shared/canvasTexture";

const COLS = 10;
const ROWS = 7;
const W = 3.4;
const H = W * (ROWS / COLS) * 0.72;
const CYCLE = 5.5;
const CELL_PX = { w: 96, h: 50 };

const gridVertex = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const gridFragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uBeam;   // rows swept so far (0..ROWS), -1 idle
uniform vec2  uMatch;  // matched cell (col,row)
uniform float uFound;
uniform vec3  uSignal;
varying vec2 vUv;
void main() {
  vec2 cell = floor(vec2(vUv.x * ${COLS}.0, (1.0 - vUv.y) * ${ROWS}.0));
  vec3 tex = texture2D(uMap, vUv).rgb;
  float row = (1.0 - vUv.y) * ${ROWS}.0;
  bool isMatch = cell == uMatch;
  // Rows the beam has passed are dimmed as "not it" — except the match
  float swept = uBeam >= 0.0 ? step(row, uBeam) : 0.0;
  float dim = isMatch ? 1.0 : mix(1.0, 0.28, swept);
  float edge = uBeam >= 0.0 ? smoothstep(0.35, 0.0, abs(row - uBeam)) : 0.0;
  vec3 col = tex * 0.55 * dim + uSignal * edge * 0.55;
  // The matched cell's slot goes dark once its tile lifts out
  if (isMatch) col = mix(col, vec3(0.02), uFound);
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * NSUT Rollno Search — a floor of roll-number tiles. A query is typed, a
 * search beam sweeps the rows, misses dim out, and the one matching tile
 * rises from the grid to face you.
 */
export default function RollSearch({ activityRef, side }: MiniSceneProps) {
  const tile = useRef<THREE.Group>(null);
  const lastCycle = useRef(-1);
  const typed = useRef(-1);

  const { numbers, grid, queryCanvas, queryTex, tileTexes } = useMemo(() => {
    const r = rng(5150);
    const numbers = Array.from({ length: COLS * ROWS }, () => String(Math.floor(1000 + r() * 8999)));
    const { mono } = fonts();
    const grid = canvasTexture(COLS * CELL_PX.w, ROWS * CELL_PX.h, (c) => {
      c.fillStyle = "#0e0f13";
      c.fillRect(0, 0, COLS * CELL_PX.w, ROWS * CELL_PX.h);
      numbers.forEach((n, i) => {
        const x = (i % COLS) * CELL_PX.w;
        const y = Math.floor(i / COLS) * CELL_PX.h;
        roundRect(c, x + 4, y + 4, CELL_PX.w - 8, CELL_PX.h - 8, 6);
        c.fillStyle = "#1c1d24";
        c.fill();
        c.strokeStyle = "rgba(236,234,227,0.25)";
        c.lineWidth = 1.5;
        c.stroke();
        c.fillStyle = "#ECEAE3";
        c.font = `500 22px ${mono}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(n, x + CELL_PX.w / 2, y + CELL_PX.h / 2 + 1);
      });
    });
    // One texture per possible lifted tile would be wasteful; draw on demand
    const tileTexes = new Map<number, THREE.CanvasTexture>();
    const queryCanvas = document.createElement("canvas");
    queryCanvas.width = 420;
    queryCanvas.height = 72;
    const queryTex = new THREE.CanvasTexture(queryCanvas);
    queryTex.colorSpace = THREE.SRGBColorSpace;
    return { numbers, grid, queryCanvas, queryTex, tileTexes };
  }, []);

  const drawQuery = (text: string, cursor: boolean) => {
    const c = queryCanvas.getContext("2d")!;
    const { w, h } = { w: queryCanvas.width, h: queryCanvas.height };
    c.clearRect(0, 0, w, h);
    roundRect(c, 2, 2, w - 4, h - 4, 14);
    c.fillStyle = "#121215";
    c.fill();
    c.strokeStyle = "#7D92FF";
    c.lineWidth = 2;
    c.stroke();
    c.font = `500 15px ${fonts().mono}`;
    c.fillStyle = "#5C5B56";
    c.fillText("ROLL NO.", 20, 42);
    c.font = `600 30px ${fonts().mono}`;
    c.fillStyle = "#ECEAE3";
    c.fillText(text + (cursor ? "_" : ""), 120, 46);
    queryTex.needsUpdate = true;
  };

  const tileTex = (i: number) => {
    let t = tileTexes.get(i);
    if (!t) {
      t = canvasTexture(192, 100, (c, w, h) => {
        roundRect(c, 3, 3, w - 6, h - 6, 12);
        c.fillStyle = "#3D5CFF";
        c.fill();
        c.fillStyle = "#ECEAE3";
        c.font = `600 42px ${fonts().mono}`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillText(numbers[i], w / 2, h / 2 + 2);
      });
      tileTexes.set(i, t);
    }
    return t;
  };

  const gridMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: gridVertex,
        fragmentShader: gridFragment,
        uniforms: { uMap: { value: grid }, uBeam: { value: -1 }, uMatch: { value: new THREE.Vector2(-1, -1) }, uFound: { value: 0 }, uSignal: { value: new THREE.Color(palette.signalHi) } },
      }),
    [grid]
  );
  const tileMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }), []);
  const queryMat = useMemo(() => new THREE.MeshBasicMaterial({ map: queryTex, transparent: true, toneMapped: false }), [queryTex]);
  const target = useRef(0);

  useFrame((state) => {
    const a = activityRef.current;
    const t = state.clock.elapsedTime;
    const cycle = Math.floor(t / CYCLE);
    const ct = t % CYCLE;

    if (cycle !== lastCycle.current) {
      lastCycle.current = cycle;
      target.current = (cycle * 37 + 11) % numbers.length;
      tileMat.map = tileTex(target.current);
      tileMat.needsUpdate = true;
      typed.current = -1;
    }
    const idx = target.current;
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const query = numbers[idx];

    // 0 – 1.0s: type the query
    const chars = Math.min(query.length, Math.floor((ct / 1.0) * query.length));
    const blink = Math.floor(t * 3) % 2 === 0;
    const key = chars * 2 + (blink ? 1 : 0);
    if (key !== typed.current) {
      typed.current = key;
      drawQuery(query.slice(0, chars), blink && ct < 4.6);
    }
    // 1.1 – (1.1 + row time): beam sweeps down to the match row
    const sweepEnd = 1.1 + (row + 1) * 0.28;
    const beam = ct < 1.1 ? -1 : ct < sweepEnd ? ((ct - 1.1) / 0.28) : row + 1;
    gridMat.uniforms.uBeam.value = ct > 4.8 ? -1 : beam;
    gridMat.uniforms.uMatch.value.set(col, row);
    // Then the tile lifts out and turns to the camera
    const lift = THREE.MathUtils.smoothstep(ct, sweepEnd, sweepEnd + 0.7) * (1 - THREE.MathUtils.smoothstep(ct, 4.8, 5.4));
    gridMat.uniforms.uFound.value = lift;

    if (tile.current) {
      const x = (col + 0.5) / COLS * W - W / 2;
      const y = H / 2 - (row + 0.5) / ROWS * H;
      tile.current.position.set(x * (1 - lift * 0.5), y * (1 - lift) + lift * 0.9, lift * 1.4);
      // Floor-local → upright: undo the floor tilt as it rises
      tile.current.rotation.x = 0.95 * lift;
      tile.current.scale.setScalar(0.001 + lift * 1.8 * (0.4 + a * 0.6));
    }
  });

  const cellW = W / COLS;
  const cellH = H / ROWS;
  return (
    <group rotation={[0, -side * 0.25, 0]}>
      {/* The tile floor, tilted toward the camera */}
      <group rotation={[-0.95, 0, 0]} position={[0, -0.55, 0]}>
        <mesh material={gridMat}>
          <planeGeometry args={[W, H]} />
        </mesh>
        <group ref={tile}>
          <mesh material={tileMat}>
            <planeGeometry args={[cellW * 0.92, cellH * 0.92]} />
          </mesh>
        </group>
      </group>
      <mesh material={queryMat} position={[0, 1.15, 0.2]}>
        <planeGeometry args={[1.9, 1.9 * (72 / 420)]} />
      </mesh>
    </group>
  );
}
