/**
 * Builds the three target layouts for the hero particle field.
 * Runs once per (count, aspect) on the main thread; ~20ms for 131k.
 */

/** Rasterises `text` in the display face and returns opaque pixel coords. */
function sampleGlyphs(text: string, aspect: number) {
  const W = 1024;
  const H = 320;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Condensed width where the browser supports it (matches the headlines)
  try {
    (ctx as CanvasRenderingContext2D & { fontStretch: string }).fontStretch = "condensed";
  } catch {}

  let size = 300;
  ctx.font = `800 ${size}px ${family}`;
  const target = W * 0.94;
  const measured = ctx.measureText(text).width;
  size = Math.min(size, (size * target) / measured);
  ctx.font = `800 ${size}px ${family}`;
  ctx.fillText(text, W / 2, H / 2 + size * 0.04);

  const data = ctx.getImageData(0, 0, W, H).data;
  const pts: number[] = [];
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (data[(y * W + x) * 4 + 3] > 140) pts.push(x, y);
    }
  }
  // World-space width of the word: wide screens get a bigger name
  const worldWidth = aspect >= 1 ? Math.min(11.5, 6.8 * aspect) : 6.4 * aspect + 0.6;
  const scale = worldWidth / W;
  return { pts, W, H, scale };
}

function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function buildField(count: number, text: string, aspect: number, nameY: number) {
  const dust = new Float32Array(count * 3);
  const glyph = new Float32Array(count * 3);
  const galaxy = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);

  const { pts, W, H, scale } = sampleGlyphs(text, aspect);
  const n = pts.length / 2;
  const ARMS = 3;
  const R = 7.5;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    // Dust: a thick shell around the camera's starting volume
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const rr = 6 + Math.random() * 22;
    dust[i3] = rr * Math.sin(phi) * Math.cos(theta);
    dust[i3 + 1] = rr * Math.sin(phi) * Math.sin(theta) * 0.6;
    dust[i3 + 2] = rr * Math.cos(phi) - 6;

    // Glyph: random opaque pixel + sub-pixel jitter + thin depth
    const k = n > 0 ? Math.floor(Math.random() * n) * 2 : 0;
    const px = (pts[k] ?? W / 2) + Math.random() * 2;
    const py = (pts[k + 1] ?? H / 2) + Math.random() * 2;
    glyph[i3] = (px - W / 2) * scale;
    glyph[i3 + 1] = -(py - H / 2) * scale + nameY;
    glyph[i3 + 2] = gaussian() * 0.06;

    // Galaxy: logarithmic-ish spiral arms with a dense core
    const t = Math.pow(Math.random(), 1.8);
    const r = t * R;
    const arm = (i % ARMS) * ((Math.PI * 2) / ARMS);
    const twist = r * 0.95;
    const spread = (0.15 + r * 0.12) * gaussian();
    const ang = arm + twist + spread * 0.35;
    galaxy[i3] = Math.cos(ang) * r + gaussian() * 0.12 * (1 + r * 0.15);
    galaxy[i3 + 1] = gaussian() * 0.18 * Math.exp(-r * 0.35);
    galaxy[i3 + 2] = Math.sin(ang) * r + gaussian() * 0.12 * (1 + r * 0.15);

    const i4 = i * 4;
    seed[i4] = Math.random();
    seed[i4 + 1] = Math.random();
    seed[i4 + 2] = Math.random();
    seed[i4 + 3] = Math.random();
  }

  return { dust, glyph, galaxy, seed };
}
