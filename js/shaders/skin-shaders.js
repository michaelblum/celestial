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

// Returns 0 at cell boundary, 1 in cell interior — avoids swapped-edge smoothstep UB
float gridSeam(float u, float gap) {
  float fr = fract(u);
  return min(smoothstep(0.0, gap, fr), 1.0 - smoothstep(1.0 - gap, 1.0, fr));
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
    // Triplanar blend weights — panels stick to the object surface (not world space)
    vec3 bw = abs(vNormal);
    bw = pow(bw, vec3(4.0));
    bw /= (bw.x + bw.y + bw.z + 0.001);

    // Coarse panel grid at object-space coordinates
    float ps = noiseScale * 2.5;
    vec2 uvX = vPosition.yz * ps;
    vec2 uvY = vPosition.xz * ps;
    vec2 uvZ = vPosition.xy * ps;

    // Seam mask: 0 at cell edge, 1 in panel interior
    float gap = 0.06;
    float sX = min(gridSeam(uvX.x, gap), gridSeam(uvX.y, gap));
    float sY = min(gridSeam(uvY.x, gap), gridSeam(uvY.y, gap));
    float sZ = min(gridSeam(uvZ.x, gap), gridSeam(uvZ.y, gap));
    float seamMask = sX * bw.x + sY * bw.y + sZ * bw.z;

    // Per-cell tone variation via cell-coordinate hash
    float pvX = snoise(vec3(floor(uvX.x), floor(uvX.y), 0.5) * 0.6) * 0.5 + 0.5;
    float pvY = snoise(vec3(floor(uvY.x), floor(uvY.y), 1.5) * 0.6) * 0.5 + 0.5;
    float pvZ = snoise(vec3(floor(uvZ.x), floor(uvZ.y), 2.5) * 0.6) * 0.5 + 0.5;
    float panelVar = pvX * bw.x + pvY * bw.y + pvZ * bw.z;

    // Base metallic color from ramp, nearly black at seams
    vec3 panelColor = texture2D(colorRamp, vec2(panelVar, 0.5)).rgb;
    vec3 color = mix(panelColor * 0.15, panelColor, seamMask);

    // Fine sub-panel lines at 5× density
    float fs = ps * 5.0;
    vec2 fuvX = vPosition.yz * fs;
    vec2 fuvY = vPosition.xz * fs;
    vec2 fuvZ = vPosition.xy * fs;

    float fg = 0.1;
    float fX = min(gridSeam(fuvX.x, fg), gridSeam(fuvX.y, fg));
    float fY = min(gridSeam(fuvY.x, fg), gridSeam(fuvY.y, fg));
    float fZ = min(gridSeam(fuvZ.x, fg), gridSeam(fuvZ.y, fg));
    float fineMask = fX * bw.x + fY * bw.y + fZ * bw.z;

    color = mix(color * 0.7, color, fineMask);

    // Emissive circuit traces — glowing lines in randomly-selected fine cells
    float trX = snoise(vec3(floor(fuvX.x), floor(fuvX.y), 3.5) * 0.45);
    float trY = snoise(vec3(floor(fuvY.x), floor(fuvY.y), 3.5) * 0.45);
    float trZ = snoise(vec3(floor(fuvZ.x), floor(fuvZ.y), 3.5) * 0.45);
    float traceCell = trX * bw.x + trY * bw.y + trZ * bw.z;
    // Traces appear in the fine lines of cells above threshold
    float traceLine = (1.0 - fineMask) * step(0.6, traceCell) * seamMask;
    vec3 traceColor = texture2D(colorRamp, vec2(1.0, 0.5)).rgb;
    color += traceColor * traceLine * 0.8;

    // Metallic lighting: tight specular, moderate diffuse, Fresnel edge glint
    vec3 tLightDir = normalize(lightPosition - vWorldPosition);
    float diff = max(dot(vNormal, tLightDir), 0.0) * 0.6;
    vec3 tHalfDir = normalize(tLightDir + viewDir);
    float spec = pow(max(dot(vNormal, tHalfDir), 0.0), 128.0) * 1.5 * uSpecular;
    float glint = fresnelEdge(vNormal, viewDir, 3.5) * 0.3;

    color = color * (0.3 + diff + glint) + vec3(spec);
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
