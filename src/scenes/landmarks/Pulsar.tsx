"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { palette } from "@/lib/palette";
import type { Station } from "../track";
import { activity, damp, isNear } from "../shared/activity";

const beamVertex = /* glsl */ `
varying float vY;
varying vec3 vN;
varying vec3 vV;
void main() {
  vY = position.y;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying float vY;
varying vec3 vN;
varying vec3 vV;
void main() {
  float along = 1.0 - clamp(abs(vY) / 7.0, 0.0, 1.0);
  float edge = 1.0 - abs(dot(normalize(vN), vV));
  float a = along * along * (0.25 + (1.0 - edge) * 0.75) * uIntensity;
  gl_FragColor = vec4(uColor * a, a);
}`;

/**
 * Signals — a pulsar. Two lighthouse beams sweep the dark, and one
 * shockwave ring goes out per transmission received.
 */
export default function Pulsar({ station, trackIndex, count }: { station: Station; trackIndex: number; count: number }) {
  const group = useRef<THREE.Group>(null);
  const spinner = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Group>(null);
  const act = useRef(0);

  const beamGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.9, 7, 32, 1, true);
    g.translate(0, -3.5, 0);
    return g;
  }, []);
  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(palette.signalHi) }, uIntensity: { value: 0.5 } },
      }),
    []
  );
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.paper).multiplyScalar(2.2), toneMapped: false }), []);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.98, 1, 128), []);
  const ringMats = useMemo(
    () =>
      Array.from({ length: count }, () => new THREE.MeshBasicMaterial({ color: palette.signalHi, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })),
    [count]
  );

  useFrame((state, dt) => {
    const near = isNear(trackIndex, 2);
    if (group.current) group.current.visible = near;
    if (!near) return;
    act.current = damp(act.current, activity(trackIndex, 1.2), 3, dt);
    const t = state.clock.elapsedTime;
    if (spinner.current) spinner.current.rotation.z = t * 1.6;
    beamMat.uniforms.uIntensity.value = 0.25 + act.current * 0.55;
    ringsRef.current?.children.forEach((r, i) => {
      // Staggered, each ring = one note received
      const p = (t * 0.22 + i / count) % 1;
      r.scale.setScalar(0.4 + p * 9);
      ringMats[i].opacity = (1 - p) * (1 - p) * 0.55 * (0.3 + act.current * 0.7);
    });
  });

  return (
    <group ref={group} position={station.anchor}>
      <mesh material={coreMat}>
        <icosahedronGeometry args={[0.32, 3]} />
      </mesh>
      {/* Spin axis tilted from the view axis so the beams sweep the camera */}
      <group rotation={[0.5, 0.4, 0]}>
        <group ref={spinner}>
          <mesh geometry={beamGeo} material={beamMat} rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]} />
          <mesh geometry={beamGeo} material={beamMat} rotation={[0, 0, -Math.PI / 2]} />
        </group>
      </group>
      <group ref={ringsRef} rotation={[-1.1, 0, 0.2]}>
        {ringMats.map((mat, i) => (
          <mesh key={i} geometry={ringGeo} material={mat} />
        ))}
      </group>
    </group>
  );
}
