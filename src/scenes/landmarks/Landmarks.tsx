"use client";

import type { Station } from "../track";
import OriginTrail from "./OriginTrail";
import SpaceStation from "./SpaceStation";
import BlackHole from "./BlackHole";
import LaunchPad from "./LaunchPad";
import Planets from "./Planets";

/** The non-project stops: origin trail, planets, space station, launch pad. */
export default function Landmarks({ stations }: { stations: Station[] }) {
  const idx = (key: string) => stations.findIndex((s) => s.key === key);
  const signals = idx("signals");
  const hole = idx("work-intro");
  const launch = idx("launch");

  return (
    <>
      <OriginTrail stations={stations} />
      <Planets stations={stations} />
      {hole >= 0 && <BlackHole station={stations[hole]} trackIndex={hole} />}
      {signals >= 0 && <SpaceStation station={stations[signals]} trackIndex={signals} />}
      {launch >= 0 && <LaunchPad station={stations[launch]} trackIndex={launch} />}
    </>
  );
}
