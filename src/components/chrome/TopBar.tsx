"use client";

import Link from "next/link";
import { useUniverse } from "@/store/universe";
import { site } from "@/data/site";

/**
 * Minimal top chrome: wordmark and menu (opens the command palette — on
 * touch devices too). No classic nav bar.
 */
export default function TopBar() {
  const set = useUniverse((s) => s.set);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex items-start justify-between bg-gradient-to-b from-void via-void/70 to-transparent p-4 pb-8 sm:bg-none sm:p-6">
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
