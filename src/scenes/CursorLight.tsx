"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { flight } from "@/store/universe";
import { palette } from "@/lib/palette";

const ndc = new THREE.Vector2();
const ray = new THREE.Raycaster();
const target = new THREE.Vector3();

/**
 * Cursor-reactive lighting: a blue point light that hovers ~6 units in
 * front of the camera along the pointer ray, so lit surfaces (rocks, the
 * launch pad, scene props) catch a highlight wherever you point.
 */
export default function CursorLight() {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ camera }, dt) => {
    if (!light.current) return;
    const off = flight.pointer.y < -1.5;
    ndc.set(off ? 0 : flight.pointer.x, off ? 0 : flight.pointer.y);
    ray.setFromCamera(ndc, camera);
    ray.ray.at(6, target);
    light.current.position.lerp(target, 1 - Math.exp(-dt * 8));
    light.current.intensity += ((off ? 6 : 18) - light.current.intensity) * Math.min(1, dt * 4);
  });
  return <pointLight ref={light} color={palette.signalHi} intensity={10} distance={9} decay={1.6} />;
}
