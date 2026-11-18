"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { atmoFragment, atmoVertex, planetBakeFragment, planetBakeVertex, planetFragment, planetVertex } from "@/shaders/planet";
import { flight, useUniverse, type Quality } from "@/store/universe";
import type { Station } from "../track";
import { damp } from "../shared/activity";

type Kind = "terra" | "giant" | "lava" | "ice" | "rock";
const KIND: Record<Kind, number> = { terra: 0, giant: 1, lava: 2, ice: 3, rock: 4 };

interface PlanetDef {
  kind: Kind;
  /** Station the planet is placed relative to */
  near: string;
  /** Hidden until the camera is (almost) at this station */
  from: string;
  /** Offset from that station's anchor (wide screens; narrowed on phones) */
  offset: [number, number, number];
  radius: number;
  seed: number;
  /** Axial tilt (rad) and spin (rad/s) */
  tilt: number;
  spin: number;
  bump: number;
  atmo?: { color: string; strength: number; thickness: number };
  tints?: [string, string, string];
}

/**
 * Sited beside the flight path so the camera sweeps past them: a moon, an
 * inhabited world and a lava world through the About chapters; a gas giant,
 * an ice moon and a cratered rock between the projects. None appear in the
 * hero/galaxy view, and the giant waits until the black hole is behind you.
 */
const PLANETS: PlanetDef[] = [
  {
    kind: "rock",
    near: "origin-1",
    from: "origin-0",
    offset: [-1.5, 6.2, -14],
    radius: 1.4,
    seed: 11.2,
    tilt: 0.1,
    spin: 0.02,
    bump: 1.2,
    tints: ["#8E8A84", "#4A4744", "#000000"],
  },
  {
    kind: "terra",
    near: "origin-2",
    from: "origin-1",
    offset: [13, -15, -22],
    radius: 7,
    seed: 3.7,
    tilt: 0.41,
    spin: 0.012,
    bump: 1,
    atmo: { color: "#6E9BFF", strength: 0.7, thickness: 0.06 },
  },
  {
    kind: "lava",
    near: "origin-3",
    from: "origin-2",
    offset: [-11.6, 9.6, -24],
    radius: 4,
    seed: 7.1,
    tilt: 0.2,
    spin: 0.018,
    bump: 1.2,
    atmo: { color: "#FF6B3D", strength: 0.4, thickness: 0.05 },
  },
  {
    // Only once the black hole is behind the camera — never in frame together
    kind: "giant",
    near: "project-1",
    from: "project-0",
    offset: [-36, -15, -22],
    radius: 19,
    seed: 2.3,
    tilt: 0.12,
    spin: 0.01,
    bump: 1,
    atmo: { color: "#E8C9A0", strength: 0.5, thickness: 0.035 },
    tints: ["#C9B596", "#8A6446", "#A4502E"],
  },
  {
    kind: "ice",
    near: "project-3",
    from: "project-2",
    offset: [29, 15, -18],
    radius: 4.6,
    seed: 5.9,
    tilt: 0.3,
    spin: 0.015,
    bump: 1.1,
    atmo: { color: "#A8C8FF", strength: 0.35, thickness: 0.04 },
    tints: ["#AEB9C2", "#D9DEE2", "#7A4A36"],
  },
  {
    kind: "rock",
    near: "project-5",
    from: "project-4",
    offset: [7, 6.5, -16],
    radius: 2.4,
    seed: 23.4,
    tilt: 0.2,
    spin: 0.02,
    bump: 1.2,
    tints: ["#7D5E4A", "#3F2C22", "#000000"],
  },
];

const OCTAVES: Record<Quality, number> = { high: 7, medium: 6, low: 5 };
const SEGMENTS: Record<Quality, number> = { high: 128, medium: 96, low: 64 };
/** Baked surface width (height is half) for big / small planets */
const BAKE: Record<Quality, [number, number]> = { high: [2048, 1024], medium: [1536, 768], low: [1024, 512] };
/** The bake is split into this many bands, one band per frame */
const BANDS: Record<Quality, number> = { high: 2, medium: 4, low: 8 };

