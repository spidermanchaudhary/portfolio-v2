"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { flight, useUniverse } from "@/store/universe";
import { sections } from "@/data/site";
import type { SectionId } from "@/data/types";

gsap.registerPlugin(ScrollTrigger);

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

/**
 * Turns scrolling into flight.
 *
 * Lenis smooths the wheel; on every scroll tick we find which two HTML
 * stations ([data-station]) straddle the viewport centre and interpolate
 * between them. Result: `flight.t` = 3.4 means "40% of the way from
 * station 3 to station 4", which the camera rig turns into a spline point.
 *
 * Also owns pointer + gyroscope input and section/world tracking.
 */
export default function FlightDriver() {
  const pathname = usePathname();

  // Lenis + GSAP ticker (one RAF loop for both)
  useEffect(() => {
    const { reducedMotion } = useUniverse.getState();
    if (reducedMotion) return;
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
    window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      window.__lenis = undefined;
    };
  }, []);

  // Station tracking — re-measured per route and on resize
  useEffect(() => {
    let centers: { key: string; y: number }[] = [];
    let sectionEls: { id: SectionId; el: HTMLElement }[] = [];
    const set = useUniverse.getState().set;

    const measure = () => {
      centers = Array.from(document.querySelectorAll<HTMLElement>("[data-station]")).map((el) => {
        const r = el.getBoundingClientRect();
        return { key: el.dataset.station!, y: r.top + window.scrollY + r.height / 2 };
      });
      sectionEls = sections
        .map((s) => ({ id: s.id, el: document.getElementById(s.id) as HTMLElement }))
        .filter((s) => s.el);
      update();
    };

    let lastY = window.scrollY;
    const update = () => {
      const y = window.scrollY;
      const mid = y + window.innerHeight / 2;
      const lenis = window.__lenis;
      flight.velocity = lenis ? lenis.velocity : y - lastY;
      lastY = y;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      flight.progress = max > 0 ? y / max : 0;

      if (centers.length) {
        let t = 0;
        if (mid <= centers[0].y) t = 0;
        else if (mid >= centers[centers.length - 1].y) t = centers.length - 1;
        else {
          for (let i = 0; i < centers.length - 1; i++) {
            const a = centers[i].y;
            const b = centers[i + 1].y;
            if (mid >= a && mid < b) {
              const f = (mid - a) / (b - a);
              // Ease each hop so the camera lingers at stations
              t = i + f * f * (3 - 2 * f);
              break;
            }
          }
        }
        flight.t = t;

        const nearest = centers[Math.round(t)]?.key ?? "";
        const m = /^world-(\d+)$/.exec(nearest);
        const activeWorld = m ? Number(m[1]) : -1;
        if (useUniverse.getState().activeWorld !== activeWorld) set({ activeWorld });
      }

      let active: SectionId = "top";
      for (const s of sectionEls) if (s.el.offsetTop <= mid) active = s.id;
      if (useUniverse.getState().activeSection !== active) set({ activeSection: active });
    };

    // Arriving at /#world-x from a dossier: jump there before first paint
    const hash = window.location.hash;
    if (hash) {
      const el = document.querySelector<HTMLElement>(hash);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY + el.offsetHeight / 2 - window.innerHeight / 2;
        window.__lenis ? window.__lenis.scrollTo(top, { immediate: true, force: true }) : window.scrollTo(0, top);
      }
    }

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(document.body);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update);
    };
  }, [pathname]);

  // Pointer + touch + gyro
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      flight.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      flight.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") window.setTimeout(() => (flight.pointer.y = -3), 400);
    };
    const onLeave = () => (flight.pointer.y = -3);

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      flight.tilt.x = Math.max(-1, Math.min(1, e.gamma / 35));
      flight.tilt.y = Math.max(-1, Math.min(1, (e.beta - 45) / 35)) * -1;
    };
    // iOS asks permission for motion data — request on first tap only
    type DOE = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
    const askGyro = () => {
      const D = window.DeviceOrientationEvent as DOE | undefined;
      if (D?.requestPermission) D.requestPermission().then((r) => r === "granted" && window.addEventListener("deviceorientation", onOrient)).catch(() => {});
    };
    const isTouch = useUniverse.getState().isTouch;
    if (isTouch) {
      const D = window.DeviceOrientationEvent as DOE | undefined;
      if (D && !D.requestPermission) window.addEventListener("deviceorientation", onOrient);
      window.addEventListener("touchend", askGyro, { once: true });
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("deviceorientation", onOrient);
      window.removeEventListener("touchend", askGyro);
    };
  }, []);

  return null;
}
