import * as THREE from "three";

/**
 * Tiny 2D-canvas → texture helper for in-world labels, sheets and tiles.
 * Uses the page's already-loaded webfonts, so there's no extra font
 * download and no SDF text library in the bundle.
 */
export function fonts() {
  const cs = getComputedStyle(document.documentElement);
  const mono = cs.getPropertyValue("--font-mono").trim() || "ui-monospace, monospace";
  const display = cs.getPropertyValue("--font-display").trim() || "system-ui, sans-serif";
  return { mono, display };
}

export function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Seeded PRNG so procedural textures look the same on every visit */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A one-line mono label as a plane-ready texture + aspect */
export function labelTexture(text: string, { color = "#ECEAE3", size = 44, weight = 500 } = {}) {
  const { mono } = fonts();
  const pad = size * 0.4;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `${weight} ${size}px ${mono}`;
  const w = Math.ceil(measure.measureText(text).width + pad * 2);
  const h = Math.ceil(size * 1.5);
  const tex = canvasTexture(w, h, (ctx) => {
    ctx.font = `${weight} ${size}px ${mono}`;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.fillText(text, pad, h / 2);
  });
  return { tex, aspect: w / h };
}
