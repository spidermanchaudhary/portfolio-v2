/**
 * Horizon planets. Each world is a massive body seen only as a backlit
 * limb behind its scene — you arrive somewhere, rather than looking at a
 * model of something.
 *
 * Surface: topographic contour lines (from 3D simplex noise) inked in the
 * signal colour, brightest toward the lit limb, fading into the night
 * side. uSeed gives each world its own terrain; uImpact (from reported
 * users) brightens contours and the atmosphere.
 */

// Ashima Arts 3D simplex noise (MIT)
const simplex = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

export const planetVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vObj;
varying float vDist;
void main() {
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  vDist = distance(cameraPosition, wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const planetFragment = /* glsl */ `
uniform vec3  uInk;
uniform vec3  uBody;
uniform vec3  uLightDir;
uniform float uImpact;
uniform float uActive;
uniform float uTime;
uniform float uSeed;
uniform float uDensity;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vObj;
varying float vDist;
${simplex}

void main() {
  vec3 n = normalize(vNormal);
  vec3 L = normalize(uLightDir);
  float ndl = dot(n, L);
  float day = smoothstep(-0.25, 0.6, ndl);
  float fres = pow(1.0 - clamp(dot(n, vView), 0.0, 1.0), 3.0);

  // Terrain height: two octaves, slowly drifting "weather"
  vec3 p = vObj * 2.2 + uSeed * 17.0;
  float h = snoise(p) * 0.65 + snoise(p * 2.7 + uTime * 0.01) * 0.35;

  // Topographic contours, antialiased with screen-space derivatives
  float c = h * uDensity;
  float w = fwidth(c) * 1.2;
  float contour = 1.0 - smoothstep(0.0, w, abs(fract(c) - 0.5) - (0.5 - w * 1.5));
  // Every 5th contour is a heavier index line
  float c5 = c / 5.0;
  float w5 = fwidth(c5) * 1.6;
  float idx = 1.0 - smoothstep(0.0, w5, abs(fract(c5) - 0.5) - (0.5 - w5 * 1.5));

  float ink = (contour * 0.22 + idx * 0.45) * (0.1 + day * 0.6);
  ink *= (0.5 + uImpact * 0.5) * (0.45 + uActive * 0.55);

  vec3 col = uBody * (0.04 + day * 0.14);
  col += uInk * ink;
  // Backlit limb + a faint glow along the terminator
  col += uInk * fres * (0.12 + day * 1.15) * (0.6 + uImpact * 0.7);
  col += uInk * smoothstep(0.12, 0.0, abs(ndl)) * 0.08;

  // Distance falloff: far worlds read as dim silhouettes
  col *= mix(0.04, 1.0, smoothstep(70.0, 26.0, vDist));
  gl_FragColor = vec4(col, 1.0);
}`;

/** Atmosphere: back-face shell, glow concentrated on the lit limb */
export const atmosphereVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying float vDist;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  vDist = distance(cameraPosition, wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

export const atmosphereFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLightDir;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vView;
varying float vDist;
void main() {
  vec3 n = normalize(vNormal);
  float rim = pow(clamp(1.0 - abs(dot(n, vView)), 0.0, 1.0), 4.0);
  float lit = 0.25 + 0.75 * smoothstep(-0.4, 0.7, dot(n, normalize(uLightDir)));
  float far = mix(0.03, 1.0, smoothstep(70.0, 26.0, vDist));
  float a = rim * lit * uIntensity * far;
  gl_FragColor = vec4(uColor * a, a);
}`;
