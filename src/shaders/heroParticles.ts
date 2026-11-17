import { curlGLSL } from "./curl";

/**
 * Hero particle field. Every particle carries three target positions —
 * scattered dust, a glyph of the name, and a spiral galaxy — and the
 * vertex shader blends between them. All motion is GPU-side: the CPU only
 * updates a handful of uniforms per frame.
 *
 *   uAssemble  0 → 1   dust converges into the name (boot intro)
 *   uMorph     0 → 1   name unravels into a spiral galaxy (scroll)
 *   uScatter   0 → 1   galaxy disperses into the starfield (scroll)
 *   uMouse            cursor position on the z=0 plane; particles flee it
 */
export const heroVertex = /* glsl */ `
uniform float uTime;
uniform float uAssemble;
uniform float uMorph;
uniform float uScatter;
uniform float uSize;
uniform float uPixelRatio;
uniform vec3  uMouse;
uniform float uMouseForce;
uniform float uSpin;
uniform vec3 uTextFit;  // x: baked centre y, y: scale, z: target centre y
uniform float uBang;   // expansion scale: 0 = singularity, overshoots, settles at 1
uniform float uBangK;  // linear progress through the bang 0..1

attribute vec3 aText;
attribute vec3 aGalaxy;
attribute vec4 aSeed; // x: stagger, y: size, z: hue pick, w: phase

varying float vAlpha;
varying vec3  vColor;
varying float vHeat;

uniform vec3 uPaper;
uniform vec3 uSignal;

${curlGLSL}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

void main() {
  // Staggered easing: each particle has its own start delay
  float a = smoothstep(0.0, 1.0, clamp(uAssemble * 1.6 - aSeed.x * 0.6, 0.0, 1.0));
  float m = smoothstep(0.0, 1.0, clamp(uMorph * 1.5 - aSeed.x * 0.5, 0.0, 1.0));
  float s = smoothstep(0.0, 1.0, clamp(uScatter * 1.4 - aSeed.w * 0.4, 0.0, 1.0));

  // Galaxy slowly rotates; inner arms faster (differential rotation)
  vec3 g = aGalaxy;
  float r = length(g.xz);
  g.xz = rot(uSpin * (0.6 + 1.6 / (r + 0.6))) * g.xz;
  // Tilt the disc toward the camera
  g.yz = rot(-0.8) * g.yz;

  // Big Bang: every particle starts at one point and is flung outward
  vec3 dust = position * uBang;
  // Fit the name into the free space above the HTML headline
  vec3 text = vec3(aText.xy - vec2(0.0, uTextFit.x), aText.z) * uTextFit.y + vec3(0.0, uTextFit.z, 0.0);
  vec3 pos = mix(dust, text, a);
  pos = mix(pos, g, m);
  pos = mix(pos, dust * 2.4, s);

  // Curl flow — gentle while legible, wilder as a galaxy and when scattering
  float flowAmp = mix(0.035, 0.22, m) + s * 1.4 + (1.0 - a) * 0.9;
  pos += curlFlow(pos * 0.55, uTime * 0.35 + aSeed.w * 6.28) * flowAmp * 0.25;

  // Cursor dispersal: push away + swirl around the cursor
  vec3 toP = pos - uMouse;
  float d = length(toP.xy);
  float push = smoothstep(1.9, 0.0, d) * uMouseForce;
  vec3 dir = normalize(toP + vec3(0.0001));
  pos += dir * push * (0.9 + aSeed.y * 0.8);
  pos += curlFlow(pos * 1.3, uTime) * push * 0.35;
  pos.z += push * (aSeed.z - 0.5) * 2.0;

  // White-hot at the start of the bang, cooling as it expands
  float hot = 1.0 - smoothstep(0.0, 0.7, uBangK);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  float size = uSize * (0.55 + aSeed.y * 0.9) * (1.0 + push * 1.5) * (1.0 + hot * 1.2);
  gl_PointSize = size * uPixelRatio * (8.0 / -mv.z);

  // ~12% of particles carry the signal colour; cursor heats the rest
  float accent = step(0.88, aSeed.z);
  vHeat = push;
  vColor = mix(uPaper, uSignal, clamp(accent + push * 0.85 + m * 0.18, 0.0, 1.0));
  vColor = mix(vColor, vec3(1.0, 0.96, 0.9) * 1.8, hot);
  // Fade particles that get close to the lens so fly-throughs stay clean
  vAlpha = mix(0.35, 1.0, a) * (1.0 - s * 0.85) * smoothstep(0.6, 4.5, -mv.z);
  // Keep the singularity from blowing the whole frame out to white
  vAlpha *= mix(0.05, 1.0, smoothstep(0.0, 0.06, uBangK));
}
`;

export const heroFragment = /* glsl */ `
varying float vAlpha;
varying vec3  vColor;
varying float vHeat;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  // Soft core + faint halo
  float core = smoothstep(0.5, 0.0, d);
  float alpha = (core * core) * vAlpha;
  gl_FragColor = vec4(vColor * (1.0 + vHeat * 1.6), alpha);
}
`;
