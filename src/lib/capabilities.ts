/**
 * Device capability detection.
 *
 * `bootScript` runs inline in <head> before first paint and tags <html>:
 *   .lite    — no WebGL, software-rendered WebGL, or prefers-reduced-motion
 *              → static universe, no canvas
 *   .touch   — coarse pointer (no custom cursor, gyro tilt where available)
 *   .rebooted— loader already played this session → short boot
 * It also stores the GPU name in data-gpu so the tier can be picked from it.
 * Components read those instead of re-detecting.
 */
export const bootScript = `(()=>{try{var d=document.documentElement,c=d.classList;
var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
var gl=false,gpu='';try{var cv=document.createElement('canvas'),o={powerPreference:'high-performance'};
var x=cv.getContext('webgl2',o)||cv.getContext('webgl',o);gl=!!x;
if(x){gpu=String(x.getParameter(x.RENDERER)||'');
if(!gpu||/^(webkit|mozilla)/i.test(gpu)){var e=x.getExtension('WEBGL_debug_renderer_info');if(e)gpu=String(x.getParameter(e.UNMASKED_RENDERER_WEBGL)||gpu)}
var l=x.getExtension('WEBGL_lose_context');l&&l.loseContext()}}catch(e){}
if(gpu)d.setAttribute('data-gpu',gpu);
var sw=/swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu);
var q=new URLSearchParams(location.search);if(q.has('lite'))gl=false;
if(rm||!gl||sw)c.add('lite');if(!gl)c.add('no-webgl');
if(matchMedia('(pointer: coarse)').matches)c.add('touch');
if(sessionStorage.getItem('booted'))c.add('rebooted');
}catch(e){}})()`;

export type Tier = "high" | "medium" | "low";

type GpuClass = "strong" | "mid" | "weak" | "unknown";

/**
 * Rough GPU class from the renderer string. Integrated Intel HD/UHD and
 * older mobile chips can't push the full scene; Iris / Radeon iGPUs manage
 * the middle tier. Masked strings ("Apple GPU") fall back to CPU/RAM hints.
 */
function classifyGpu(gpu: string): GpuClass {
  const g = gpu.toLowerCase();
  if (!g || g === "apple gpu") return "unknown";
  if (/geforce (mx|gt )|nvidia.*mx\d|quadro (k|nvs)/.test(g)) return "mid";
  if (/nvidia|geforce|rtx|quadro|radeon (rx|pro|r9)|intel.*\barc\b|apple m\d/.test(g)) return "strong";
  if (/iris|radeon(\(tm\))? graphics|radeon vega|vega \d|adreno.*\b(6[4-9]\d|[7-9]\d\d)\b|mali-g(7\d|[6-9]\d\d)|xclipse/.test(g)) return "mid";
  if (/intel|hd graphics|mali|adreno|powervr|videocore|radeon r[2-7]|gma/.test(g)) return "weak";
  return "unknown";
}

export function readCapabilities() {
  const c = document.documentElement.classList;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const isTouch = c.contains("touch");
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const gpu = classifyGpu(document.documentElement.dataset.gpu ?? "");

  let tier: Tier = "high";
  if (isTouch || small || cores <= 4 || memory <= 4) tier = "medium";
  if (isTouch && (cores <= 4 || memory <= 2)) tier = "low";
  // The GPU is the better signal when we can read it: a weak iGPU on an
  // otherwise decent laptop is exactly the case CPU/RAM hints miss
  if (gpu === "weak" || cores <= 2 || memory <= 2) tier = "low";
  else if (gpu === "mid" && tier === "high") tier = "medium";
  else if (gpu === "strong" && !isTouch && tier === "medium" && cores >= 4) tier = "high";

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
  medium: 131072, // the name's density is the look — only low trims it
  low: 32768,
};

/** Max device-pixel-ratio per tier — the single biggest fill-rate lever */
export const MAX_DPR: Record<Tier, number> = {
  high: 1.75,
  medium: 1.35,
  low: 1,
};
