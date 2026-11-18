/**
 * Procedural planets — every surface is generated, no image textures.
 *
 * Two stages, so the cost is paid once instead of every frame:
 *
 *   BAKE   (planetBake*) runs the heavy noise once per planet into two
 *          equirectangular half-float textures:
 *            A = albedo.rgb, height
 *            B = cloud, specular mask, glow (city lights / lava heat)
 *          It's rendered in horizontal bands over several frames so even a
 *          weak phone never stalls on it.
 *   RENDER (planetVertex/planetFragment) is a handful of texture reads plus
 *          lighting: sun-lit terminator, relief from the baked height
 *          (Mikkelsen bump mapping), ocean glint, drifting cloud deck with
 *          its shadow, city lights on the night side, flickering lava,
 *          limb haze.
 *
 * KIND selects the surface:
 *   0 terra  — domain-warped continents, oceans, ice caps, clouds, cities
 *   1 giant  — sheared latitude bands with turbulent edges and a storm vortex
 *   2 lava   — black basalt split by glowing fissures
 *   3 ice    — pale crust crossed by rust-coloured lineae
 *   4 rock   — three scales of craters with raised rims, dark maria
 */

const noise = /* glsl */ `
// Simplex 3D — Ashima Arts / Stefan Gustavson (MIT)
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Rotating each octave hides the lattice
const mat3 ROT = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);

float fbm(vec3 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < OCT; i++) {
    if (i >= oct) break;
    s += a * snoise(p);
    p = ROT * p * 2.03;
    a *= 0.5;
  }
  return s;
}

// Sharp creases — mountain ridges, fissures, lineae
float ridged(vec3 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < OCT; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(snoise(p));
    s += a * n * n;
    p = ROT * p * 2.11;
    a *= 0.5;
  }
  return s;
}

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

// Impact craters on a 3D lattice: bowl, raised rim, faint ejecta
float craters(vec3 p, float density) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float h = 0.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 o = vec3(float(x), float(y), float(z));
    vec3 r = hash33(i + o);
    if (r.z > density) continue;
    float rad = 0.18 + 0.3 * r.x * r.x;
    float d = length(o + r * 0.8 + 0.1 - f) / rad;
    if (d > 2.2) continue;
    float bowl = d < 1.0 ? (d * d - 1.0) * 0.9 : 0.0;
    float rim = exp(-(d - 1.0) * (d - 1.0) * 14.0) * 0.45;
    float ejecta = d > 1.0 ? exp(-(d - 1.0) * 3.0) * 0.08 : 0.0;
    h += (bowl + rim + ejecta) * rad;
  }
  return h;
}

vec3 rotateAxis(vec3 p, vec3 axis, float a) {
  float c = cos(a), s = sin(a);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}
`;

