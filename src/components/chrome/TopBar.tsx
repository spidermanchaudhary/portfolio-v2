"use client";

import Link from "next/link";
import { useUniverse } from "@/store/universe";
import { site } from "@/data/site";

/**
 * Minimal top chrome: wordmark, menu (opens the command palette — on
 * touch devices too) and the sound switch. No classic nav bar.
 */
export default function TopBar() {
  const soundOn = useUniverse((s) => s.soundOn);
  const set = useUniverse((s) => s.set);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex items-start justify-between p-4 sm:p-6">
      <Link
        href="/"
        data-cursor="button"
        className="pointer-events-auto group flex items-baseline gap-2 font-display text-lg font-semibold tracking-tight"
        aria-label={`${site.name} — home`}
      >
        {site.firstName}
        <span className="text-signal-hi transition-transform duration-500 ease-out-expo group-hover:rotate-90">
          *
        </span>
      </Link>

      <nav aria-label="Utilities" className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          data-cursor="button"
          data-sfx="toggle"
          onClick={() => set({ soundOn: !soundOn })}
          aria-pressed={soundOn}
          className="flex h-9 items-center gap-2 border border-line bg-void/60 px-3 font-mono text-micro uppercase text-dust backdrop-blur transition-colors hover:text-paper"
        >
          <SoundBars on={soundOn} />
          <span>Sound {soundOn ? "on" : "off"}</span>
        </button>
        <button
          type="button"
          data-cursor="button"
          data-sfx="open"
          onClick={() => set({ paletteOpen: true })}
          aria-haspopup="dialog"
          className="flex h-9 items-center gap-2 border border-line bg-void/60 px-3 font-mono text-micro uppercase text-dust backdrop-blur transition-colors hover:text-paper"
        >
          <span>Menu</span>
          <kbd className="hidden border border-line px-1.5 text-[10px] text-faint sm:inline">⌘K</kbd>
        </button>
      </nav>
    </header>
  );
}

function SoundBars({ on }: { on: boolean }) {
  return (
    <span aria-hidden className="flex h-3 items-end gap-[2px]">
      {[0.5, 1, 0.7, 0.35].map((h, i) => (
        <span
          key={i}
          className={on ? "w-[2px] origin-bottom bg-signal-hi" : "w-[2px] bg-faint"}
          style={{
            height: on ? `${h * 100}%` : "2px",
            animation: on ? `eq 0.${6 + i}s ease-in-out ${i * 0.1}s infinite alternate` : undefined,
          }}
        />
      ))}
      <style>{`@keyframes eq{from{transform:scaleY(.25)}to{transform:scaleY(1)}}`}</style>
    </span>
  );
}
