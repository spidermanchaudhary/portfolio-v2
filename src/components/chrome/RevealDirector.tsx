"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useUniverse } from "@/store/universe";

gsap.registerPlugin(ScrollTrigger);

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=<>/\\";

/**
 * Kinetic typography, declaratively:
 *   [data-split]  per-character reveal that decodes from scrambled glyphs
 *   [data-reveal] fade + rise
 * Elements inside #top wait for the boot loader; everything else reveals
 * on scroll. Nothing happens in lite mode (content is simply visible).
 */
export default function RevealDirector() {
  const pathname = usePathname();
  const booted = useUniverse((s) => s.booted);

  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains("lite")) {
      root.classList.add("anim-ready");
      return;
    }

    const ctx = gsap.context(() => {
      const splits = Array.from(document.querySelectorAll<HTMLElement>("[data-split]"));
      const reveals = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

      splits.forEach((el) => {
        if (!el.dataset.splitDone) splitChars(el);
        const chars = Array.from(el.querySelectorAll<HTMLElement>(".ch"));
        gsap.set(chars, { yPercent: 105, opacity: 0 });
      });
      gsap.set(reveals, { y: 24, opacity: 0 });
      root.classList.add("anim-ready");

      const inHero = (el: Element) => !!el.closest("#top");
      const narrow = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
      // Hero text waits for the Big Bang to play out before typing in
      const heroDelay = (el: Element) => (inHero(el) ? 0.95 : 0);

      splits.forEach((el, i) => {
        const chars = Array.from(el.querySelectorAll<HTMLElement>(".ch"));
        const play = () => {
          gsap.to(chars, {
            yPercent: 0,
            opacity: 1,
            duration: 0.9,
            ease: "expo.out",
            stagger: { each: Math.min(0.022, 0.6 / chars.length) },
            delay: heroDelay(el) + (inHero(el) ? i * 0.12 : 0),
          });
          // Phones: clean rise only — the scramble's changing glyph widths
          // reflow words between lines on narrow screens
          if (!narrow) scramble(chars, 0.75 + chars.length * 0.012, heroDelay(el));
        };
        if (inHero(el) && !booted) return;
        ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: play });
      });

      reveals.forEach((el) => {
        if (inHero(el) && !booted) return;
        gsap.to(el, {
          y: 0,
          opacity: 1,
          duration: 1.1,
          ease: "expo.out",
          delay: inHero(el) ? 1.2 : 0,
          scrollTrigger: inHero(el) ? undefined : { trigger: el, start: "top 92%", once: true },
        });
      });

      ScrollTrigger.refresh();
    });

    return () => ctx.revert();
  }, [pathname, booted]);

  return null;
}

/** Wraps each character in .ch spans (inside word wrappers that clip). */
function splitChars(el: HTMLElement) {
  const text = el.textContent ?? "";
  if (!el.hasAttribute("aria-hidden") && !el.getAttribute("aria-label")) el.setAttribute("aria-label", text.trim());

  const walk = (node: Node, out: Node[]) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = (child.textContent ?? "").split(/(\s+)/);
        parts.forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            out.push(document.createTextNode(" "));
            return;
          }
          const word = document.createElement("span");
          word.className = "inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]";
          word.setAttribute("aria-hidden", "true");
          for (const c of part) {
            const ch = document.createElement("span");
            ch.className = "ch inline-block will-change-transform";
            ch.dataset.c = c;
            ch.textContent = c;
            word.appendChild(ch);
          }
          out.push(word);
        });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const clone = (child as HTMLElement).cloneNode(false) as HTMLElement;
        const inner: Node[] = [];
        walk(child, inner);
        inner.forEach((n) => clone.appendChild(n));
        out.push(clone);
      }
    });
  };

  const out: Node[] = [];
  walk(el, out);
  el.replaceChildren(...out);
  el.dataset.splitDone = "1";
}

/** Decode effect: characters cycle random glyphs, settling left → right. */
function scramble(chars: HTMLElement[], duration: number, delay: number) {
  // Lock each letter's width so random glyphs can never shift the layout
  chars.forEach((ch) => {
    ch.style.width = `${ch.getBoundingClientRect().width}px`;
    ch.style.textAlign = "center";
  });
  const release = () =>
    chars.forEach((ch) => {
      ch.textContent = ch.dataset.c ?? "";
      ch.style.width = "";
      ch.style.textAlign = "";
    });
  const state = { p: 0 };
  gsap.to(state, {
    p: 1,
    duration,
    delay,
    ease: "power2.out",
    onUpdate: () => {
      const settled = Math.floor(state.p * chars.length);
      chars.forEach((ch, i) => {
        const real = ch.dataset.c ?? "";
        if (i < settled || real === " ") {
          if (ch.textContent !== real) ch.textContent = real;
        } else if (Math.random() < 0.5) {
          ch.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
      });
    },
    onComplete: release,
  });
}

/** Imperative scramble for hover effects (used by ScrambleText). */
export function scrambleText(el: HTMLElement, final: string, duration = 0.5) {
  const state = { p: 0 };
  gsap.killTweensOf(el.dataset);
  gsap.to(state, {
    p: 1,
    duration,
    ease: "none",
    onUpdate: () => {
      const n = Math.floor(state.p * final.length);
      let s = final.slice(0, n);
      for (let i = n; i < final.length; i++) s += final[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      el.textContent = s;
    },
    onComplete: () => {
      el.textContent = final;
    },
  });
}
