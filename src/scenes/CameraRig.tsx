"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { flight, useUniverse } from "@/store/universe";
import { buildCurves, tToU, type Station } from "./track";
import { useUniverseData } from "@/hooks/useUniverseData";

const desiredPos = new THREE.Vector3();
const desiredLook = new THREE.Vector3();

/**
 * Flies the camera along the track. Scroll sets `flight.t`; the rig
 * samples the spline there and damps toward it. When a world is focused
 * (/work/[slug]) the rig leaves the track and settles into a slow orbit
 * close to that planet — the "page transition" is just this camera move.
 */
export default function CameraRig({ stations }: { stations: Station[] }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const focusSlug = useUniverse((s) => s.focusSlug);
  const { projects } = useUniverseData();
  const curves = useMemo(() => buildCurves(stations), [stations]);
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const orbit = useRef(0);
  const lastZ = useRef(camera.position.z);
  const last = useRef(camera.position.clone());
  const wide = size.width / size.height >= 1.1;

  const focus = useMemo(() => {
    if (!focusSlug) return null;
    const i = projects.findIndex((p) => p.slug === focusSlug);
    return stations.find((s) => s.kind === "world" && s.index === i) ?? null;
  }, [focusSlug, projects, stations]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const n = stations.length;
    let lambda = 6.5;

    if (focus) {
      // Close orbit around the focused planet
      orbit.current += dt * 0.07;
      const r = 4.6 * focus.scale;
      const a = orbit.current;
      desiredPos.set(
        focus.anchor.x + Math.sin(a) * r * 0.35 + (wide ? -1.9 : 0),
        focus.anchor.y + 0.6 + Math.sin(a * 0.7) * 0.25,
        focus.anchor.z + r
      );
      desiredLook.set(focus.anchor.x + (wide ? -1.9 : 0) * 0.55, focus.anchor.y + (wide ? 0 : -1.2), focus.anchor.z);
      lambda = 2.2;
    } else {
      const u = tToU(flight.t, n);
      curves.cam.getPoint(u, desiredPos);
      curves.look.getPoint(u, desiredLook);
      orbit.current = 0;

      // Launch: tilt up and follow the rocket (scrubbed by scroll, or
      // played after the contact form sends)
      const alt = Math.min(flight.rocketAlt, 26);
      if (alt > 0.01) {
        desiredLook.y += alt * 0.82;
        desiredPos.y += alt * 0.22;
        desiredPos.z += alt * 0.12;
      }
    }

    // Parallax from cursor (desktop) or device tilt (mobile)
    const px = flight.pointer.y < -1.5 ? 0 : flight.pointer.x; // ignore off-screen sentinel
    const py = flight.pointer.y < -1.5 ? 0 : flight.pointer.y;
    desiredPos.x += px * 0.32 + flight.tilt.x * 0.6;
    desiredPos.y += py * 0.18 + flight.tilt.y * 0.4;

    const k = 1 - Math.exp(-lambda * dt);
    camera.position.lerp(desiredPos, k);
    look.current.lerp(desiredLook, 1 - Math.exp(-(lambda + 1.5) * dt));
    camera.lookAt(look.current);

    // Bank slightly into lateral motion and with scroll velocity
    camera.rotation.z += THREE.MathUtils.clamp(-flight.velocity * 0.0009, -0.05, 0.05);

    // Camera velocity (units/sec) for streaks and audio
    const inv = 1 / Math.max(dt, 1e-3);
    const k2 = Math.min(1, dt * 10);
    const dz = lastZ.current - camera.position.z;
    flight.vel.x += ((camera.position.x - last.current.x) * inv - flight.vel.x) * k2;
    flight.vel.y += ((camera.position.y - last.current.y) * inv - flight.vel.y) * k2;
    flight.vel.z += ((camera.position.z - last.current.z) * inv - flight.vel.z) * k2;
    last.current.copy(camera.position);
    lastZ.current = camera.position.z;
    flight.speed += (dz * inv - flight.speed) * k2;
  });

  return null;
}
