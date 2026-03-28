#include ./includes/fresnel.glsl

uniform vec3 atmosphereColor;
uniform float density;
// cameraPosition is provided by Three.js automatically

varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  // Fresnel: bright at edges (atmosphere rim), transparent at center
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float edge = atmosphereFresnel(vPosition, cameraPosition, 2.5);

  // Soft inner fade
  float alpha = edge * density;
  alpha = clamp(alpha, 0.0, 0.8);

  // Slight color shift toward white at the bright rim
  vec3 color = mix(atmosphereColor, vec3(1.0), edge * 0.3);

  gl_FragColor = vec4(color, alpha);
}
