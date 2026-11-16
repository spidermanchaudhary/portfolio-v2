"use client";

import { useEffect } from "react";
import { flight, useUniverse } from "@/store/universe";
import { audio, sfx, type SfxName } from "@/lib/sfx";

/**
 * Bridges app state to the synth: sound toggle, per-section ambience,
 * scroll-speed wind, and delegated UI sounds via `data-sfx` / `data-cursor`.
 */
export default function AudioDirector() {
  const soundOn = useUniverse((s) => s.soundOn);
  const section = useUniverse((s) => s.activeSection);
  const world = useUniverse((s) => s.activeWorld);

  useEffect(() => {
    try {
      if (localStorage.getItem("sound") === "on") useUniverse.getState().set({ soundOn: true });
    } catch {}
  }, []);

  useEffect(() => {
    if (soundOn) {
      audio.enable();
      audio.setSection(useUniverse.getState().activeSection);
      sfx.toggle();
    } else audio.disable();
    try {
      localStorage.setItem("sound", soundOn ? "on" : "off");
    } catch {}
  }, [soundOn]);

  useEffect(() => {
    audio.setSection(section, section === "worlds" ? world : -1);
  }, [section, world]);

  // Wind follows scroll speed (10Hz is plenty for audio params)
  useEffect(() => {
    if (!soundOn) return;
    const id = window.setInterval(() => audio.setVelocity(flight.velocity), 100);
    return () => window.clearInterval(id);
  }, [soundOn]);

  // Delegated hover/click sounds, differentiated by element type
  useEffect(() => {
    let last: Element | null = null;
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = (e.target as Element).closest("[data-sfx],[data-cursor]");
      if (el === last) return;
      last = el;
      if (!el) return;
      const kind = (el as HTMLElement).dataset.cursor;
      const named = (el as HTMLElement).dataset.sfx;
      if (named === "tick") sfx.tap();
      else if (kind === "scan") sfx.scan();
      else if (kind === "button") sfx.hover();
    };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element).closest<HTMLElement>("[data-sfx]");
      const name = el?.dataset.sfx as SfxName | "none" | undefined;
      if (!name || name === "none" || name === "tick") return;
      if (name in sfx) sfx[name as SfxName]();
    };
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
