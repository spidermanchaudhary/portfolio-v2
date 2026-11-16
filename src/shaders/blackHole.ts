/**
 * Schwarzschild black hole, ray-traced per pixel.
 *
 * Units: Schwarzschild radius r_s = 1. Each pixel fires a ray from a
 * virtual camera and integrates the null geodesic using the exact
 * Cartesian form of the photon equation of motion:
 *
 *     d²x/dλ² = -1.5 · h² · x / |x|⁵        h = |x × v|  (conserved)
 *
 * which reproduces light bending, the shadow (captured rays), the photon
 * ring at b = 3√3/2 and the lensed image of the far side of the disk
 * wrapping over the top.
 *
 * The thin accretion disk (r = 3 … 14, ISCO at 3 r_s) is sampled every time
 * the ray crosses the equatorial plane and composited front-to-back, so
 * secondary images (under/over the shadow) appear too. Disk shading:
 *   - turbulent fbm texture advected with Keplerian rotation (ω ∝ r^-1.5)
 *   - temperature profile hottest near the ISCO (paper-white → signal blue)
 *   - relativistic Doppler beaming (approaching side brighter, D³)
 *   - gravitational redshift √(1 − 1/r)
 * Escaped rays sample a procedural starfield in their *final* direction,
 * so stars near the shadow are visibly lensed; that contribution is
 * weighted by how much the ray was bent, so the billboard edges fade into
 * the real starfield behind.
 */

export const blackHoleVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const blackHoleFragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uSteps;      // integration budget (quality tier)
uniform float uIncline;    // camera elevation above the disk plane (rad)
uniform float uAzimuth;    // camera azimuth around the hole (rad)
uniform float uDist;       // camera distance in r_s
uniform float uFov;        // half-height of the virtual image plane
uniform float uIntensity;  // fade in/out with proximity
uniform vec3  uHot;        // inner disk colour
uniform vec3  uCool;       // outer disk colour
varying vec2 vUv;

const float DISK_IN = 3.0;
const float DISK_OUT = 12.0;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
  return v;
}

// Procedural sky for escaped rays: sparse stars + a faint dust band
vec3 sky(vec3 d) {
  vec3 col = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float scale = k == 0 ? 90.0 : 220.0;
    vec3 c = floor(d * scale);
    float h = hash3(c);
    if (h > 0.985) {
      vec3 f = fract(d * scale) - 0.5;
      float s = smoothstep(0.22, 0.0, length(f));
      col += s * mix(vec3(0.85, 0.88, 1.0), vec3(1.0), hash3(c + 3.1)) * (k == 0 ? 1.4 : 0.7);
    }
  }
  float band = exp(-pow(d.y * 5.0, 2.0)) * fbm(d.xz * 3.0 + 4.0);
  col += vec3(0.25, 0.3, 0.6) * band * 0.08;
  return col;
}

