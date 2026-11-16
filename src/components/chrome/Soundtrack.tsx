"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { flight, useUniverse } from "@/store/universe";

/**
 * Easter egg: click the black hole to play "Cornfield Chase" (Hans Zimmer,
 * Interstellar) from /public/audio/cornfield-chase.mp3.
 *
 * The file is only fetched on first click (preload="none"). While it plays,
 * a Web Audio analyser publishes the music level to `flight.music`, and the
 * black hole's disk spins up and breathes with it.
 */
const SRC = "/audio/cornfield-chase.mp3";

const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");

export default function Soundtrack() {
  const open = useUniverse((s) => s.soundtrackOpen);
  const set = useUniverse((s) => s.set);
  const hotspot = useRef<HTMLButtonElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // The canvas never takes pointer events, so a DOM button follows the
  // black hole around the screen (position published by the 3D scene).
  // The same loop samples the music level for the black hole.
  useEffect(() => {
    let raf = 0;
    const buf = new Uint8Array(64);
    const tick = () => {
      const el = hotspot.current;
      const h = flight.hole;
      if (el) {
        const show = h.on && !useUniverse.getState().focusSlug;
        el.style.display = show ? "block" : "none";
        if (show) {
          const d = Math.max(56, h.r * 2);
          el.style.width = el.style.height = `${d}px`;
          el.style.transform = `translate(${h.x - d / 2}px, ${h.y - d / 2}px)`;
        }
      }
      const a = analyser.current;
      if (a && audio.current && !audio.current.paused) {
        a.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < 24; i++) sum += buf[i];
        flight.music += (sum / (24 * 255) - flight.music) * 0.2;
      } else flight.music *= 0.92;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Wire the analyser once, on the first user-initiated play
  const ensureAnalyser = () => {
    if (analyser.current || !audio.current) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const src = ctx.createMediaElementSource(audio.current);
      const an = ctx.createAnalyser();
      an.fftSize = 128;
      src.connect(an);
      an.connect(ctx.destination);
      analyser.current = an;
      if (ctx.state === "suspended") ctx.resume();
    } catch {
      /* visual sync is optional — playback still works */
    }
  };

  const play = () => {
    const el = audio.current;
    if (!el) return;
    ensureAnalyser();
    if (el.ended) el.currentTime = 0;
    el.play().catch(() => setPlaying(false));
  };

  const pause = () => audio.current?.pause();

  const openPlayer = () => {
    set({ soundtrackOpen: true });
    play(); // same click = user gesture, so autoplay is allowed
  };

  const close = () => {
    pause();
    set({ soundtrackOpen: false });
  };

  // ⌘K "Play Cornfield Chase" opens the card without a click on the hole
  useEffect(() => {
    if (open && audio.current?.paused && audio.current.currentTime === 0) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    useUniverse.getState().set({ soundtrackPlaying: playing });
  }, [playing]);

  const progress = duration ? time / duration : 0;

  return (
    <>
      <audio
        ref={audio}
        src={SRC}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />

      <button
        ref={hotspot}
        type="button"
        onClick={openPlayer}
        aria-label="Easter egg: play Cornfield Chase from Interstellar"
        data-cursor="button"
        className="egg-hole group fixed left-0 top-0 z-[20] hidden rounded-full"
      >
        <span className="pointer-events-none absolute bottom-[8%] right-[4%] flex items-center gap-2 whitespace-nowrap font-mono text-micro uppercase text-dust transition-colors group-hover:text-paper">
          <span aria-hidden className="egg-note text-signal-hi">♪</span>
          <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            {playing ? "now playing" : "play cornfield chase"}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            aria-label="Now playing"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="ticks fixed bottom-4 left-4 right-4 z-[120] border border-line bg-hull/95 p-4 backdrop-blur-md sm:left-auto sm:right-6 sm:w-[360px]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-micro uppercase text-signal-hi">♪ Interstellar</p>
                <p className="mt-1 font-display text-xl font-bold tracking-tight text-paper">Cornfield Chase</p>
                <p className="font-mono text-micro uppercase text-dust">Hans Zimmer</p>
              </div>
              <button type="button" onClick={close} aria-label="Close player" className="font-mono text-micro uppercase text-dust hover:text-paper">
                close
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <button
                type="button"
                onClick={playing ? pause : play}
                aria-label={playing ? "Pause" : "Play"}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper text-void transition-colors hover:bg-signal-hi"
              >
                {playing ? (
                  <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
                    <rect x="3" y="2" width="3.5" height="12" fill="currentColor" />
                    <rect x="9.5" y="2" width="3.5" height="12" fill="currentColor" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" className="ml-0.5 h-4 w-4" aria-hidden>
                    <path d="M3 2 L14 8 L3 14 Z" fill="currentColor" />
                  </svg>
                )}
              </button>

              <div className="flex-1">
                <div className="relative h-4">
                  <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
                  <span
                    className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-signal-hi shadow-[0_0_8px_rgb(var(--signal))]"
                    style={{ width: `${progress * 100}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={time}
                    onChange={(e) => {
                      if (audio.current) audio.current.currentTime = Number(e.target.value);
                    }}
                    aria-label="Seek"
                    className="egg-seek absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
                  />
                </div>
                <p className="mt-1 flex justify-between font-mono text-[10px] tracking-[0.12em] text-faint tabular-nums">
                  <span>{fmt(time)}</span>
                  <span>{fmt(duration)}</span>
                </p>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <style>{`
        .egg-hole{cursor:pointer}
        .egg-hole:focus-visible{outline-offset:-6px}
        .egg-note{animation:eggNote 2.4s ease-in-out infinite}
        @keyframes eggNote{0%,100%{opacity:.45;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
        .egg-seek::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:rgb(var(--paper))}
        .egg-seek::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:rgb(var(--paper))}
        .egg-seek::-webkit-slider-runnable-track{background:transparent}
      `}</style>
    </>
  );
}
