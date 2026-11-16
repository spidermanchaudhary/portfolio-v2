"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { flight, useUniverse } from "@/store/universe";

/**
 * Easter egg: click the black hole to play "Cornfield Chase" (Hans Zimmer,
 * Interstellar). The track is streamed through Apple Music's official
 * embed — no audio is hosted here. Non-subscribers hear Apple's preview;
 * the card links out to the full track.
 *
 * Apple Music catalogue IDs (verified via the iTunes lookup API):
 *   album 1533983552 — Interstellar (Original Motion Picture Soundtrack) [Expanded]
 *   track 1533984393 — Cornfield Chase
 */
const EMBED = "https://embed.music.apple.com/us/album/cornfield-chase/1533983552?i=1533984393&theme=dark";
const APPLE = "https://music.apple.com/us/album/cornfield-chase/1533983552?i=1533984393";
const SPOTIFY = "https://open.spotify.com/search/Cornfield%20Chase%20Hans%20Zimmer";

export default function Soundtrack() {
  const open = useUniverse((s) => s.soundtrackOpen);
  const set = useUniverse((s) => s.set);
  const hotspot = useRef<HTMLButtonElement>(null);

  // The canvas never takes pointer events, so a DOM button follows the
  // black hole around the screen (position published by the 3D scene).
  useEffect(() => {
    let raf = 0;
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
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <button
        ref={hotspot}
        type="button"
        onClick={() => set({ soundtrackOpen: true })}
        aria-label="Easter egg: play Cornfield Chase from Interstellar"
        data-cursor="button"
        className="egg-hole group fixed left-0 top-0 z-[20] hidden rounded-full"
      >
        <span className="pointer-events-none absolute bottom-[8%] right-[4%] flex items-center gap-2 whitespace-nowrap font-mono text-micro uppercase text-dust transition-colors group-hover:text-paper">
          <span aria-hidden className="egg-note text-signal-hi">♪</span>
          <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
            play cornfield chase
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
            className="fixed bottom-4 left-4 right-4 z-[120] border border-line bg-hull/95 p-3 backdrop-blur-md sm:left-auto sm:right-6 sm:w-[380px]"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-micro uppercase text-signal-hi">♪ Interstellar · Hans Zimmer</p>
              <button
                type="button"
                onClick={() => set({ soundtrackOpen: false })}
                aria-label="Close player"
                className="font-mono text-micro uppercase text-dust hover:text-paper"
              >
                close
              </button>
            </div>
            <iframe
              title="Cornfield Chase — Hans Zimmer (Apple Music)"
              src={EMBED}
              allow="autoplay *; encrypted-media *; clipboard-write"
              sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
              loading="lazy"
              className="h-[175px] w-full overflow-hidden rounded-md border-0 bg-transparent"
            />
            <p className="mt-2 flex gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-faint">
              <span>full track:</span>
              <a href={APPLE} target="_blank" rel="noopener" className="link-ink hover:text-paper">
                Apple Music ↗
              </a>
              <a href={SPOTIFY} target="_blank" rel="noopener" className="link-ink hover:text-paper">
                Spotify ↗
              </a>
            </p>
          </motion.aside>
        )}
      </AnimatePresence>

      <style>{`
        .egg-hole{cursor:pointer}
        .egg-hole:focus-visible{outline-offset:-6px}
        .egg-note{animation:eggNote 2.4s ease-in-out infinite}
        @keyframes eggNote{0%,100%{opacity:.45;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
      `}</style>
    </>
  );
}
