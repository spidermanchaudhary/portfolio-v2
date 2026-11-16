"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { heroFragment, heroVertex } from "@/shaders/heroParticles";
import { buildField } from "./buildField";
import { flight, useUniverse } from "@/store/universe";
import { PARTICLES } from "@/lib/capabilities";
import { palette } from "@/lib/palette";
import { site } from "@/data/site";
import { bangAmount } from "@/lib/bang";

const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const ray = new THREE.Raycaster();
const hit = new THREE.Vector3();
const ndc = new THREE.Vector2();

/**
 * The name, written in 131k GPU particles. Assembles from dust on boot,
 * flees the cursor, unravels into a galaxy as you scroll, then scatters
 * into the starfield as the camera flies through it.
 */
export default function HeroField() {
  const quality = useUniverse((s) => s.quality);
  const booted = useUniverse((s) => s.booted);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const points = useRef<THREE.Points>(null);

  // Count is fixed for the whole visit (picked from the initial tier).
  // Adaptive quality later changes resolution/post only — never the name,
  // so it can't thin out or dim mid-visit.
  const initialCount = useRef(PARTICLES[quality]);
  const aspect = size.width / size.height;
  const aspectKey = aspect >= 1 ? "wide" : "tall";

  const geometry = useMemo(() => {
    const count = initialCount.current;
    // Sit in the upper half, clear of the HTML headline below it
    const nameY = aspect >= 1 ? 1.75 : 1.4;
    const f = buildField(count, site.firstName.toUpperCase(), aspect, nameY);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(f.dust, 3));
    g.setAttribute("aText", new THREE.BufferAttribute(f.glyph, 3));
    g.setAttribute("aGalaxy", new THREE.BufferAttribute(f.galaxy, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(f.seed, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);
    return g;
    // Rebuild only when crossing the portrait/landscape boundary
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectKey]);

  useEffect(() => () => geometry.dispose(), [geometry]);


  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: heroVertex,
        fragmentShader: heroFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uAssemble: { value: 0 },
          uMorph: { value: 0 },
          uScatter: { value: 0 },
          // Fewer particles (weak devices) → slightly larger points, so the
          // name keeps the same density and glow
          uSize: { value: 1.6 * Math.sqrt(PARTICLES.high / initialCount.current) },
          uPixelRatio: { value: 1 },
          uMouse: { value: new THREE.Vector3(99, 99, 0) },
          uMouseForce: { value: 0 },
          uSpin: { value: 0 },
          uBang: { value: 0 },
          uPaper: { value: new THREE.Color(palette.paper) },
          uSignal: { value: new THREE.Color(palette.signalHi) },
        },
      }),
    []
  );

  useEffect(() => () => material.dispose(), [material]);

  const state = useRef({ assemble: 0, mouse: new THREE.Vector3(99, 99, 0), force: 0, lastX: 0, lastY: 0, spin: 0 });

  useFrame((_, dt) => {
    const u = material.uniforms;
    const st = state.current;
    const t = flight.t;
    const visible = t < 2.7;
    if (points.current) points.current.visible = visible;
    if (!visible) return;

    u.uTime.value += dt;
    u.uPixelRatio.value = gl.getPixelRatio();

    // Big Bang, then the debris settles into the name
    const bang = bangAmount();
    u.uBang.value = bang;
    if (booted && bang > 0.6) st.assemble = Math.min(1, st.assemble + dt * 0.5);
    u.uAssemble.value = st.assemble;

    // Scroll: name → galaxy (top → galaxy station), then the galaxy
    // scatters into the starfield as the camera dives through it
    u.uMorph.value = THREE.MathUtils.smoothstep(t, 0.06, 0.92);
    u.uScatter.value = THREE.MathUtils.smoothstep(t, 1.3, 2.2);
    st.spin += dt * (0.05 + u.uMorph.value * 0.12);
    u.uSpin.value = st.spin;

    // Cursor (or touch) → point on the z=0 plane
    ndc.set(flight.pointer.x, flight.pointer.y);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) st.mouse.lerp(hit, 1 - Math.exp(-dt * 10));
    const moved = Math.hypot(flight.pointer.x - st.lastX, flight.pointer.y - st.lastY);
    st.lastX = flight.pointer.x;
    st.lastY = flight.pointer.y;
    // Force rises with pointer speed, decays when still — but never zero,
    // so a resting cursor still carves a soft hole.
    const targetForce = Math.min(1.6, 0.55 + moved * 22);
    st.force += (targetForce - st.force) * (1 - Math.exp(-dt * 5));
    u.uMouse.value.copy(st.mouse);
    u.uMouseForce.value = st.force * (1 - u.uMorph.value * 0.6);
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
