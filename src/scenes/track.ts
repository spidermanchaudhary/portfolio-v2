import * as THREE from "three";
import type { Project } from "@/data/types";
import { impactScale } from "@/data/projects";
import { origin } from "@/data/origin";

export type StationKind = "hero" | "origin" | "toolbox" | "world" | "signals" | "launch";

export interface Station {
  /** Matches the `data-station` attribute on the HTML chapter */
  key: string;
  kind: StationKind;
  /** Index within its kind (origin chapter, world number) */
  index: number;
  /** Where the station's object lives */
  anchor: THREE.Vector3;
  /** Camera position when parked here */
  cam: THREE.Vector3;
  /** Camera look target when parked here */
  look: THREE.Vector3;
  /** Planet radius multiplier (worlds) */
  scale: number;
  /** Which side of the screen the object sits on: 1 right, -1 left */
  side: number;
}

/**
 * Lays out the universe. The camera visits stations in order; between them
 * a centripetal Catmull-Rom spline keeps the flight smooth.
 *
 * On wide screens the camera sits offset so the object lands opposite the
 * HTML text panel. On tall screens it centres the object in the upper half.
 */
export function buildTrack(projects: Project[], aspect: number): Station[] {
  const wide = aspect >= 1.1;
  const stations: Station[] = [];
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  const push = (s: Omit<Station, "cam" | "look">, dist: number, lateral: number, lift = 0.25) => {
    const offX = wide ? -s.side * lateral : 0;
    const offY = wide ? 0 : -lateral * 0.55; // tall screens: object sits high
    stations.push({
      ...s,
      cam: v(s.anchor.x + offX, s.anchor.y + lift + offY * 0.4, s.anchor.z + dist),
      look: v(s.anchor.x + offX, s.anchor.y + offY, s.anchor.z),
    });
  };

  // Hero: the particle name at the origin of the universe
  stations.push({
    key: "top",
    kind: "hero",
    index: 0,
    anchor: v(0, 0, 0),
    cam: v(0, 0, 10),
    look: v(0, 0, 0),
    scale: 1,
    side: 0,
  });

  // Galaxy: pull back and up while the name unravels into a spiral
  stations.push({
    key: "galaxy",
    kind: "hero",
    index: 1,
    anchor: v(0, 0, 0),
    cam: wide ? v(-3.4, 4.2, 15) : v(0, 6.5, 19),
    look: wide ? v(-3.4, -0.2, 0) : v(0, -2.6, 0),
    scale: 1,
    side: 1,
  });

  // Origin: beacons along a dotted orbit
  origin.forEach((_, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    push(
      { key: `origin-${i}`, kind: "origin", index: i, anchor: v(side * 2.4, Math.sin(i * 1.7) * 0.6, -26 - i * 15), scale: 1, side },
      7,
      2.4
    );
  });

  // Toolbox: a ring the camera flies through
  stations.push({
    key: "toolbox",
    kind: "toolbox",
    index: 0,
    anchor: v(0, 0, -100),
    cam: v(0, 0.2, -91),
    look: v(0, 0, -100),
    scale: 1,
    side: 0,
  });

  // Worlds: alternating sides, spaced so neighbours peek in the distance
  projects.forEach((p, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const scale = impactScale(p.users);
    push(
      {
        key: `world-${i}`,
        kind: "world",
        index: i,
        anchor: v(side * 3.1, Math.sin(i * 1.3) * 1.1, -128 - i * 34),
        scale,
        side,
      },
      8.2 + (scale - 1) * 3.6,
      2.9 + (scale - 1) * 0.9,
      0.45
    );
  });

  const lastZ = stations[stations.length - 1].anchor.z;

  // Signals: a pulsar broadcasting
  push({ key: "signals", kind: "signals", index: 0, anchor: v(2.2, 1.4, lastZ - 44), scale: 1, side: 1 }, 11, 1.2, 0.2);

  // Launch: the pad, seen from slightly below so the probe climbs into frame
  const pad = v(2.6, -1.4, lastZ - 92);
  const offX = wide ? -2.8 : 0;
  stations.push({
    key: "launch",
    kind: "launch",
    index: 0,
    anchor: pad,
    cam: v(pad.x + offX, pad.y + 0.9, pad.z + 9.5),
    look: v(pad.x + offX, pad.y + (wide ? 1.6 : 2.6), pad.z),
    scale: 1,
    side: 1,
  });

  return stations;
}

export interface TrackCurves {
  cam: THREE.CatmullRomCurve3;
  look: THREE.CatmullRomCurve3;
}

export function buildCurves(stations: Station[]): TrackCurves {
  return {
    cam: new THREE.CatmullRomCurve3(stations.map((s) => s.cam), false, "centripetal", 0.5),
    look: new THREE.CatmullRomCurve3(stations.map((s) => s.look), false, "centripetal", 0.5),
  };
}

/** Station-index t (0..N-1) → curve parameter (0..1). CatmullRomCurve3
 *  passes exactly through point i at u = i / (N-1). */
export function tToU(t: number, n: number) {
  return THREE.MathUtils.clamp(t / Math.max(1, n - 1), 0, 1);
}
