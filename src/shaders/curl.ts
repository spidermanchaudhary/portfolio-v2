/**
 * Divergence-free "curl noise" flow, analytically derived.
 *
 * The flow is the curl of a domain-warped, two-octave sinusoidal vector
 * potential. Because the curl is computed in closed form (12 cosines, no
 * finite differences), it costs a fraction of simplex-based curl noise —
 * which matters at 131k particles per frame — while staying swirly and
 * incompressible (particles never bunch up or tear apart).
 */
export const curlGLSL = /* glsl */ `
vec3 curlOctave(vec3 p, float t) {
  return vec3(
    0.60 * cos(1.2 * p.y + 0.5 * t) - 1.10 * cos(1.1 * p.z + 0.8 * t),
    0.85 * cos(1.7 * p.z + 0.7 * t) - 1.50 * cos(1.5 * p.x - 0.9 * t),
    0.95 * cos(1.9 * p.x - 0.6 * t) - 1.30 * cos(1.3 * p.y + 1.0 * t)
  );
}

vec3 curlFlow(vec3 p, float t) {
  // Domain warp breaks the periodic look of pure sinusoids
  p += 0.55 * sin(p.yzx * 0.73 + t * 0.21);
  return curlOctave(p, t) + 0.5 * curlOctave(p * 2.31 + 4.7, t * 1.37);
}
`;

/** Cheap hash for per-pixel grain / per-particle jitter */
export const hashGLSL = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
`;
