"use client";

import type { Skill } from "@/data/types";
import type { Station } from "../track";
import OriginTrail from "./OriginTrail";
import ToolboxBelt from "./ToolboxBelt";
import Pulsar from "./Pulsar";
import LaunchPad from "./LaunchPad";
import { reviews } from "@/data/reviews";

/** The non-project stops: origin beacons, toolbox belt, pulsar, launch pad. */
export default function Landmarks({ stations, skills }: { stations: Station[]; skills: Skill[] }) {
  const idx = (key: string) => stations.findIndex((s) => s.key === key);
  const toolbox = idx("toolbox");
  const signals = idx("signals");
  const launch = idx("launch");
  const liftoff = idx("liftoff");

  return (
    <>
      <OriginTrail stations={stations} />
      {toolbox >= 0 && <ToolboxBelt station={stations[toolbox]} trackIndex={toolbox} skills={skills} />}
      {signals >= 0 && <Pulsar station={stations[signals]} trackIndex={signals} count={reviews.length} />}
      {launch >= 0 && <LaunchPad station={stations[launch]} trackIndex={launch} liftIndex={liftoff >= 0 ? liftoff : launch + 1} />}
    </>
  );
}
