import { Effect, EffectAttribute, BlendFunction } from "postprocessing";
import { Uniform, Vector2 } from "three";
import { hashGLSL } from "./curl";

/**
 * One merged "finish" pass instead of four separate effects:
 *   - scroll-velocity warp: the image stretches along the direction of
 *     travel and bows outward (meshes visibly smear at speed)
 *   - chromatic aberration, radial, scaled by velocity + a resting amount
 *   - animated film grain
 *   - vignette
 *   - blueprint grade (Konami easter egg)
 */
const fragment = /* glsl */ `
uniform float uVelocity;
uniform float uAberration;
uniform float uGrain;
uniform float uTime;
uniform float uBlueprint;
uniform vec2  uMouse;

${hashGLSL}

// The warp is applied by sampling inputBuffer at displaced UVs here rather
// than through the UV-transform hook, because postprocessing can't merge
// UV-transforming effects with convolution effects. (Don't name that hook
// in this source — postprocessing detects it by plain string search.)
vec2 warp(vec2 uv) {
  vec2 c = uv - 0.5;
  float v = clamp(uVelocity, -1.0, 1.0);
  float r2 = dot(c, c);
  // Barrel bulge toward the edges + vertical smear in the scroll direction
  uv = 0.5 + c * (1.0 - abs(v) * 0.24 * r2);
  uv.y -= v * 0.018 * (1.0 - r2 * 2.0);
  return uv;
}

void mainImage(const in vec4 inputColor, const in vec2 uv0, out vec4 outputColor) {
  vec2 uv = warp(uv0);
  vec2 c = uv0 - 0.5;
  float dist = length(c);
  vec2 dir = c / max(dist, 1e-4);
  float amt = (uAberration + abs(uVelocity) * 0.012) * dist;
  // Aberration leans toward the cursor slightly — "cursor-reactive lens"
  vec2 lean = (uMouse * 0.5) * 0.002;
  vec3 col;
  col.r = texture2D(inputBuffer, uv + dir * amt + lean).r;
  col.g = texture2D(inputBuffer, uv).g;
  col.b = texture2D(inputBuffer, uv - dir * amt - lean).b;

  // Vignette
  col *= mix(1.0, smoothstep(0.95, 0.25, dist), 0.55);

  // Blueprint grade: luminance → cyanotype with a faint grid
  if (uBlueprint > 0.0) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 bp = mix(vec3(0.05, 0.13, 0.42), vec3(0.86, 0.92, 1.0), smoothstep(0.02, 0.6, l));
    vec2 g = abs(fract(uv * resolution / 32.0) - 0.5);
    float grid = 1.0 - smoothstep(0.0, 0.04, min(g.x, g.y));
    bp += grid * 0.06;
    col = mix(col, bp, uBlueprint);
  }

  // Grain (luma-weighted so blacks stay inky)
  float n = hash12(uv * resolution + fract(uTime * 7.13) * 917.0) - 0.5;
  col += n * uGrain * (0.35 + dot(col, vec3(0.33)));

  outputColor = vec4(col, inputColor.a);
}
`;

export class FinishEffect extends Effect {
  constructor() {
    super("FinishEffect", fragment, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([
        ["uVelocity", new Uniform(0)],
        ["uAberration", new Uniform(0.0025)],
        ["uGrain", new Uniform(0.032)],
        ["uTime", new Uniform(0)],
        ["uBlueprint", new Uniform(0)],
        ["uMouse", new Uniform(new Vector2())],
      ]),
    });
  }
}
