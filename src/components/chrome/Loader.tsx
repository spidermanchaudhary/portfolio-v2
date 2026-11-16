"use client";

import { useEffect, useRef, useState } from "react";
import { useUniverse } from "@/store/universe";
import { site } from "@/data/site";

const MIN_MS = 1400;
const MAX_MS = 4500;

/**
 * Intro: the wordmark above a thin line of light that grows outward while
 * the scene loads. When ready, the line reaches the edges and the black
 * screen parts along it — top half up, bottom half down — revealing the
 * universe as the particle name assembles.
 *
 * Progress eases asymptotically (never visibly stalls), and only completes
 * once the WebGL scene has compiled or MAX_MS passes. Server-rendered so it
 * paints on the first frame; any key/click skips; short on repeat visits.
 */
export default function Loader() {
  const sceneReady = useUniverse((s) => s.sceneReady);
  const webgl = useUniverse((s) => s.webgl);
  const reducedMotion = useUniverse((s) => s.reducedMotion);
  const set = useUniverse((s) => s.set);
  const [phase, setPhase] = useState<"boot" | "open" | "gone">("boot");
  const line = useRef<HTMLSpanElement>(null);
  const start = useRef(0);
  const ready = useRef(false);

  ready.current = sceneReady || !webgl || reducedMotion;

  useEffect(() => {
    if (phase !== "boot") return;
    if (!start.current) start.current = performance.now();
    const rebooted = document.documentElement.classList.contains("rebooted");
    const min = rebooted ? 250 : !webgl || reducedMotion ? 600 : MIN_MS;
    let raf = 0;
    let shown = 0;
    let finishing = false;

    const open = () => {
      cancelAnimationFrame(raf);
      if (line.current) line.current.style.transform = "scaleX(1)";
      setPhase("open");
      set({ booted: true });
      try {
        sessionStorage.setItem("booted", "1");
      } catch {}
      window.setTimeout(() => setPhase("gone"), 1400);
    };

    const tick = () => {
      const elapsed = performance.now() - start.current;
      const canFinish = (ready.current && elapsed >= min) || elapsed > MAX_MS;
      if (canFinish) finishing = true;
      // Asymptotic approach to 0.82 while loading; then glide to 1
      const target = finishing ? 1 : 0.82 * (1 - Math.exp(-elapsed / 900));
      shown += (target - shown) * (finishing ? 0.14 : 0.08);
      if (line.current) line.current.style.transform = `scaleX(${shown.toFixed(4)})`;
      if (finishing && shown > 0.995) {
        // Brief hold so the completed line registers before the split
        window.setTimeout(open, 180);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const skip = () => {
      finishing = true;
    };
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [phase, webgl, reducedMotion, set]);

  if (phase === "gone") return null;

  return (
    <div role="status" aria-live="polite" aria-label="Loading" data-phase={phase} className="intro fixed inset-0 z-[200]">
      <span aria-hidden className="intro-lid intro-top absolute inset-x-0 top-0 h-1/2 bg-void" />
      <span aria-hidden className="intro-lid intro-bottom absolute inset-x-0 bottom-0 h-1/2 bg-void" />

      <div className="intro-mark absolute inset-x-0 top-1/2 flex -translate-y-[calc(100%+18px)] justify-center">
        <p className="flex items-baseline gap-1.5 font-display text-xl font-semibold tracking-tight text-paper">
          {site.firstName}
          <span aria-hidden className="intro-star inline-block text-signal-hi">
            *
          </span>
        </p>
      </div>

      <span aria-hidden className="intro-line absolute inset-x-0 top-1/2 block h-px -translate-y-1/2">
        <span ref={line} className="block h-full w-full origin-center scale-x-0 bg-signal-hi" />
      </span>

      <style>{`
        .intro-line span{box-shadow:0 0 12px 1px rgb(var(--signal)/.8)}
        .intro-star{animation:introSpin 2.4s linear infinite}
        .intro-lid{transition:transform 1.15s cubic-bezier(.76,0,.24,1)}
        .intro[data-phase=open] .intro-top{transform:translateY(-100%)}
        .intro[data-phase=open] .intro-bottom{transform:translateY(100%)}
        .intro[data-phase=open] .intro-mark{opacity:0;transition:opacity .3s ease}
        .intro[data-phase=open] .intro-line{opacity:0;transition:opacity .5s ease .25s}
        .intro[data-phase=open]{pointer-events:none}
        .intro{animation:introFailsafe .6s ease 7s forwards}
        @keyframes introSpin{to{transform:rotate(360deg)}}
        @keyframes introFailsafe{to{opacity:0;visibility:hidden}}
        @media (prefers-reduced-motion:reduce){
          .intro-star{animation:none}
          .intro-lid{transition:none}
          .intro[data-phase=open]{opacity:0;transition:opacity .3s ease}
        }
      `}</style>
    </div>
  );
}
