#include ./includes/simplex3d.glsl
#include ./includes/fbm.glsl
#include ./includes/fresnel.glsl

uniform float time;
uniform float noiseScale;
uniform int noiseOctaves;
uniform float roughness;
uniform sampler2D colorRamp;   // 1D gradient texture (256×1)
// cameraPosition is provided by Three.js automatically
uniform int planetType;         // 0=rocky, 1=gas-giant, 2=ice, 3=volcanic

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float noise = 0.0;

  if (planetType == 1) {
    // Gas giant: horizontal bands + storm spots
    float latitude = vPosition.y * 3.0;
    float bands = sin(latitude * 8.0 + snoise(vPosition * 2.0) * 0.5) * 0.5 + 0.5;
    float storms = smoothstep(0.4, 0.6, snoise(vPosition * noiseScale * 0.5 + vec3(time * 0.02, 0.0, 0.0)));
    noise = bands * 0.7 + storms * 0.3;
  } else if (planetType == 3) {
    // Volcanic: cracked surface with lava in cracks
    float terrain = fbm(vPosition * noiseScale, 4);
    float cracks = 1.0 - smoothstep(0.0, 0.1, abs(terrain));
    noise = terrain * 0.5 + 0.5;
    // Lava glow in cracks
    if (cracks > 0.3) {
      noise = 0.95; // Map to hot end of color ramp
    }
  } else {
    // Rocky / Ice: continental terrain
    noise = fbm(vPosition * noiseScale, noiseOctaves);
    noise = noise * 0.5 + 0.5; // Remap to 0-1

    // Roughness adds high-frequency surface detail
    noise += snoise(vPosition * noiseScale * 8.0) * roughness * 0.1;
  }

  // Ice: polar caps
  if (planetType == 2) {
    float polar = abs(vPosition.y) / length(vPosition);
    float iceCap = smoothstep(0.5, 0.8, polar);
    noise = mix(noise, 1.0, iceCap); // White at poles
  }

  // Sample the color ramp texture
  noise = clamp(noise, 0.0, 1.0);
  vec3 surfaceColor = texture2D(colorRamp, vec2(noise, 0.5)).rgb;

  // Simple diffuse lighting from a directional source
  vec3 lightDir = normalize(vec3(1.0, 0.8, 0.5));
  float diffuse = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.15;
  float lighting = ambient + diffuse * 0.85;

  // Volcanic: emissive glow in cracks
  if (planetType == 3) {
    float terrain = fbm(vPosition * noiseScale, 4);
    float cracks = 1.0 - smoothstep(0.0, 0.08, abs(terrain));
    surfaceColor += vec3(1.0, 0.3, 0.0) * cracks * 2.0; // Orange lava glow
  }

  gl_FragColor = vec4(surfaceColor * lighting, 1.0);
}