vec3 diskColor(vec3 p, vec3 rayDir, out float alpha) {
  float r = length(p.xz);
  if (r < DISK_IN || r > DISK_OUT) { alpha = 0.0; return vec3(0.0); }
  float ang = atan(p.z, p.x);
  // Keplerian shear: inner rings orbit faster
  float omega = 1.6 * pow(r, -1.5);
  float a = ang + uTime * omega * 6.0;
  float x = (r - DISK_IN) / (DISK_OUT - DISK_IN);

  // Turbulent plasma: long filaments sheared along the orbit, broken up by
  // domain-warped noise so it never resolves into clean rings
  vec2 q = vec2(a * 2.2, log(r) * 6.0);
  vec2 warp = vec2(fbm(q * 0.7 + uTime * 0.05), fbm(q * 0.7 + 5.2));
  float body = fbm(q * vec2(1.0, 2.2) + warp * 2.4);
  float filaments = fbm(q * vec2(3.0, 11.0) + warp * 3.0 + 9.0);
  float density = 0.35 + body * 0.75 + (filaments - 0.5) * 0.7;
  density = max(density, 0.0);
  density *= smoothstep(0.0, 0.05, x) * smoothstep(1.0, 0.45, x);  // soft edges

  // Temperature: hot at ISCO, cooling outward
  float temp = pow(1.0 - x, 1.6);
  vec3 col = mix(uCool, uHot, temp) * (0.6 + 2.6 * temp);

  // Doppler beaming. Orbital velocity is tangential (counter-clockwise
  // seen from above); light travels toward the camera, i.e. -rayDir.
  vec3 vel = normalize(vec3(-p.z, 0.0, p.x));
  float beta = clamp(0.62 / sqrt(max(r - 1.0, 0.5)), 0.0, 0.7);
  float cosT = dot(vel, -rayDir);
  float gamma = 1.0 / sqrt(1.0 - beta * beta);
  float dop = 1.0 / (gamma * (1.0 - beta * cosT));
  col *= pow(dop, 3.0);
  // Approaching side shifts blue-white, receding side dims and warms
  col = mix(col, col * vec3(1.15, 1.1, 0.85), clamp(1.0 - dop, 0.0, 1.0) * 0.6);

  // Gravitational redshift
  col *= sqrt(max(1.0 - 1.0 / r, 0.0));

  alpha = clamp(density * 1.35, 0.0, 1.0);
  return col * density;
}

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float edge = length(uv);
  if (edge > 1.0) discard;

  // Virtual camera orbiting the hole
  vec3 ro = vec3(0.0, sin(uIncline), cos(uIncline)) * uDist;
  ro = rotY(uAzimuth) * ro;
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(fw + (uv.x * rt + uv.y * up) * uFov);

  vec3 pos = ro;
  vec3 vel = rd;
  float h2 = dot(cross(pos, vel), cross(pos, vel));

  vec3 acc = vec3(0.0);      // accumulated emission
  float trans = 1.0;         // remaining transmittance
  bool captured = false;
  float minR = 1e3;

  for (int i = 0; i < 400; i++) {
    if (float(i) >= uSteps) break;
    float r = length(pos);
    minR = min(minR, r);
    if (r < 1.0) { captured = true; break; }
    if (r > uDist * 1.6 && dot(pos, vel) > 0.0) break;

    // Adaptive step: fine near the hole, coarse far away
    float dt = clamp(0.07 * r, 0.03, 1.2);
    vec3 a = -1.5 * h2 * pos / pow(r, 5.0);
    vec3 nv = vel + a * dt;
    vec3 np = pos + nv * dt;

    // Equatorial plane crossing → sample the disk
    if (pos.y * np.y < 0.0) {
      float f = pos.y / (pos.y - np.y);
      vec3 hit = mix(pos, np, f);
      float da;
      vec3 dc = diskColor(hit, normalize(nv), da);
      acc += trans * dc;
      trans *= 1.0 - da;
      if (trans < 0.02) break;
    }
    pos = np;
    vel = nv;
  }

  vec3 col = acc;
  float alpha = 1.0 - trans;

  if (!captured) {
    // Lensed background: weight by how much the ray was bent so the plane's
    // edges blend seamlessly into the real starfield
    float bend = 1.0 - clamp(dot(normalize(vel), rd), 0.0, 1.0);
    float lens = smoothstep(0.0005, 0.02, bend);
    vec3 s = sky(normalize(vel)) * lens;
    col += trans * s;
    // Only the strongly lensed zone hides the real starfield behind; weak
    // lensing just adds its bent stars on top (no haze disc)
    float strong = smoothstep(0.03, 0.25, bend);
    alpha = max(alpha, max(strong * 0.92, clamp(dot(s, vec3(0.6)), 0.0, 1.0)) * trans);
    // Photon ring: rays that skimmed the critical orbit (r ≈ 1.5)
    float ring = exp(-pow((minR - 1.52) * 9.0, 2.0));
    col += trans * mix(uCool, uHot, 0.6) * ring * 1.6;
    alpha = max(alpha, ring);
  } else {
    // The shadow: true black, fully opaque
    alpha = 1.0;
  }

  // Soft circular falloff of the billboard itself
  float fade = smoothstep(1.0, 0.72, edge);
  // Gentle filmic shoulder so the beamed side glows instead of clipping
  col = col / (1.0 + col * 0.35);
  gl_FragColor = vec4(col * 0.9 * uIntensity, alpha * fade * uIntensity);
}`;
