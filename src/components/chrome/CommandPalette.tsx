"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useUniverse } from "@/store/universe";
import { useUniverseData } from "@/hooks/useUniverseData";
import { contactDetails, sections, site, socials } from "@/data/site";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  group: "Go to" | "Projects" | "Actions" | "Elsewhere";
  label: string;
  hint?: string;
  run: () => void;
}

/**
 * The site menu. ⌘K / Ctrl+K (or the Menu button) opens it; on phones it's
 * a full-screen sheet. Type to filter, ↑/↓ to move, Enter to go, Esc to close.
 * Built as an ARIA combobox + listbox inside a modal dialog.
 */
export default function CommandPalette() {
  const open = useUniverse((s) => s.paletteOpen);
  const set = useUniverse((s) => s.set);
  const { projects } = useUniverseData();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const close = useCallback(() => set({ paletteOpen: false }), [set]);

  /** Scroll to a home-page anchor, from anywhere on the site */
  const goTo = useCallback(
    (id: string) => {
      close();
      if (pathname !== "/") {
        useUniverse.getState().set({ focusSlug: null });
        router.push(`/#${id}`, { scroll: false });
        return;
      }
      const el = document.getElementById(id);
      if (!el) return;
      const top = id === "top" ? 0 : el.getBoundingClientRect().top + window.scrollY;
      window.setTimeout(() => {
        if (window.__lenis) window.__lenis.scrollTo(top, { duration: 1.6 });
        else window.scrollTo({ top, behavior: useUniverse.getState().reducedMotion ? "auto" : "smooth" });
      }, 60);
    },
    [close, pathname, router]
  );

  const items = useMemo<Item[]>(() => {
    const email = contactDetails.find((d) => d.label === "Email")?.copy ?? "";
    return [
      ...sections.map((s) => ({ id: `go-${s.id}`, group: "Go to" as const, label: s.label, hint: s.hint, run: () => goTo(s.id) })),
      ...projects.map((p) => ({
        id: `p-${p.slug}`,
        group: "Projects" as const,
        label: p.name,
        hint: p.tagline,
        run: () => {
          close();
          router.push(`/work/${p.slug}`);
        },
      })),
      {
        id: "copy-email",
        group: "Actions" as const,
        label: "Copy email",
        hint: email,
        run: async () => {
          try {
            await navigator.clipboard.writeText(email);
            setToast("Email copied");
          } catch {
            setToast(email);
          }
        },
      },
      {
        id: "cornfield",
        group: "Actions" as const,
        label: "Play Cornfield Chase",
        hint: "or click the black hole",
        run: () => {
          close();
          set({ soundtrackOpen: true });
        },
      },
      {
        id: "blog",
        group: "Elsewhere" as const,
        label: "Blog",
        hint: site.blog.replace("https://", ""),
        run: () => {
          close();
          window.open(site.blog, "_blank", "noopener");
        },
      },
      ...socials.map((s) => ({
        id: `s-${s.label}`,
        group: "Elsewhere" as const,
        label: s.label,
        run: () => {
          close();
          window.open(s.href, "_blank", "noopener");
        },
      })),
    ];
  }, [projects, goTo, close, router, set]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.label} ${i.hint ?? ""} ${i.group}`.toLowerCase().includes(q));
  }, [items, query]);

  // Global shortcut: ⌘K / Ctrl+K toggles, "/" opens when not typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, [contenteditable=true]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        set({ paletteOpen: !useUniverse.getState().paletteOpen });
      } else if (e.key === "/" && !typing && !useUniverse.getState().paletteOpen) {
        e.preventDefault();
        set({ paletteOpen: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set]);

  // Open/close side effects: focus, scroll lock, restore focus
  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement as HTMLElement;
      setQuery("");
      setActive(0);
      setToast(null);
      window.__lenis?.stop();
      document.documentElement.style.overflow = "hidden";
      requestAnimationFrame(() => input.current?.focus());
    } else {
      window.__lenis?.start();
      document.documentElement.style.overflow = "";
      lastFocus.current?.focus?.();
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  // Keep the active option in view
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (filtered.length ? (a + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (filtered.length ? (a - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    } else if (e.key === "Tab") {
      // Single focusable control → keep focus inside the dialog
      e.preventDefault();
    }
  };

  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-stretch justify-center sm:items-start sm:pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={close} className="absolute inset-0 bg-void/70 backdrop-blur-sm" />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            onKeyDown={onKeyDown}
            className="relative flex w-full flex-col border-line bg-hull sm:max-h-[70vh] sm:max-w-xl sm:border"
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 border-b border-line px-4 pt-[max(env(safe-area-inset-top),0px)] sm:pt-0">
              <span aria-hidden className="font-mono text-signal-hi">›</span>
              <input
                ref={input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Where to?"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={filtered[active] ? `opt-${filtered[active].id}` : undefined}
                aria-autocomplete="list"
                className="h-14 flex-1 bg-transparent font-display text-lg text-paper placeholder:text-faint focus:outline-none focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={close}
                className="font-mono text-micro uppercase text-dust hover:text-paper"
                aria-label="Close menu"
                tabIndex={-1}
              >
                <span className="hidden sm:inline">esc</span>
                <span className="sm:hidden">close</span>
              </button>
            </div>

            <ul ref={list} id="palette-list" role="listbox" aria-label="Results" className="flex-1 overflow-y-auto overscroll-contain py-2">
              {filtered.length === 0 && <li className="px-4 py-6 font-mono text-micro uppercase text-dust">No matches</li>}
              {filtered.map((item, i) => {
                const header = item.group !== lastGroup ? item.group : null;
                lastGroup = item.group;
                return (
                  <li key={item.id} role="presentation">
                    {header && (
                      <p role="presentation" className="px-4 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
                        {header}
                      </p>
                    )}
                    <div
                      id={`opt-${item.id}`}
                      role="option"
                      aria-selected={i === active}
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => item.run()}
                      className={cn(
                        "mx-2 flex cursor-pointer items-baseline justify-between gap-4 px-3 py-3 sm:py-2.5",
                        i === active ? "bg-signal/15 text-paper" : "text-paper/80"
                      )}
                    >
                      <span className="flex items-baseline gap-3">
                        <span aria-hidden className={cn("font-mono text-xs", i === active ? "text-signal-hi" : "text-transparent")}>
                          →
                        </span>
                        <span className="font-display text-base">{item.label}</span>
                      </span>
                      {item.hint && <span className="hidden truncate font-mono text-[11px] text-dust sm:block sm:max-w-[55%]">{item.hint}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden items-center justify-between border-t border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-faint sm:flex">
              <span>↑↓ move · ↵ open · esc close</span>
              <span aria-live="polite" className="text-signal-hi">
                {toast}
              </span>
            </div>
            <p aria-live="polite" className="px-4 pb-[max(env(safe-area-inset-bottom),12px)] font-mono text-micro uppercase text-signal-hi sm:hidden">
              {toast}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
