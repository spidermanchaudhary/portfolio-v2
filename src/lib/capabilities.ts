/**
 * Device capability detection.
 *
 * `bootScript` runs inline in <head> before first paint and tags <html>:
 *   .lite    — no WebGL, or prefers-reduced-motion → static universe, no canvas
 *   .touch   — coarse pointer (no custom cursor, gyro tilt where available)
 *   .rebooted— loader already played this session → short boot
 * Components read those classes instead of re-detecting.
 */
export const bootScript = `(()=>{try{var d=document.documentElement,c=d.classList;
var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
var gl=false;try{var cv=document.createElement('canvas');gl=!!(cv.getContext('webgl2')||cv.getContext('webgl'))}catch(e){}
var q=new URLSearchParams(location.search);if(q.has('lite'))gl=false;
if(rm||!gl)c.add('lite');if(!gl)c.add('no-webgl');
if(matchMedia('(pointer: coarse)').matches)c.add('touch');
if(sessionStorage.getItem('booted'))c.add('rebooted');
}catch(e){}})()`;

export type Tier = "high" | "medium" | "low";

export function readCapabilities() {
  const c = document.documentElement.classList;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const isTouch = c.contains("touch");
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;

  let tier: Tier = "high";
  if (isTouch || small || cores <= 4 || memory <= 4) tier = "medium";
  if (isTouch && (cores <= 4 || memory <= 2)) tier = "low";

  // ?q=high|medium|low pins the tier and disables adaptive quality (debug/QA)
  const forced = new URLSearchParams(location.search).get("q");
  const locked = forced === "high" || forced === "medium" || forced === "low";
  if (locked) tier = forced as Tier;

  return {
    locked,
    lite: c.contains("lite"),
    webgl: !c.contains("no-webgl"),
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    isTouch,
    rebooted: c.contains("rebooted"),
    tier,
  };
}

/** Particle budget for the hero field, per quality tier */
export const PARTICLES: Record<Tier, number> = {
  high: 131072,
  medium: 65536,
  low: 32768,
};

/** Max device-pixel-ratio per tier — the single biggest fill-rate lever */
export const MAX_DPR: Record<Tier, number> = {
  high: 1.75,
  medium: 1.35,
  low: 1,
};