// Shared full-screen pass for baking
const bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const bakeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
bakeQuad.frustumCulled = false;
const bakeScene = new THREE.Scene();
bakeScene.add(bakeQuad);
/** Clock time of the last bake band — at most one band per frame overall */
let lastBake = -1;

/** One sun for the whole system: upper right, slightly in front */
const SUN = new THREE.Vector3(0.85, 0.35, 0.5).normalize();
const SUN_COLOR = new THREE.Color(1.0, 0.96, 0.9);

export default function Planets({ stations }: { stations: Station[] }) {
  const quality = useUniverse((s) => s.quality);
  const wide = useThree((s) => s.size.width / s.size.height >= 1.1);
  const geo = useMemo(() => new THREE.SphereGeometry(1, SEGMENTS[quality], Math.round(SEGMENTS[quality] * 0.75)), [quality]);
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <>
      {PLANETS.map((def, i) => {
        const at = stations.findIndex((s) => s.key === def.near);
        const from = stations.findIndex((s) => s.key === def.from);
        if (at < 0 || from < 0) return null;
        return <Planet key={i} def={def} station={stations[at]} trackIndex={at} fromIndex={from} geo={geo} quality={quality} wide={wide} />;
      })}
    </>
  );
}

const sunObj = new THREE.Vector3();
const invQ = new THREE.Quaternion();

