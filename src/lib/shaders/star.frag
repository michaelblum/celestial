#include ./includes/simplex3d.glsl
#include ./includes/fbm.glsl
#include ./includes/fresnel.glsl

uniform float time;
uniform float temperature;      // Kelvin: 3000 (red) to 50000 (blue-white)
uniform float surfaceDetail;    // Noise frequency multiplier (1-8)
uniform float noiseSpeed;       // Animation speed
// cameraPosition is provided by Three.js automatically

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

// Black-body radiation approximation → RGB
// Based on CIE 1931 + Planckian locus
vec3 temperatureToColor(float temp) {
  // Normalize to 1000-40000K range
  float t = clamp(temp, 1000.0, 40000.0) / 100.0;

  vec3 color;

  // Red
  if (t <= 66.0) {
    color.r = 1.0;
  } else {
    color.r = clamp(1.29293 * pow(t - 60.0, -0.1332), 0.0, 1.0);
  }

  // Green
  if (t <= 66.0) {
    color.g = clamp(0.39008 * log(t) - 0.63184, 0.0, 1.0);
  } else {
    color.g = clamp(1.12989 * pow(t - 60.0, -0.0755), 0.0, 1.0);
  }

  // Blue
  if (t >= 66.0) {
    color.b = 1.0;
  } else if (t <= 19.0) {
    color.b = 0.0;
  } else {
    color.b = clamp(0.54320 * log(t - 10.0) - 1.19625, 0.0, 1.0);
  }

  return color;
}

void main() {
  // Animated 3D noise for surface convection cells
  vec3 noisePos = vPosition * surfaceDetail + vec3(time * noiseSpeed, time * noiseSpeed * 0.7, 0.0);

  // Multi-octave FBM for granular surface detail
  float noise = fbm(noisePos, 4);

  // Additional large-scale convection patterns
  float largeCells = snoise(vPosition * surfaceDetail * 0.3 + vec3(time * noiseSpeed * 0.2));

  // Combine for surface brightness variation
  float surfaceBrightness = 0.7 + noise * 0.25 + largeCells * 0.15;

  // Hot spots (solar flares / bright granules)
  float hotSpots = smoothstep(0.3, 0.6, noise) * 0.4;
  surfaceBrightness += hotSpots;

  // Base color from temperature
  vec3 baseColor = temperatureToColor(temperature);

  // Hot spots shift toward white, cool regions shift toward deeper hue
  vec3 hotColor = mix(baseColor, vec3(1.0), 0.5);
  vec3 coolColor = baseColor * 0.6;
  vec3 surfaceColor = mix(coolColor, hotColor, surfaceBrightness);

  // Limb darkening — edges of the star are darker
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float limb = limbDarkening(vNormal, viewDir, 0.6);
  surfaceColor *= (0.4 + 0.6 * limb);

  // Subtle emissive boost at the edges (chromosphere glow)
  float edgeGlow = fresnelEdge(vNormal, viewDir, 3.0);
  surfaceColor += baseColor * edgeGlow * 0.3;

  // Stars are self-luminous — no external lighting needed
  gl_FragColor = vec4(surfaceColor, 1.0);
}
