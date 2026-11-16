"use client";

import type { Station } from "../track";
import OriginTrail from "./OriginTrail";
import Pulsar from "./Pulsar";
import BlackHole from "./BlackHole";
import LaunchPad from "./LaunchPad";

/** The non-project stops: origin trail, pulsar, launch pad. */
export default function Landmarks({ stations }: { stations: Station[] }) {
  const idx = (key: string) => stations.findIndex((s) => s.key === key);
  const signals = idx("signals");
  const hole = idx("work-intro");
  const launch = idx("launch");

  return (
    <>
      <OriginTrail stations={stations} />
      {hole >= 0 && <BlackHole station={stations[hole]} trackIndex={hole} />}
      {signals >= 0 && <Pulsar station={stations[signals]} trackIndex={signals} />}
      {launch >= 0 && <LaunchPad station={stations[launch]} trackIndex={launch} />}
    </>
  );
}