function Planet({
  def,
  station,
  trackIndex,
  fromIndex,
  geo,
  quality,
  wide,
}: {
  def: PlanetDef;
  station: Station;
  trackIndex: number;
  fromIndex: number;
  geo: THREE.SphereGeometry;
  quality: Quality;
  wide: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const fade = useRef(0);
  const target = useRef<THREE.WebGLRenderTarget | null>(null);
  const band = useRef(0);

  const center = useMemo(() => {
    const [x, y, z] = def.offset;
    // Phones: a narrow view, so pull planets in toward the path (to the edges)
    return station.anchor.clone().add(new THREE.Vector3(wide ? x : x * 0.55, wide ? y : y * 0.8, z));
  }, [def, station, wide]);

  const bakeMat = useMemo(() => {
    const t = def.tints ?? ["#ffffff", "#ffffff", "#ffffff"];
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: planetBakeVertex,
      fragmentShader: planetBakeFragment,
      defines: { KIND: KIND[def.kind], OCT: OCTAVES[quality] },
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uSeed: { value: def.seed },
        uTintA: { value: new THREE.Color(t[0]) },
        uTintB: { value: new THREE.Color(t[1]) },
        uTintC: { value: new THREE.Color(t[2]) },
      },
    });
  }, [def, quality]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: planetVertex,
        fragmentShader: planetFragment,
        defines: { KIND: KIND[def.kind] },
        uniforms: {
          uMapA: { value: null },
          uMapB: { value: null },
          uTime: { value: 0 },
          uSun: { value: SUN },
          uSunObj: { value: new THREE.Vector3().copy(SUN) },
          uSunColor: { value: SUN_COLOR },
          uAtmo: { value: new THREE.Color(def.atmo?.color ?? "#000000") },
          uAtmoStrength: { value: def.atmo?.strength ?? 0 },
          uBump: { value: def.bump * def.radius },
          uFade: { value: 0 },
        },
      }),
    [def]
  );

  const atmoMat = useMemo(() => {
    if (!def.atmo) return null;
    return new THREE.ShaderMaterial({
      vertexShader: atmoVertex,
      fragmentShader: atmoFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uCenter: { value: center },
        uRadius: { value: def.radius },
        uShell: { value: 1 + def.atmo.thickness * 4 },
        uColor: { value: new THREE.Color(def.atmo.color) },
        uSun: { value: SUN },
        uStrength: { value: def.atmo.strength },
        uFade: { value: 0 },
      },
    });
  }, [def, center]);

  const release = () => {
    target.current?.dispose();
    target.current = null;
    material.uniforms.uMapA.value = null;
    material.uniforms.uMapB.value = null;
  };

  useEffect(
    () => () => {
      material.dispose();
      bakeMat.dispose();
      atmoMat?.dispose();
    },
    [material, bakeMat, atmoMat]
  );
  // A new tier means a new bake (different resolution/octaves)
  useEffect(() => release, [bakeMat]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, dt) => {
    const g = group.current;
    const b = body.current;
    if (!g || !b) return;
    const focus = useUniverse.getState().focusSlug;
    const t = flight.t;

    // Bake shortly before the planet is due, free it once it's well behind
    const wanted = !focus && t > fromIndex - 1.75 && t < trackIndex + 4.5;
    if (!wanted && target.current && fade.current < 0.003) release();
    if (wanted && !target.current) {
      const [w, h] = BAKE[quality];
      const scale = def.radius >= 6 ? 1 : 0.5;
      const half = state.gl.extensions.has("EXT_color_buffer_half_float") || state.gl.extensions.has("EXT_color_buffer_float");
      const rt = new THREE.WebGLRenderTarget(w * scale, h * scale, {
        count: 2,
        type: half ? THREE.HalfFloatType : THREE.UnsignedByteType,
        depthBuffer: false,
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
      });
      for (const tex of rt.textures) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.anisotropy = Math.min(4, state.gl.capabilities.getMaxAnisotropy());
      }
      target.current = rt;
      band.current = 0;
    }
    const rt = target.current;
    const bands = BANDS[quality];
    if (rt && band.current < bands && lastBake !== state.clock.elapsedTime) {
      lastBake = state.clock.elapsedTime;
      const bh = Math.ceil(rt.height / bands);
      rt.scissor.set(0, band.current * bh, rt.width, bh);
      rt.scissorTest = true;
      bakeQuad.material = bakeMat;
      const prev = state.gl.getRenderTarget();
      state.gl.setRenderTarget(rt);
      state.gl.render(bakeScene, bakeCam);
      state.gl.setRenderTarget(prev);
      band.current++;
      if (band.current === bands) {
        material.uniforms.uMapA.value = rt.textures[0];
        material.uniforms.uMapB.value = rt.textures[1];
      }
    }
    const ready = !!rt && band.current >= bands;

    // Visible only on its stretch of the flight: from its `from` station
    // until the camera has passed it
    const inWindow = ready && !focus && t > fromIndex - 0.25 && t < trackIndex + 3.5;
    fade.current = damp(fade.current, inWindow ? 1 : 0, 2.5, dt);
    // …and it emerges out of the dark as you approach, rather than popping in
    const dist = state.camera.position.distanceTo(g.position) - def.radius;
    // Phones: text spans the full width, so planets stay dimmer behind it
    const f = fade.current * (1 - THREE.MathUtils.smoothstep(dist, 55, 110)) * (wide ? 1 : 0.45);
    g.visible = ready && f > 0.003;
    if (!g.visible) return;

    b.rotation.y += def.spin * dt;
    const u = material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uFade.value = f;
    // Sun in the planet's own frame, for cloud shadows
    b.updateMatrixWorld();
    invQ.copy(b.getWorldQuaternion(invQ)).invert();
    (u.uSunObj.value as THREE.Vector3).copy(sunObj.copy(SUN).applyQuaternion(invQ));
    if (atmoMat) atmoMat.uniforms.uFade.value = f;
  });

  const shell = def.atmo ? def.radius * (1 + def.atmo.thickness * 4) : 0;

  return (
    <group ref={group} position={center} visible={false}>
      <group rotation={[0, 0, def.tilt]}>
        <mesh ref={body} geometry={geo} material={material} scale={def.radius} />
      </group>
      {atmoMat && <mesh geometry={geo} material={atmoMat} scale={shell} />}
    </group>
  );
}
