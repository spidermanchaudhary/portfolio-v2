"use client";

import type { Station } from "../track";
import OriginTrail from "./OriginTrail";
import Pulsar from "./Pulsar";
import LaunchPad from "./LaunchPad";

/** The non-project stops: origin trail, pulsar, launch pad. */
export default function Landmarks({ stations }: { stations: Station[] }) {
  const idx = (key: string) => stations.findIndex((s) => s.key === key);
  const signals = idx("signals");
  const launch = idx("launch");

  return (
    <>
      <OriginTrail stations={stations} />
      {signals >= 0 && <Pulsar station={stations[signals]} trackIndex={signals} />}
      {launch >= 0 && <LaunchPad station={stations[launch]} trackIndex={launch} />}
    </>
  );
}
