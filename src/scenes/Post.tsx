"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { KernelSize } from "postprocessing";
import { FinishEffect } from "@/shaders/finishEffect";
import { flight, useUniverse } from "@/store/universe";
import { warpAmount } from "@/lib/warp";
import { blastAmount } from "@/lib/bang";

/**
 * Post-processing: mipmap bloom + one merged finish pass (velocity warp,
 * chromatic aberration, grain, vignette, blueprint). Skipped entirely on
 * nothing — on the low tier only the finish pass is dropped.
 */
export default function Post() {
  const quality = useUniverse((s) => s.quality);
  const blueprint = useUniverse((s) => s.blueprint);
  const finish = useMemo(() => new FinishEffect(), []);

  useFrame((_, dt) => {
    const u = finish.uniforms;
    u.get("uTime")!.value += dt;
    // Page-jump warp, or the Big Bang blast (radial blur + fringing)
    u.get("uWarp")!.value = Math.max(warpAmount(), blastAmount() * 0.85);
    // Normalised velocity: ~1 at a hard flick of the wheel
    const v = Math.max(-1, Math.min(1, flight.velocity / 60));
    u.get("uVelocity")!.value += (v - u.get("uVelocity")!.value) * Math.min(1, dt * 8);
    const m = u.get("uMouse")!.value;
    m.x += (flight.pointer.x - m.x) * Math.min(1, dt * 4);
    m.y += (flight.pointer.y - m.y) * Math.min(1, dt * 4);
    const b = u.get("uBlueprint")!;
    b.value += ((blueprint ? 1 : 0) - b.value) * Math.min(1, dt * 3);
  });

  // The glow is part of the look, so bloom stays on every tier (same
  // intensity — only its kernel gets cheaper). The low tier drops just the
  // finish pass; the CSS grain overlay covers that.
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        mipmapBlur
        intensity={1.05}
        luminanceThreshold={0.18}
        luminanceSmoothing={0.3}
        kernelSize={quality === "low" ? KernelSize.SMALL : KernelSize.MEDIUM}
        radius={0.72}
      />
      {quality === "low" ? <></> : <primitive object={finish} />}
    </EffectComposer>
  );
}
