/**
 * "Graph-paper planet" — the notebook identity on a sphere.
 * Dark body, latitude/longitude grid inked in signal blue (antialiased
 * with fwidth), a soft terminator, a fresnel rim, and slow drifting
 * contour bands. uImpact (0..1) brightens the ink and rim for worlds with
 * more reported users.
 */
export const planetVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying vec2 vUv;
varying vec3 vPos;
void main() {
  vUv = uv;
  vPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const planetFragment = /* glsl */ `
uniform vec3  uInk;
uniform vec3  uBody;
uniform vec3  uLightDir;
uniform float uImpact;
uniform float uActive;
uniform float uTime;
varying vec3 vNormal;
varying vec3 vView;
varying vec2 vUv;
varying vec3 vPos;

float gridLine(float coord, float count, float width) {
  float x = coord * count;
  float d = abs(fract(x - 0.5) - 0.5) / fwidth(x);
  return 1.0 - clamp(d / width, 0.0, 1.0);
}

void main() {
  vec3 n = normalize(vNormal);
  float lambert = clamp(dot(n, normalize(uLightDir)), 0.0, 1.0);
  float fres = pow(1.0 - clamp(dot(n, vView), 0.0, 1.0), 2.4);

  // Graph paper: fine grid + every 4th line heavier
  float fine = max(gridLine(vUv.x, 48.0, 0.8), gridLine(vUv.y, 24.0, 0.8));
  float major = max(gridLine(vUv.x, 12.0, 1.2), gridLine(vUv.y, 6.0, 1.2));
  // Drifting contour bands, like isobars on a weather map
  float band = gridLine(vPos.y * 0.5 + sin(vPos.x * 1.7 + uTime * 0.15) * 0.08, 5.0, 1.0);

  float ink = fine * 0.18 + major * 0.55 + band * 0.25;
  ink *= mix(0.35, 1.0, lambert) * (0.6 + uImpact * 0.6) * (0.55 + uActive * 0.45);

  vec3 col = uBody * (0.18 + lambert * 0.55);
  col += uInk * ink;
  col += uInk * fres * (0.35 + uImpact * 0.6);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Atmosphere: back-face shell, additive fresnel glow */
export const atmosphereVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const atmosphereFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float rim = pow(clamp(1.0 - abs(dot(normalize(vNormal), vView)), 0.0, 1.0), 3.0);
  gl_FragColor = vec4(uColor * rim * uIntensity, rim * uIntensity);
}`;
