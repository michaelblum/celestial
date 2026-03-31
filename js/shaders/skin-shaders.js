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
uniform int skinType;        // 0-3=planet, 4=solar, 5=portal, 6=tech, 7=circuit, 8=alien, 9=ancient
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

// Rune/glyph pattern: concentric rings + radial spokes in random cells
float runePattern2D(vec2 p, float scale) {
  vec2 cell = floor(p * scale);
  vec2 uv = fract(p * scale) - 0.5;
  float h = hash21(cell);
  float active = step(0.35, h);

  float dist = length(uv);

  // Concentric rings
  float ring1 = abs(dist - 0.15);
  float ring2 = abs(dist - 0.3);
  float rings = min(ring1, ring2);
  float ringGlow = (1.0 - smoothstep(0.0, 0.02, rings)) * step(dist, 0.42);

  // Radial spokes (4 or 6 based on cell hash)
  float angle = atan(uv.y, uv.x);
  float spokes = mix(4.0, 6.0, step(0.7, h));
  float spoke = abs(sin(angle * spokes));
  float spokeGlow = (1.0 - smoothstep(0.0, 0.06, spoke)) * step(0.08, dist) * step(dist, 0.35);

  // Cross-lines in some cells
  float crossDist = min(abs(uv.x), abs(uv.y));
  float crossGlow = (1.0 - smoothstep(0.0, 0.015, crossDist)) * step(0.65, h) * step(dist, 0.4);

  return max(max(ringGlow, spokeGlow * 0.6), crossGlow * 0.5) * active;
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

  // ── Circuit (type 7): neon grid lines on dark surface ──
  if (skinType == 7) {
    vec3 bw = abs(vNormal);
    bw = pow(bw, vec3(4.0));
    bw /= (bw.x + bw.y + bw.z + 0.001);

    vec3 P = vPosition;
    float scale = noiseScale * 6.0;

    // Coarse grid: bright lines at cell boundaries
    float lw = 0.04;
    vec2 gX = abs(fract(P.yz * scale) - 0.5);
    vec2 gY = abs(fract(P.xz * scale) - 0.5);
    vec2 gZ = abs(fract(P.xy * scale) - 0.5);
    float gridX = 1.0 - smoothstep(0.0, lw, min(gX.x, gX.y));
    float gridY = 1.0 - smoothstep(0.0, lw, min(gY.x, gY.y));
    float gridZ = 1.0 - smoothstep(0.0, lw, min(gZ.x, gZ.y));
    float coarseGrid = gridX * bw.x + gridY * bw.y + gridZ * bw.z;

    // Fine grid at 4× density
    float fs = scale * 4.0;
    float fw = 0.02;
    vec2 fgX = abs(fract(P.yz * fs) - 0.5);
    vec2 fgY = abs(fract(P.xz * fs) - 0.5);
    vec2 fgZ = abs(fract(P.xy * fs) - 0.5);
    float fineGrid = (1.0 - smoothstep(0.0, fw, min(fgX.x, fgX.y))) * bw.x
                   + (1.0 - smoothstep(0.0, fw, min(fgY.x, fgY.y))) * bw.y
                   + (1.0 - smoothstep(0.0, fw, min(fgZ.x, fgZ.y))) * bw.z;

    float grid = max(coarseGrid, fineGrid * 0.35);

    // Energy flow pulse traveling along lines
    float flow = sin(P.x * 20.0 + P.y * 15.0 + P.z * 10.0 + time * 3.0) * 0.3 + 0.7;

    // Extra brightness at intersections (coarseGrid² is brightest where lines cross)
    float nodeBoost = coarseGrid * coarseGrid * 0.5;

    // Colors from ramp
    vec3 darkBase = texture2D(colorRamp, vec2(0.0, 0.5)).rgb * 0.04;
    vec3 lineCol = texture2D(colorRamp, vec2(0.7, 0.5)).rgb;
    vec3 hotCol = texture2D(colorRamp, vec2(1.0, 0.5)).rgb;

    // Build: near-black base + glowing lines + hot nodes
    vec3 glowColor = mix(lineCol, hotCol, flow * grid);
    vec3 color = mix(darkBase, glowColor, grid);
    color += hotCol * nodeBoost;

    // Fresnel edge glow
    float fres = fresnelEdge(vNormal, viewDir, 2.0) * 0.15;
    color += lineCol * fres;

    gl_FragColor = vec4(color, uOpacity);
    return;
  }

  // ── Alien (type 8): bio-organic veins with bioluminescent glow ──
  if (skinType == 8) {
    vec3 P = vPosition * noiseScale;

    // Domain warping → organic branching vein structures
    vec3 warp = vec3(
      snoise(P + vec3(0.0, 0.0, time * 0.05)),
      snoise(P + vec3(5.2, 1.3, time * 0.05)),
      snoise(P + vec3(1.7, 9.2, time * 0.05))
    );
    vec3 warpedP = P + warp * 1.5;

    // FBM on warped coords = vein patterns
    float pattern = fbm(warpedP, 4);
    float veins = 1.0 - smoothstep(0.0, 0.12, abs(pattern));

    // Finer capillary network
    float capPattern = fbm(warpedP * 3.0 + vec3(3.7), 3);
    float capillaries = 1.0 - smoothstep(0.0, 0.08, abs(capPattern));
    veins = max(veins, capillaries * 0.5);

    // Heartbeat pulse (sharp peaks)
    float heartbeat = pow(sin(time * 1.5) * 0.5 + 0.5, 3.0);
    float pulse = 0.6 + heartbeat * 0.4;

    // Colors from ramp
    vec3 fleshCol = texture2D(colorRamp, vec2(0.2, 0.5)).rgb;
    vec3 veinCol = texture2D(colorRamp, vec2(0.9, 0.5)).rgb;
    vec3 sssCol = texture2D(colorRamp, vec2(0.5, 0.5)).rgb;

    // Flesh surface texture
    float surfNoise = snoise(P * 4.0) * 0.15 + 0.5;
    vec3 baseColor = fleshCol * surfNoise;

    // Overlay glowing veins
    vec3 color = mix(baseColor, veinCol * pulse * 1.5, veins);

    // Dim diffuse lighting
    vec3 tLightDir = normalize(lightPosition - vWorldPosition);
    float diff = max(dot(vNormal, tLightDir), 0.0) * 0.5;

    // Subsurface scattering (fresnel rim glow)
    float sss = fresnelEdge(vNormal, viewDir, 1.5) * 0.3;
    color = color * (0.2 + diff) + sssCol * sss;

    // Emissive vein contribution
    color += veinCol * veins * pulse * 0.5;

    gl_FragColor = vec4(color, uOpacity);
    return;
  }

  // ── Ancient (type 9): weathered stone with glowing runes ──
  if (skinType == 9) {
    vec3 bw = abs(vNormal);
    bw = pow(bw, vec3(4.0));
    bw /= (bw.x + bw.y + bw.z + 0.001);

    vec3 P = vPosition;

    // Weathered stone base
    float stone = fbm(P * noiseScale * 2.0, 4) * 0.5 + 0.5;
    float erosion = snoise(P * noiseScale * 6.0) * 0.1;
    stone = clamp(stone + erosion, 0.0, 1.0);

    // Triplanar rune glyphs
    float runeScale = noiseScale * 3.0;
    float rX = runePattern2D(P.yz, runeScale);
    float rY = runePattern2D(P.xz, runeScale);
    float rZ = runePattern2D(P.xy, runeScale);
    float runes = rX * bw.x + rY * bw.y + rZ * bw.z;

    // Slow rune pulse (phase varies by position)
    float runePulse = sin(time * 0.5 + snoise(P * 0.5) * 6.28) * 0.3 + 0.7;

    // Colors from ramp
    vec3 stoneCol = texture2D(colorRamp, vec2(stone * 0.4, 0.5)).rgb;
    vec3 runeCol = texture2D(colorRamp, vec2(0.9, 0.5)).rgb;

    // Stone surface with standard lighting
    vec3 tLightDir = normalize(lightPosition - vWorldPosition);
    float diff = max(dot(vNormal, tLightDir), 0.0) * 0.8;
    vec3 tHalfDir = normalize(tLightDir + viewDir);
    float spec = pow(max(dot(vNormal, tHalfDir), 0.0), 16.0) * 0.2 * uSpecular;
    vec3 color = stoneCol * (0.25 + diff) + vec3(spec * 0.5);

    // Emissive rune glow
    color += runeCol * runes * runePulse * 1.5;

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
