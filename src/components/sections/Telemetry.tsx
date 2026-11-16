"use client";

import { useEffect, useRef } from "react";
import { flight } from "@/store/universe";

const PHASES: [number, string][] = [
  [0, "on the pad"],
  [0.005, "terminal count"],
  [0.12, "ignition"],
  [0.22, "liftoff"],
  [0.4, "max-q"],
  [0.62, "booster sep"],
  [0.82, "upper stage"],
  [0.99, "out of sight"],
];

/**
 * Mission readout for the scrubbed launch. Written straight to the DOM on
 * every animation frame (no React renders); decorative, so aria-hidden.
 */
export default function Telemetry() {
  const clock = useRef<HTMLSpanElement>(null);
  const phase = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const hint = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastPhase = "";
    const tick = () => {
      const p = flight.launchP;
      // T-minus 10 s through the countdown, then mission elapsed time
      const tSec = p < 0.12 ? -10 * (1 - p / 0.12) : ((p - 0.12) / 0.88) * 150;
      const sign = tSec < 0 ? "T−" : "T+";
      const s = Math.abs(tSec);
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(Math.floor(s % 60)).padStart(2, "0");
      if (clock.current) clock.current.textContent = `${sign}${mm}:${ss}`;
      let name = PHASES[0][1];
      for (const [at, label] of PHASES) if (p >= at) name = label;
      if (name !== lastPhase && phase.current) {
        phase.current.textContent = name;
        lastPhase = name;
      }
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      if (hint.current) {
        const h = p >= 0.99 ? "scroll up to rewind" : p >= 0.22 ? "climbing — keep going" : "keep scrolling to launch";
        if (hint.current.textContent !== h) hint.current.textContent = h;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div aria-hidden className="flex w-full max-w-sm flex-col gap-2 font-mono text-micro uppercase">
      <div className="flex items-baseline justify-between">
        <span ref={clock} className="text-2xl tracking-[0.08em] text-paper tabular-nums">
          T−00:10
        </span>
        <span ref={phase} className="text-signal-hi">
          on the pad
        </span>
      </div>
      <span className="relative block h-px w-full bg-line">
        <span ref={bar} className="absolute inset-0 origin-left scale-x-0 bg-signal-hi" />
      </span>
      <span ref={hint} className="text-faint">
        keep scrolling to launch
      </span>
    </div>
  );
}
