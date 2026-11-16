"use client";

import { useEffect, useRef, useState } from "react";
import { useUniverse } from "@/store/universe";
import { site } from "@/data/site";

const MIN_MS = 1700;
const MAX_MS = 4500;

/**
 * Intro. A single point of light and a counter; at 100 the point swells
 * into a glow and the screen dissolves just as the particle name
 * assembles behind it.
 *
 * Server-rendered (paints on the first frame, no JS needed to see it).
 * The counter is time-based up to 90 and only completes once the WebGL
 * scene has compiled (or MAX_MS passes). Any key/click skips; repeat
 * visits in the same session get a short version.
 */
export default function Loader() {
  const sceneReady = useUniverse((s) => s.sceneReady);
  const webgl = useUniverse((s) => s.webgl);
  const reducedMotion = useUniverse((s) => s.reducedMotion);
  const set = useUniverse((s) => s.set);
  const [phase, setPhase] = useState<"boot" | "exit" | "gone">("boot");
  const counter = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const start = useRef(0);
  const ready = useRef(false);

  ready.current = sceneReady || !webgl || reducedMotion;

  useEffect(() => {
    if (phase !== "boot") return;
    if (!start.current) start.current = performance.now();
    const rebooted = document.documentElement.classList.contains("rebooted");
    const min = rebooted ? 300 : !webgl || reducedMotion ? 700 : MIN_MS;
    let raf = 0;
    let shown = 0;

    const exit = () => {
      cancelAnimationFrame(raf);
      if (counter.current) counter.current.textContent = "100";
      if (bar.current) bar.current.style.transform = "scaleX(1)";
      setPhase("exit");
      set({ booted: true });
      try {
        sessionStorage.setItem("booted", "1");
      } catch {}
      window.setTimeout(() => setPhase("gone"), 1100);
    };

    const tick = () => {
      const elapsed = performance.now() - start.current;
      // Time-based to 90, then wait for the scene before finishing
      const timeP = Math.min(1, elapsed / min);
      let target = timeP * 90;
      if (ready.current && timeP >= 1) target = 100;
      if (elapsed > MAX_MS) target = 100;
      shown += (target - shown) * 0.12 + (target > shown ? 0.15 : 0);
      shown = Math.min(shown, target);
      const n = Math.floor(shown);
      if (counter.current) counter.current.textContent = String(n).padStart(3, "0");
      if (bar.current) bar.current.style.transform = `scaleX(${shown / 100})`;
      if (n >= 100) {
        exit();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener("keydown", exit, { once: true });
    window.addEventListener("pointerdown", exit, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", exit);
      window.removeEventListener("pointerdown", exit);
    };
  }, [phase, webgl, reducedMotion, set]);

  if (phase === "gone") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      data-phase={phase}
      className="intro fixed inset-0 z-[200] overflow-hidden bg-void"
    >
      {/* The point of light */}
      <span aria-hidden className="intro-star absolute left-1/2 top-1/2 block h-2 w-2 rounded-full bg-paper" />
      <span aria-hidden className="intro-glow absolute left-1/2 top-1/2 block h-[70vmax] w-[70vmax] rounded-full" />

      {/* Name, role */}
      <div className="intro-meta absolute left-5 top-5 sm:left-8 sm:top-7 lg:left-12">
        <p className="font-display text-lg font-semibold tracking-tight text-paper">{site.name}</p>
        <p className="font-mono text-micro uppercase text-dust">
          {site.role} · {site.affiliation}
        </p>
      </div>

      {/* Counter + progress rule */}
      <div className="intro-meta absolute inset-x-5 bottom-6 sm:inset-x-8 sm:bottom-8 lg:inset-x-12">
        <div className="flex items-end justify-between gap-6">
          <span
            ref={counter}
            className="font-display font-extrabold leading-[0.8] tracking-[-0.03em] text-paper tabular-nums wdth-cond [font-size:clamp(5rem,18vw,15rem)]"
          >
            000
          </span>
          <span className="mb-3 hidden font-mono text-micro uppercase text-faint sm:block">press any key to skip</span>
        </div>
        <span className="mt-4 block h-px w-full bg-line">
          <span ref={bar} className="block h-px w-full origin-left scale-x-0 bg-signal-hi" />
        </span>
      </div>

      <style>{`
        .intro-star{transform:translate(-50%,-50%);box-shadow:0 0 18px 4px rgb(var(--signal-hi)/.9),0 0 60px 12px rgb(var(--signal)/.45);animation:introPulse 1.6s ease-in-out infinite}
        .intro-glow{background:radial-gradient(circle,rgb(var(--paper)/.9) 0%,rgb(var(--signal-hi)/.55) 12%,rgb(var(--signal)/.18) 32%,transparent 62%);transform:translate(-50%,-50%) scale(0);opacity:0}
        .intro[data-phase=exit] .intro-glow{animation:introSwell 1.05s cubic-bezier(.16,1,.3,1) forwards}
        .intro[data-phase=exit] .intro-star{animation:none;opacity:0;transition:opacity .2s}
        .intro[data-phase=exit] .intro-meta{opacity:0;transform:translateY(-12px);transition:opacity .35s ease,transform .5s cubic-bezier(.16,1,.3,1)}
        .intro[data-phase=exit]{background-color:transparent;transition:background-color .7s ease .15s;pointer-events:none}
        .intro{animation:introFailsafe .6s ease 7s forwards}
        @keyframes introPulse{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.6)}}
        @keyframes introSwell{0%{transform:translate(-50%,-50%) scale(0);opacity:1}45%{opacity:.9}100%{transform:translate(-50%,-50%) scale(1.4);opacity:0}}
        @keyframes introFailsafe{to{opacity:0;visibility:hidden}}
        @media (prefers-reduced-motion:reduce){.intro-star{animation:none}.intro[data-phase=exit] .intro-glow{animation:none}}
      `}</style>
    </div>
  );
}
