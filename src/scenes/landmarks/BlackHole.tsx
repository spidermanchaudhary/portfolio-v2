"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { blackHoleFragment, blackHoleVertex } from "@/shaders/blackHole";
import { palette } from "@/lib/palette";
import { flight, useUniverse } from "@/store/universe";
import type { Station } from "../track";
import { activity, damp, isNear } from "../shared/activity";

/** Ray-march budget per pixel, by quality tier */
const STEPS = { high: 200, medium: 130, low: 80 } as const;
const SIZE = 22; // world units — billboard diameter

const toCam = new THREE.Vector3();
const proj = new THREE.Vector3();
const edgeP = new THREE.Vector3();
const right = new THREE.Vector3();

/**
 * A ray-traced Schwarzschild black hole on a camera-facing billboard.
 * The virtual camera inside the shader follows the real camera's angle to
 * the hole, so the lensing shifts with parallax as you scroll past.
 */
export default function BlackHole({ station, trackIndex }: { station: Station; trackIndex: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const act = useRef(0);
  const quality = useUniverse((s) => s.quality);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: blackHoleVertex,
        fragmentShader: blackHoleFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uSteps: { value: STEPS.high },
          uIncline: { value: 0.16 },
          uAzimuth: { value: 0 },
          uDist: { value: 26 },
          uFov: { value: 0.5 },
          uIntensity: { value: 0 },
          uHot: { value: new THREE.Color(palette.paper) },
          uCool: { value: new THREE.Color(palette.signal) },
        },
      }),
    []
  );

  useFrame((state, dt) => {
    const near = isNear(trackIndex, 2.2);
    if (mesh.current) mesh.current.visible = near;
    if (!near || !mesh.current) {
      act.current = 0;
      flight.hole.on = false;
      return;
    }
    act.current = damp(act.current, Math.max(0.25, activity(trackIndex, 1.6)), 3, dt);
    const u = material.uniforms;
    // Spins up while its soundtrack is playing
    u.uTime.value += dt * (useUniverse.getState().soundtrackOpen ? 2.4 : 1);
    u.uSteps.value = STEPS[quality];
    u.uIntensity.value = act.current;

    // Face the camera; feed its viewing angle into the virtual camera
    mesh.current.quaternion.copy(state.camera.quaternion);
    // Phones: smaller, so it frames above the heading instead of filling the screen
    mesh.current.scale.setScalar(state.size.width / state.size.height >= 1.1 ? 1 : 0.62);
    toCam.copy(state.camera.position).sub(station.anchor).normalize();
    // Base pose looks slightly down onto the disk; parallax nudges it
    u.uIncline.value = damp(u.uIncline.value, 0.16 + toCam.y * 0.35, 4, dt);
    u.uAzimuth.value = damp(u.uAzimuth.value, Math.atan2(toCam.x, toCam.z) * 0.6, 4, dt);

    // Publish the hole's screen position + radius for the DOM click target
    const { width, height } = state.size;
    proj.copy(station.anchor).project(state.camera);
    edgeP.copy(station.anchor).addScaledVector(right.setFromMatrixColumn(state.camera.matrixWorld, 0), SIZE * 0.2 * mesh.current.scale.x).project(state.camera);
    const x = (proj.x * 0.5 + 0.5) * width;
    const y = (-proj.y * 0.5 + 0.5) * height;
    const r = Math.abs((edgeP.x - proj.x) * 0.5 * width);
    flight.hole.x = x;
    flight.hole.y = y;
    flight.hole.r = r;
    flight.hole.on = proj.z < 1 && act.current > 0.45 && x > -r && x < width + r && y > -r && y < height + r;
  });

  return (
    <mesh ref={mesh} material={material} position={station.anchor} renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[SIZE, SIZE]} />
    </mesh>
  );
}
