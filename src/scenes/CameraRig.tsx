"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { flight, useUniverse } from "@/store/universe";
import { buildCurves, tToU, type Station } from "./track";
import { useUniverseData } from "@/hooks/useUniverseData";
import { warpAmount } from "@/lib/warp";

const desiredPos = new THREE.Vector3();
const desiredLook = new THREE.Vector3();

/**
 * Flies the camera along the track. Scroll sets `flight.t`; the rig
 * samples the spline there and damps toward it. On a project page
 * (/work/[slug]) it eases in to that project's station and drifts — the
 * "page transition" is just this camera move.
 */
export default function CameraRig({ stations }: { stations: Station[] }) {
  const camera = useThree((s) => s.camera);
  const focusSlug = useUniverse((s) => s.focusSlug);
  const { projects } = useUniverseData();
  const curves = useMemo(() => buildCurves(stations), [stations]);
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const orbit = useRef(0);
  const lastZ = useRef(camera.position.z);
  const last = useRef(camera.position.clone());

  const focus = useMemo(() => {
    if (!focusSlug) return null;
    const i = projects.findIndex((p) => p.slug === focusSlug);
    return stations.find((s) => s.kind === "project" && s.index === i) ?? null;
  }, [focusSlug, projects, stations]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const n = stations.length;
    let lambda = 6.5;

    if (focus) {
      // Project page: drift slowly at that project's station
      orbit.current += dt * 0.12;
      const a = orbit.current;
      desiredPos.copy(focus.cam);
      desiredPos.x += Math.sin(a) * 0.6;
      desiredPos.y += Math.sin(a * 0.7) * 0.3;
      desiredPos.z -= 2.5; // a little closer than the scroll pose
      desiredLook.copy(focus.look);
      lambda = 2.2;
    } else {
      const u = tToU(flight.t, n);
      curves.cam.getPoint(u, desiredPos);
      curves.look.getPoint(u, desiredLook);
      orbit.current = 0;

      // Launch: tilt up and follow the rocket (scrubbed by scroll, or
      // played after the contact form sends)
      // Only a glance upward — the rocket stays background and leaves frame
      const alt = Math.min(flight.rocketAlt, 26);
      if (alt > 0.01) desiredLook.y += Math.min(alt, 6) * 0.3;
    }

    // Parallax from cursor (desktop) or device tilt (mobile)
    const px = flight.pointer.y < -1.5 ? 0 : flight.pointer.x; // ignore off-screen sentinel
    const py = flight.pointer.y < -1.5 ? 0 : flight.pointer.y;
    desiredPos.x += px * 0.32 + flight.tilt.x * 0.6;
    desiredPos.y += py * 0.18 + flight.tilt.y * 0.4;

    // Hyperspace: widen the lens and race to the target
    const w = warpAmount();
    lambda += w * 9;
    const cam = camera as THREE.PerspectiveCamera;
    const fov = 42 + w * 24;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }

    const k = 1 - Math.exp(-lambda * dt);
    camera.position.lerp(desiredPos, k);
    look.current.lerp(desiredLook, 1 - Math.exp(-(lambda + 1.5) * dt));
    camera.lookAt(look.current);

    // Bank slightly into lateral motion and with scroll velocity
    camera.rotation.z += THREE.MathUtils.clamp(-flight.velocity * 0.0009, -0.05, 0.05);

    // Camera velocity (units/sec) for star streaks
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
