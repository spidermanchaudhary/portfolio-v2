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
 * Signals — a pulsar. Two lighthouse beams sweep the dark.
 */
export default function Pulsar({ station, trackIndex }: { station: Station; trackIndex: number }) {
  const group = useRef<THREE.Group>(null);
  const spinner = useRef<THREE.Group>(null);
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

  useFrame((state, dt) => {
    const near = isNear(trackIndex, 2);
    if (group.current) group.current.visible = near;
    if (!near) return;
    act.current = damp(act.current, activity(trackIndex, 1.2), 3, dt);
    const t = state.clock.elapsedTime;
    if (spinner.current) spinner.current.rotation.z = t * 1.6;
    beamMat.uniforms.uIntensity.value = 0.25 + act.current * 0.55;
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
    </group>
  );
}
