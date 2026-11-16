"use client";

import { useEffect, useRef, useState } from "react";
import { useUniverse } from "@/store/universe";
import { triggerBang } from "@/lib/bang";

const LINE = "It all started with a big bang.";
const READ_MS = 2000; // the line holds for 2s
const COLLAPSE_MS = 320; // line collapses into a point
const MAX_MS = 4000;

/**
 * Intro (~4s total):
 *   1. "It all started with a big bang." fades in, word by word
 *   2. the line collapses into a single point of light
 *   3. the point detonates — the WebGL scene takes over: particles and
 *      stars burst out with one soft shockwave and settle into the name
 *
 * Server-rendered so step 1 paints immediately. Step 2 waits for the scene
 * (or MAX_MS). Any key/click skips ahead; repeat visits skip the line.
 */
export default function Loader() {
  const sceneReady = useUniverse((s) => s.sceneReady);
  const webgl = useUniverse((s) => s.webgl);
  const reducedMotion = useUniverse((s) => s.reducedMotion);
  const set = useUniverse((s) => s.set);
  const [phase, setPhase] = useState<"line" | "collapse" | "bang" | "gone">("line");
  const start = useRef(0);
  const ready = useRef(false);

  ready.current = sceneReady || !webgl || reducedMotion;

  useEffect(() => {
    if (phase !== "line") return;
    if (!start.current) start.current = performance.now();
    const rebooted = document.documentElement.classList.contains("rebooted");
    const read = rebooted ? 150 : READ_MS;
    let skipped = false;
    let raf = 0;

    const tick = () => {
      const elapsed = performance.now() - start.current;
      if ((ready.current && (elapsed >= read || skipped)) || elapsed > MAX_MS) {
        setPhase("collapse");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const skip = () => (skipped = true);
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "collapse") {
      const id = window.setTimeout(() => {
        triggerBang();
        set({ booted: true });
        try {
          sessionStorage.setItem("booted", "1");
        } catch {}
        setPhase("bang");
      }, COLLAPSE_MS);
      return () => window.clearTimeout(id);
    }
    if (phase === "bang") {
      const id = window.setTimeout(() => setPhase("gone"), 700);
      return () => window.clearTimeout(id);
    }
  }, [phase, set]);

  if (phase === "gone") return null;

  return (
    <div role="status" aria-live="polite" data-phase={phase} className="intro fixed inset-0 z-[200] flex items-center justify-center bg-void px-6">
      <p className="intro-line text-center font-display text-[clamp(1.25rem,3vw,2.25rem)] font-medium tracking-[-0.01em] text-paper">
        {LINE.split(" ").map((word, i) => (
          <span key={i} className="intro-word inline-block" style={{ animationDelay: `${120 + i * 95}ms` }}>
            {word}
            {" "}
          </span>
        ))}
      </p>
      <span aria-hidden className="intro-point absolute left-1/2 top-1/2 block h-[6px] w-[6px] rounded-full bg-paper" />

      <style>{`
        .intro-word{opacity:0;filter:blur(6px);transform:translateY(6px);animation:introWord .7s cubic-bezier(.16,1,.3,1) forwards}
        .intro-line{transition:transform ${COLLAPSE_MS}ms cubic-bezier(.7,0,.84,0),opacity ${COLLAPSE_MS}ms ease-in,filter ${COLLAPSE_MS}ms ease-in}
        .intro-point{transform:translate(-50%,-50%) scale(0);opacity:0;box-shadow:0 0 14px 3px rgb(var(--paper)/.9),0 0 50px 12px rgb(var(--signal)/.6)}
        .intro[data-phase=collapse] .intro-line{transform:scale(.02,.3);opacity:0;filter:blur(4px)}
        .intro[data-phase=collapse] .intro-point{opacity:1;transform:translate(-50%,-50%) scale(1.3);transition:transform ${COLLAPSE_MS}ms cubic-bezier(.16,1,.3,1) ${COLLAPSE_MS * 0.5}ms,opacity .15s ease ${COLLAPSE_MS * 0.5}ms}
        .intro[data-phase=bang]{background-color:transparent;transition:background-color .25s ease-out;pointer-events:none}
        .intro[data-phase=bang] .intro-line{opacity:0}
        .intro[data-phase=bang] .intro-point{opacity:0;transform:translate(-50%,-50%) scale(4);transition:transform .25s ease-out,opacity .25s ease-out}
        .intro{animation:introFailsafe .5s ease 6s forwards}
        html.rebooted .intro-word{animation-duration:.01s;animation-delay:0s!important}
        @keyframes introWord{to{opacity:1;filter:blur(0);transform:none}}
        @keyframes introFailsafe{to{opacity:0;visibility:hidden}}
        @media (prefers-reduced-motion:reduce){.intro-word{animation:none;opacity:1;filter:none;transform:none}}
      `}</style>
    </div>
  );
}