export const planetBakeVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const planetBakeFragment = /* glsl */ `
precision highp float;
uniform float uSeed;
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform vec3 uTintC;
varying vec2 vUv;
layout(location = 0) out vec4 outA;
layout(location = 1) out vec4 outB;

${noise}

void main() {
  // Texel → point on the unit sphere (inverse of sphereUv below)
  float bakeLon = (vUv.x - 0.5) * 6.28318530718;
  float bakeLat = (vUv.y - 0.5) * 3.14159265359;
  vec3 sp = vec3(cos(bakeLat) * cos(bakeLon), sin(bakeLat), cos(bakeLat) * sin(bakeLon));
  vec3 p = sp + uSeed;

  vec3 albedo = vec3(0.0);
  float height = 0.0;
  float specMask = 0.0;
  float cloud = 0.0;
  float glow = 0.0;

#if KIND == 0
  // ---------------- terra ----------------
  vec3 q = p * 1.35;
  vec3 w = vec3(fbm(q + vec3(1.7, 9.2, 3.1), 4), fbm(q + vec3(8.3, 2.8, 5.6), 4), fbm(q + vec3(4.1, 6.3, 1.9), 4));
  float e = fbm(q * 1.1 + w * 0.65, OCT);
  float sea = 0.04;
  float land = smoothstep(sea, sea + 0.015, e);
  float alt = max(e - sea, 0.0);
  float mtn = ridged(q * 3.2 + w * 1.6, OCT - 1) * smoothstep(0.02, 0.22, alt);
  alt += mtn * 0.22;
  float lat = abs(sp.y);
  float moist = fbm(q * 2.4 + 11.0, 4) * 0.5 + 0.5 - lat * 0.25 - alt * 0.6;
  float grain = fbm(q * 18.0, 3) * 0.5 + 0.5;

  vec3 lush = vec3(0.05, 0.09, 0.035);
  vec3 dry = vec3(0.24, 0.17, 0.085);
  vec3 steppe = vec3(0.14, 0.12, 0.06);
  vec3 rock = vec3(0.1, 0.085, 0.07);
  vec3 snow = vec3(0.78, 0.82, 0.86);
  vec3 lc = mix(dry, steppe, smoothstep(0.3, 0.48, moist));
  lc = mix(lc, lush, smoothstep(0.48, 0.66, moist));
  lc = mix(lc, rock, smoothstep(0.06, 0.2, mtn));
  lc *= 0.8 + grain * 0.4;
  float ice = smoothstep(0.74, 0.8, lat + alt * 0.9 + (grain - 0.5) * 0.08);

  vec3 deep = vec3(0.006, 0.02, 0.06);
  vec3 shelf = vec3(0.015, 0.09, 0.12);
  vec3 oc = mix(deep, shelf, smoothstep(-0.14, sea, e));
  albedo = mix(oc, lc, land);
  albedo = mix(albedo, snow, max(ice, smoothstep(0.84, 0.9, lat)));
  height = mix(-0.004, alt * 0.035 + grain * 0.004, land);
  specMask = (1.0 - land) * (1.0 - ice);

  // Clouds: broad weather systems (low-frequency, swirled) broken up by
  // fine detail, drifting slowly on top of the spin
  vec3 cp = sp * 1.6 + uSeed * 1.3;
  vec3 cw = vec3(fbm(cp * 0.7 + 3.3, 3), fbm(cp * 0.7 + 7.7, 3), fbm(cp * 0.7 + 1.1, 3));
  float cover = fbm(cp + cw * 0.9, 4) + 0.12 * sin(sp.y * 8.0);
  float detail = fbm(cp * 4.5 + cw * 1.2, OCT);
  cloud = smoothstep(0.05, 0.55, cover * 0.9 + detail * 0.55 - 0.05) * 0.85;

  // City lights on the night side — lowland coasts, clustered
  float cities = smoothstep(0.62, 0.95, snoise(p * 46.0) * 0.5 + 0.5) * smoothstep(0.55, 0.8, fbm(p * 5.0 + 2.0, 3) * 0.5 + 0.5);
  cities *= land * (1.0 - ice) * (1.0 - smoothstep(0.03, 0.12, alt));
  glow = cities;

#elif KIND == 1
  // ---------------- gas giant ----------------
  // Storm: rotate the flow around a point, harder toward the eye
  vec3 eye = normalize(vec3(0.55, -0.32, 0.77));
  float sd = length((sp - eye) * vec3(1.0, 1.7, 1.0));
  float swirl = smoothstep(0.26, 0.0, sd);
  vec3 g = rotateAxis(sp, eye, swirl * swirl * 7.0);
  float lat = g.y;
  vec3 f = vec3(g.x * 1.6, g.y * 11.0, g.z * 1.6) + uSeed;
  float t = 0.0;
  vec3 warp = vec3(fbm(f * 0.5 + vec3(t, 0.0, 0.0), 4), fbm(f * 0.5 + vec3(0.0, 3.1, t), 4), 0.0);
  float turb = fbm(f + warp * 2.2, OCT);
  float bands = lat * 6.5 + turb * 0.28 + fbm(g * 2.0 + uSeed, 3) * 0.2;
  float b1 = sin(bands * 3.0) * 0.5 + 0.5;
  float b2 = sin(bands * 7.4 + 1.3) * 0.5 + 0.5;
  float b3 = sin(bands * 15.0 + turb * 3.0) * 0.5 + 0.5;
  albedo = mix(uTintA, uTintB, smoothstep(0.2, 0.8, b1));
  albedo = mix(albedo, uTintC, smoothstep(0.55, 0.95, b2) * 0.75);
  albedo *= 0.82 + b3 * 0.3;
  // Fine filaments where the bands shear
  albedo *= 0.9 + 0.2 * ridged(f * 3.0 + warp * 3.0, 3);
  // Storm body: a warm oval with a pale collar
  float body = smoothstep(0.2, 0.06, sd);
  albedo = mix(albedo, uTintC * 1.15, body * 0.8);
  albedo = mix(albedo, uTintA * 1.2, smoothstep(0.22, 0.18, sd) * smoothstep(0.12, 0.17, sd) * 0.6);
  // Hazy, darker poles
  albedo *= mix(1.0, 0.55, smoothstep(0.6, 0.95, abs(sp.y)));
  height = turb * 0.004;
  specMask = 0.0;

#elif KIND == 2
  // ---------------- lava ----------------
  vec3 q = p * 1.5;
  vec3 w = vec3(fbm(q + 5.2, 3), fbm(q + 1.3, 3), fbm(q + 8.8, 3));
  float base = fbm(q + w * 0.7, OCT);
  float cr = craters(sp * 5.0 + uSeed, 0.45);
  float fiss = 1.0 - abs(snoise(q * 1.2 + w * 1.2));
  float fiss2 = 1.0 - abs(snoise(q * 3.2 + w * 1.8));
  float crack = smoothstep(0.955, 0.997, fiss) + smoothstep(0.975, 0.998, fiss2) * 0.4 * smoothstep(0.6, 0.9, fiss);
  float pools = smoothstep(0.42, 0.56, -base);
  float heat = clamp(crack + pools, 0.0, 1.0);
  vec3 basalt = mix(vec3(0.018, 0.016, 0.016), vec3(0.075, 0.06, 0.052), base * 0.5 + 0.5);
  basalt *= 0.75 + 0.5 * (fbm(q * 12.0, 3) * 0.5 + 0.5);
  // Cooling crust darkens around the glow
  basalt *= 1.0 - smoothstep(0.75, 0.93, fiss) * 0.6 * (1.0 - crack);
  albedo = mix(basalt, vec3(0.02), heat);
  // Heat (fissures + pools) plus a faint bleed through the crust
  glow = heat + smoothstep(0.8, 0.95, fiss) * 0.12 * (1.0 - heat);
  height = base * 0.02 + cr * 0.03 - heat * 0.01;
  specMask = 0.15;

#elif KIND == 3
  // ---------------- ice ----------------
  vec3 q = p * 1.8;
  vec3 w = vec3(fbm(q + 2.2, 3), fbm(q + 6.6, 3), fbm(q + 9.1, 3));
  float base = fbm(q + w * 0.8, OCT);
  float l1 = smoothstep(0.955, 0.995, 1.0 - abs(snoise(q * 1.1 + w * 0.9)));
  float l2 = smoothstep(0.965, 0.997, 1.0 - abs(snoise(q * 2.7 + w * 1.4)));
  float l3 = smoothstep(0.97, 0.998, 1.0 - abs(snoise(q * 6.0 + w * 2.0)));
  float lineae = clamp(l1 + l2 * 0.75 + l3 * 0.5, 0.0, 1.0);
  float chaos = smoothstep(0.25, 0.5, fbm(q * 0.9 + 4.0, 4));
  albedo = mix(uTintA, uTintB, base * 0.5 + 0.5);
  albedo = mix(albedo, uTintC * 0.7, chaos * 0.6);
  albedo = mix(albedo, uTintC, lineae * 0.85);
  albedo *= 0.9 + 0.2 * (fbm(q * 20.0, 3) * 0.5 + 0.5);
  height = base * 0.006 + lineae * 0.006 - chaos * 0.004;
  specMask = 0.35 * (1.0 - lineae);

#else
  // ---------------- rock / moon ----------------
  vec3 cq = sp + uSeed;
  float h1 = craters(cq * 3.0, 0.55);
  float h2 = craters(cq * 8.0 + 3.1, 0.7);
  float h3 = craters(cq * 22.0 + 7.3, 0.85);
  float rough = fbm(p * 6.0, OCT);
  height = h1 * 0.09 + h2 * 0.035 + h3 * 0.012 + rough * 0.006;
  float maria = smoothstep(0.05, 0.3, fbm(p * 1.3 + 5.0, 4));
  albedo = mix(uTintA, uTintB, maria);
  albedo *= 0.8 + 0.35 * (fbm(p * 14.0, 3) * 0.5 + 0.5);
  // Fresh crater floors and rims are brighter
  albedo *= 1.0 + smoothstep(0.02, 0.06, h2 * 0.5 + h3 * 0.3) * 0.25;
  specMask = 0.0;
#endif

  // Height is stored offset/scaled so an 8-bit fallback target still works
  outA = vec4(albedo, clamp(height * 6.0 + 0.5, 0.0, 1.0));
  outB = vec4(cloud, specMask, glow, 1.0);
}`;

