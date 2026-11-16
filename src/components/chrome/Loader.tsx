"use client";

import { useEffect, useRef, useState } from "react";
import { useUniverse } from "@/store/universe";
import { useUniverseData } from "@/hooks/useUniverseData";
import { PARTICLES } from "@/lib/capabilities";
import { sfx } from "@/lib/sfx";

const MIN_MS = 1500;
const MAX_MS = 4200;

/**
 * Boot sequence. Server-rendered and CSS-animated so it paints on the
 * first frame (no JS needed to see it). Exits when the WebGL scene has
 * compiled — or after MAX_MS, whichever comes first. Any key or click
 * skips it. Repeat visits in the same session get a 400ms blink.
 */
export default function Loader() {
  const { projects, skills } = useUniverseData();
  const quality = useUniverse((s) => s.quality);
  const sceneReady = useUniverse((s) => s.sceneReady);
  const webgl = useUniverse((s) => s.webgl);
  const reducedMotion = useUniverse((s) => s.reducedMotion);
  const set = useUniverse((s) => s.set);
  const [phase, setPhase] = useState<"boot" | "exit" | "gone">("boot");
  const [particles, setParticles] = useState<string>("—");
  const start = useRef(0);

  useEffect(() => {
    start.current = performance.now();
    setParticles(PARTICLES[quality].toLocaleString("en-US"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "boot") return;
    const rebooted = document.documentElement.classList.contains("rebooted");
    const lite = !webgl || reducedMotion;
    const ready = sceneReady || lite;
    const min = rebooted ? 350 : lite ? 700 : MIN_MS;
    const elapsed = performance.now() - start.current;

    const exit = () => {
      setPhase("exit");
      set({ booted: true });
      try {
        sessionStorage.setItem("booted", "1");
      } catch {}
      window.setTimeout(() => setPhase("gone"), 900);
    };

    const skip = () => exit();
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });

    const timer = window.setTimeout(exit, ready ? Math.max(0, min - elapsed) : Math.max(0, MAX_MS - elapsed));
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [phase, sceneReady, webgl, reducedMotion, set]);

  useEffect(() => {
    if (phase === "exit") sfx.ignite();
  }, [phase]);

  if (phase === "gone") return null;

  const lines: [string, string][] = [
    ["mount /data/projects", `${projects.length} shipped`],
    ["mount /data/toolbox", `${skills.length} instruments`],
    ["compile shaders", "curl · fresnel · grain"],
    ["seed particle field", particles],
  ];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading the universe"
      data-phase={phase}
      className="boot fixed inset-0 z-[200] flex items-end bg-void px-5 pb-10 font-mono text-[11px] uppercase tracking-[0.14em] text-dust sm:px-8 sm:text-xs lg:px-12"
    >
      <div className="w-full max-w-xl">
        <p className="boot-line mb-6 text-paper" style={{ ["--d" as string]: "0ms" }}>
          sujal/os <span className="text-faint">— cold boot</span>
        </p>
        <ul className="space-y-1.5">
          {lines.map(([k, v], i) => (
            <li key={k} className="boot-line flex gap-3" style={{ ["--d" as string]: `${180 + i * 170}ms` }}>
              <span className="text-signal-hi">[ ok ]</span>
              <span className="whitespace-nowrap">{k}</span>
              <span aria-hidden className="min-w-4 flex-1 overflow-hidden whitespace-nowrap text-faint">
                ................................................................
              </span>
              <span className="whitespace-nowrap text-paper">{v}</span>
            </li>
          ))}
          <li className="boot-line flex gap-3 text-paper" style={{ ["--d" as string]: "900ms" }}>
            <span className="text-signal-hi">{phase === "exit" ? "[ ok ]" : "[ .. ]"}</span>
            <span>ignition</span>
            <span aria-hidden className="animate-blink">_</span>
          </li>
        </ul>
        <div className="boot-line mt-6 h-px w-full bg-line" style={{ ["--d" as string]: "0ms" }}>
          <div className="boot-bar h-px bg-signal-hi" />
        </div>
        <p className="boot-line mt-3 text-faint" style={{ ["--d" as string]: "1100ms" }}>
          press any key to skip
        </p>
      </div>
      <style>{`
        .boot-line{opacity:0;animation:bootIn .01s steps(1) var(--d) forwards}
        .boot-bar{width:0;animation:bootBar 1.4s cubic-bezier(.65,0,.35,1) .1s forwards}
        .boot{animation:bootFailsafe .6s ease 6s forwards}
        .boot[data-phase=exit]{animation:bootOut .85s cubic-bezier(.76,0,.24,1) forwards}
        html.rebooted .boot-line{animation-delay:0s}
        html.rebooted .boot-bar{animation-duration:.35s}
        @keyframes bootIn{to{opacity:1}}
        @keyframes bootBar{to{width:100%}}
        @keyframes bootOut{to{clip-path:inset(0 0 100% 0)}}
        @keyframes bootFailsafe{to{opacity:0;visibility:hidden}}
      `}</style>
    </div>
  );
}
