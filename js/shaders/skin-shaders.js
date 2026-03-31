// Uber skin shader — combines planet + solar surface generation
// Ported from v2-rebuild: planet.frag, planet.vert, star.frag

import { simplex3D, fbm } from './noise.js';
import { fresnel } from './fresnel.js';

export const skinVertexShader = /* glsl */ `
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vPosition = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vUv = uv;

  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const skinFragmentShader = /* glsl */ `
${simplex3D}
${fbm}
${fresnel}

uniform float time;
uniform float noiseScale;
uniform int noiseOctaves;
uniform float roughness;
uniform sampler2D colorRamp;
uniform int skinType;        // 0=rocky, 1=gas-giant, 2=ice, 3=volcanic, 4=solar, 5=portal, 6=tech
uniform vec3 lightPosition;
uniform float uOpacity;
uniform float uSpecular;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

// ── Tech skin helper functions ──

// Fast 2D hash for per-cell variation (cheaper than snoise)
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Inset panel frame: 1 on the border band, 0 inside/outside
float rectFrame(vec2 uv, float w) {
  vec2 a = step(vec2(w), uv) * step(vec2(w), 1.0 - uv);
  vec2 b = step(vec2(w * 2.0), uv) * step(vec2(w * 2.0), 1.0 - uv);
  return clamp((a.x * a.y) - (b.x * b.y), 0.0, 1.0);
}

// Two-level panel pattern: coarse frames + inner subdivision + split lines
float panelPattern2D(vec2 p, float scale, float lineW) {
  vec2 uv = fract(p * scale);
  float outer = rectFrame(uv, lineW);
  float inner = rectFrame(fract(uv * 2.0 + 0.17), lineW * 0.75);
  float split = step(0.96, uv.x) + step(0.96, uv.y);
  return clamp(max(outer, inner * 0.65) + split * 0.45, 0.0, 1.0);
}