export const planetVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const planetFragment = /* glsl */ `
uniform sampler2D uMapA;
uniform sampler2D uMapB;
uniform float uTime;
uniform vec3 uSun;      // world space
uniform vec3 uSunObj;   // object space (follows the planet's spin)
uniform vec3 uSunColor;
uniform vec3 uAtmo;
uniform float uAtmoStrength;
uniform float uBump;
uniform float uFade;
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormalW;

vec2 sphereUv(vec3 d) {
  return vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
}

// Equirect lookup without the mip seam where longitude wraps: take the
// smaller of the derivatives of u and of u shifted half a turn
vec4 sampleSphere(sampler2D tex, vec3 d) {
  vec2 uv = sphereUv(d);
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  float u2 = fract(uv.x + 0.5);
  float dx2 = dFdx(u2), dy2 = dFdy(u2);
  if (abs(dx2) < abs(dx.x)) dx.x = dx2;
  if (abs(dy2) < abs(dy.x)) dy.x = dy2;
  return textureGrad(tex, uv, dx, dy);
}

// Mikkelsen, "Bump Mapping Unparametrized Surfaces on the GPU"
vec3 perturb(vec3 pos, vec3 n, float h) {
  vec3 sx = dFdx(pos);
  vec3 sy = dFdy(pos);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - grad);
}

vec3 spinY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

void main() {
  vec3 sp = normalize(vObj);
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = normalize(uSun);
  float ndl = dot(N, L);
  float day = smoothstep(-0.1, 0.28, ndl);

  vec4 A = sampleSphere(uMapA, sp);
  vec4 B = sampleSphere(uMapB, sp);
  vec3 albedo = A.rgb;
  float specMask = B.g;
  float glow = B.b;
  float cloud = 0.0;
  float cloudShadow = 1.0;
  vec3 emissive = vec3(0.0);
  float specPow = 60.0;

#if KIND == 0
  // The cloud deck drifts slowly over the ground; its shadow is the same
  // deck read a little toward the sun
  float drift = uTime * 0.006;
  cloud = sampleSphere(uMapB, spinY(sp, drift)).r;
  float shade = sampleSphere(uMapB, spinY(normalize(sp + normalize(uSunObj) * 0.015), drift)).r;
  cloudShadow = 1.0 - shade * 0.6;
  emissive = vec3(1.0, 0.55, 0.22) * glow * 1.6 * (1.0 - day) * (1.0 - cloud * 0.85);
#elif KIND == 2
  float flicker = 0.75 + 0.25 * sin(uTime * 0.9 + A.a * 100.0);
  emissive = mix(vec3(0.9, 0.12, 0.03), vec3(1.0, 0.55, 0.18), glow * glow) * glow * flicker * 1.6;
  specPow = 24.0;
#elif KIND == 3
  specPow = 30.0;
#endif

  float height = (A.a - 0.5) / 6.0;
  vec3 Nb = perturb(vWorld, N, height * uBump);
  float diff = max(dot(Nb, L), 0.0) * smoothstep(-0.12, 0.1, ndl);

  vec3 col = albedo * diff * uSunColor * cloudShadow;
  // Skylight from the atmosphere wraps a little past the terminator
  col += albedo * uAtmo * smoothstep(-0.3, 0.2, ndl) * 0.06 * uAtmoStrength;

  vec3 H = normalize(L + V);
  float spec = pow(max(dot(Nb, H), 0.0), specPow) * specMask * day;
  col += uSunColor * spec * 0.55 * (1.0 - cloud);

#if KIND == 0
  vec3 cloudCol = vec3(0.7, 0.72, 0.76) * (max(ndl, 0.0) * 0.95 + 0.02);
  col = mix(col, cloudCol * uSunColor, cloud * smoothstep(-0.15, 0.1, ndl));
  col = mix(col, vec3(0.0), cloud * (1.0 - smoothstep(-0.15, 0.1, ndl)) * 0.6);
#endif

  // Limb: haze toward the edge on the lit side, darkening on the far side
  float mu = max(dot(N, V), 0.0);
  float fres = pow(1.0 - mu, 3.0);
  col *= mix(0.6, 1.0, pow(mu, 0.35));
  col += uAtmo * fres * smoothstep(-0.25, 0.6, ndl) * 0.9 * uAtmoStrength;

  col += emissive;
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

export const atmoVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

/**
 * Atmosphere shell: for each pixel, find how close the view ray passes to
 * the planet and integrate an exponential density there — a soft limb
 * that hugs the surface and fades out, brightest on the sunlit side and
 * when the sun is behind the planet (forward scattering).
 */
export const atmoFragment = /* glsl */ `
uniform vec3 uCenter;
uniform float uRadius;
uniform float uShell;
uniform vec3 uColor;
uniform vec3 uSun;
uniform float uStrength;
uniform float uFade;
varying vec3 vWorld;
void main() {
  vec3 rd = normalize(vWorld - cameraPosition);
  vec3 oc = uCenter - cameraPosition;
  vec3 closest = cameraPosition + rd * dot(oc, rd);
  float b = length(closest - uCenter) / uRadius;
  if (b < 1.0) discard;
  float h = (b - 1.0) / (uShell - 1.0);
  float dens = exp(-h * 5.0) * (1.0 - smoothstep(0.6, 1.0, h));
  vec3 n = normalize(closest - uCenter);
  float lit = smoothstep(-0.5, 0.6, dot(n, normalize(uSun)));
  float fwd = pow(max(dot(rd, normalize(uSun)), 0.0), 8.0);
  float a = dens * (lit * 0.9 + fwd * 1.5) * uStrength * uFade;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;
