"use client";

import { useEffect, useRef, useState } from "react";
import { useUniverse } from "@/store/universe";
import { triggerBang } from "@/lib/bang";

const MIN_MS = 1300;
const MAX_MS = 4500;

/**
 * Intro: the Big Bang. While the scene loads there is only a singularity —
 * one trembling point of light in the dark, slowly gathering energy. When
 * the scene is ready it flares and the overlay vanishes; the 3D scene takes
 * over and every particle and star bursts out from that same point, cooling
 * from white to blue and settling into the name.
 *
 * Server-rendered (paints on the first frame). Any key/click triggers it
 * early; short on repeat visits; without WebGL it simply fades.
 */
export default function Loader() {
  const sceneReady = useUniverse((s) => s.sceneReady);
  const webgl = useUniverse((s) => s.webgl);
  const reducedMotion = useUniverse((s) => s.reducedMotion);
  const set = useUniverse((s) => s.set);
  const [phase, setPhase] = useState<"wait" | "bang" | "gone">("wait");
  const charge = useRef<HTMLSpanElement>(null);
  const start = useRef(0);
  const ready = useRef(false);

  ready.current = sceneReady || !webgl || reducedMotion;

  useEffect(() => {
    if (phase !== "wait") return;
    if (!start.current) start.current = performance.now();
    const rebooted = document.documentElement.classList.contains("rebooted");
    const min = rebooted ? 250 : !webgl || reducedMotion ? 600 : MIN_MS;
    let raf = 0;
    let skipped = false;

    const bang = () => {
      cancelAnimationFrame(raf);
      triggerBang();
      setPhase("bang");
      set({ booted: true });
      try {
        sessionStorage.setItem("booted", "1");
      } catch {}
      window.setTimeout(() => setPhase("gone"), 900);
    };

    const tick = () => {
      const elapsed = performance.now() - start.current;
      // The singularity slowly gathers energy (grows a little brighter)
      const e = 1 - Math.exp(-elapsed / 1400);
      if (charge.current) charge.current.style.setProperty("--e", e.toFixed(3));
      const done = (ready.current && (elapsed >= min || skipped)) || elapsed > MAX_MS;
      if (done) {
        bang();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const skip = () => {
      skipped = true;
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
    <div role="status" aria-live="polite" aria-label="Loading" data-phase={phase} className="intro fixed inset-0 z-[200] bg-void">
      <span ref={charge} aria-hidden className="intro-core absolute left-1/2 top-1/2 block h-[6px] w-[6px] rounded-full bg-paper" />
      <span aria-hidden className="intro-halo absolute left-1/2 top-1/2 block h-[44vmin] w-[44vmin] rounded-full" />
      <span aria-hidden className="intro-flash absolute left-1/2 top-1/2 block h-[160vmax] w-[160vmax] rounded-full" />

      <style>{`
        .intro-core{--e:0;transform:translate(-50%,-50%) scale(calc(.6 + var(--e) * .8));
          box-shadow:0 0 calc(8px + var(--e) * 22px) calc(1px + var(--e) * 4px) rgb(var(--paper)/.9),0 0 calc(30px + var(--e) * 70px) calc(4px + var(--e) * 16px) rgb(var(--signal)/.55);
          animation:introTremble .11s steps(2) infinite}
        .intro-halo{transform:translate(-50%,-50%);background:radial-gradient(circle,rgb(var(--signal)/.10),transparent 60%);animation:introBreathe 2.2s ease-in-out infinite}
        .intro-flash{transform:translate(-50%,-50%) scale(0);opacity:0;
          background:radial-gradient(circle,rgb(255 255 255/.95) 0%,rgb(var(--signal-hi)/.5) 8%,rgb(var(--signal)/.12) 22%,transparent 45%)}
        .intro[data-phase=bang]{background-color:transparent;transition:background-color .35s ease-out;pointer-events:none}
        .intro[data-phase=bang] .intro-flash{animation:introFlash .85s cubic-bezier(.16,1,.3,1) forwards}
        .intro[data-phase=bang] .intro-core,.intro[data-phase=bang] .intro-halo{opacity:0;transition:opacity .15s}
        .intro{animation:introFailsafe .6s ease 7s forwards}
        @keyframes introTremble{0%{translate:0 0}50%{translate:.4px -.3px}}
        @keyframes introBreathe{0%,100%{opacity:.6}50%{opacity:1}}
        @keyframes introFlash{0%{transform:translate(-50%,-50%) scale(0);opacity:1}30%{opacity:.85}100%{transform:translate(-50%,-50%) scale(1);opacity:0}}
        @keyframes introFailsafe{to{opacity:0;visibility:hidden}}
        @media (prefers-reduced-motion:reduce){.intro-core,.intro-halo{animation:none}.intro[data-phase=bang] .intro-flash{animation:none}}
      `}</style>
    </div>
  );
}