// Emissive micro-lights: tiny bright spots in random cells
float cityLights2D(vec2 p, float scale, float bias) {
  vec2 cell = floor(p * scale);
  vec2 uv = fract(p * scale);
  float h = hash21(cell);
  float win = step(bias, h);
  float tiny = step(0.42, uv.x) * step(uv.x, 0.58) * step(0.35, uv.y) * step(uv.y, 0.70);
  return win * tiny;
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);

  // ── Solar (type 4): self-luminous, no external lighting ──
  if (skinType == 4) {
    vec3 noisePos = vPosition * noiseScale + vec3(time * 0.03, time * 0.021, 0.0);
    float noise = fbm(noisePos, 4);
    float largeCells = snoise(vPosition * noiseScale * 0.3 + vec3(time * 0.006));
    float surfaceBrightness = 0.7 + noise * 0.25 + largeCells * 0.15;
    float hotSpots = smoothstep(0.3, 0.6, noise) * 0.4;
    surfaceBrightness += hotSpots;

    // Base color from center of ramp
    vec3 baseColor = texture2D(colorRamp, vec2(0.5, 0.5)).rgb;
    vec3 hotColor = mix(baseColor, vec3(1.0), 0.5);
    vec3 coolColor = baseColor * 0.6;
    vec3 surfaceColor = mix(coolColor, hotColor, surfaceBrightness);

    // Limb darkening
    float limb = limbDarkening(vNormal, viewDir, 0.6);
    surfaceColor *= (0.4 + 0.6 * limb);

    // Chromosphere edge glow
    float edgeGlow = fresnelEdge(vNormal, viewDir, 3.0);
    surfaceColor += baseColor * edgeGlow * 0.3;

    gl_FragColor = vec4(surfaceColor, uOpacity);
    return;
  }

  // ── Portal (type 5): dimensional window using view direction ──
  if (skinType == 5) {
    // View direction as lookup into an alternate universe
    vec3 portalDir = normalize(cameraPosition - vWorldPosition);

    // Alternate starfield — offset seed so it doesn't match the real skybox
    vec3 altCoord = portalDir * 4.0 + vec3(42.0, 17.0, 91.0) + vec3(time * 0.005);
    float nebula = fbm(altCoord, 4) * 0.5 + 0.5;

    // Swirling vortex effect near the rim
    float rimDist = fresnelEdge(vNormal, portalDir, 2.0);
    float swirl = snoise(portalDir * 6.0 + vec3(time * 0.1, time * -0.07, time * 0.05));
    nebula += swirl * rimDist * 0.3;
    nebula = clamp(nebula, 0.0, 1.0);

    // Color from the ramp — user controls the palette of the other universe
    vec3 portalColor = texture2D(colorRamp, vec2(nebula, 0.5)).rgb;

    // Bright star pinpoints in the alternate sky
    float starField = snoise(portalDir * 80.0 + vec3(42.0));
    float stars = smoothstep(0.92, 0.96, starField) * 2.0;
    portalColor += vec3(stars);

    // Edge glow — the boundary of the portal shimmers
    vec3 edgeColor = texture2D(colorRamp, vec2(0.8, 0.5)).rgb;
    portalColor += edgeColor * rimDist * 0.6;

    gl_FragColor = vec4(portalColor, 1.0);
    return;
  }

  // ── Tech (type 6): metallic sci-fi panel surface ──
  if (skinType == 6) {
    // Triplanar blend weights — panels stick to object surface
    vec3 bw = abs(vNormal);
    bw = pow(bw, vec3(4.0));
    bw /= (bw.x + bw.y + bw.z + 0.001);

    vec3 P = vPosition;
    float ps = noiseScale * 8.0;   // panel density
    float lw = 0.045;              // panel line width

    // Triplanar panel pattern (nested frames + sub-panels + split lines)
    float px = panelPattern2D(P.yz, ps, lw);
    float py = panelPattern2D(P.xz, ps, lw);
    float pz = panelPattern2D(P.xy, ps, lw);
    float panels = px * bw.x + py * bw.y + pz * bw.z;

    // Triplanar city lights (tiny emissive windows in random cells)
    float lx = cityLights2D(P.yz, ps * 0.75, 0.82);
    float ly = cityLights2D(P.xz, ps * 0.75, 0.82);
    float lz = cityLights2D(P.xy, ps * 0.75, 0.82);
    float lights = lx * bw.x + ly * bw.y + lz * bw.z;

    // Large-scale tonal variation (zones of lighter/darker panels)
    float macro = 0.5 + 0.5 * sin(P.x * 1.7 + P.y * 1.1 + P.z * 1.3);

    // Sample color ramp at key positions for the palette
    vec3 baseA = texture2D(colorRamp, vec2(0.0, 0.5)).rgb;     // darkest tone
    vec3 baseB = texture2D(colorRamp, vec2(0.3, 0.5)).rgb;     // mid-dark
    vec3 panelCol = texture2D(colorRamp, vec2(0.6, 0.5)).rgb;  // panel highlight
    vec3 lightCol = texture2D(colorRamp, vec2(1.0, 0.5)).rgb;  // emissive window color
    vec3 accentCol = texture2D(colorRamp, vec2(0.8, 0.5)).rgb; // Fresnel accent

    // Build surface color: dark base → brighter at panel frames
    vec3 base = mix(baseA, baseB, macro * 0.35 + panels * 0.25);
    base = mix(base, panelCol, panels * 0.55);

    // Emissive micro-windows
    vec3 emissive = lightCol * lights * 1.5;

    // Metallic lighting
    vec3 tLightDir = normalize(lightPosition - vWorldPosition);
    float diff = max(dot(vNormal, tLightDir), 0.0) * 0.6;
    vec3 tHalfDir = normalize(tLightDir + viewDir);
    float spec = pow(max(dot(vNormal, tHalfDir), 0.0), 128.0) * 1.5 * uSpecular;

    // Fresnel edge accent (metallic silhouette glint)
    float fres = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0) * 0.18;

    vec3 color = base * (0.3 + diff) + emissive + accentCol * fres * 0.25 + vec3(spec);
    gl_FragColor = vec4(color, uOpacity);
    return;
  }

  // ── Planet types (0-3): externally lit ──
  float noise = 0.0;

  if (skinType == 1) {
    // Gas giant: horizontal bands + storm spots
    float latitude = vPosition.y * 3.0;
    float bands = sin(latitude * 8.0 + snoise(vPosition * 2.0) * 0.5) * 0.5 + 0.5;
    float storms = smoothstep(0.4, 0.6, snoise(vPosition * noiseScale * 0.5 + vec3(time * 0.02, 0.0, 0.0)));
    noise = bands * 0.7 + storms * 0.3;
  } else if (skinType == 3) {
    // Volcanic: cracked surface with lava
    float terrain = fbm(vPosition * noiseScale, 4);
    float cracks = 1.0 - smoothstep(0.0, 0.1, abs(terrain));
    noise = terrain * 0.5 + 0.5;
    if (cracks > 0.3) {
      noise = 0.95;
    }
  } else {
    // Rocky (0) / Ice (2): continental terrain
    noise = fbm(vPosition * noiseScale, noiseOctaves);
    noise = noise * 0.5 + 0.5;
    noise += snoise(vPosition * noiseScale * 8.0) * roughness * 0.1;
  }

  // Ice: polar caps
  if (skinType == 2) {
    float polar = abs(vPosition.y) / max(length(vPosition), 0.001);
    float iceCap = smoothstep(0.5, 0.8, polar);
    noise = mix(noise, 1.0, iceCap);
  }

  // Sample color ramp
  noise = clamp(noise, 0.0, 1.0);
  vec3 surfaceColor = texture2D(colorRamp, vec2(noise, 0.5)).rgb;

  // Lighting from light source
  vec3 lightDir = normalize(lightPosition - vWorldPosition);
  float diffuse = max(dot(vNormal, lightDir), 0.0);

  // Blinn-Phong specular
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(vNormal, halfDir), 0.0), 32.0) * 0.4 * uSpecular;

  float lighting = diffuse * 1.4 + spec;

  // Volcanic: emissive lava glow in cracks
  if (skinType == 3) {
    float terrain = fbm(vPosition * noiseScale, 4);
    float cracks = 1.0 - smoothstep(0.0, 0.08, abs(terrain));
    surfaceColor += vec3(1.0, 0.3, 0.0) * cracks * 2.0;
  }

  gl_FragColor = vec4(surfaceColor * lighting, uOpacity);
}
`;
