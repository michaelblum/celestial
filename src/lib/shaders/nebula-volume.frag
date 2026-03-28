// Volumetric shell shader — ported from matter-light-exp.html
#include ./includes/simplex3d.glsl
#include ./includes/fbm.glsl

uniform float time;
uniform vec3 cameraPos;
uniform vec3 color1;
uniform vec3 color2;
uniform float opacity;
uniform float speed;
uniform vec3 lightColor;
uniform float lightIntensity;

varying vec3 vPosition;
varying vec3 vWorldPosition;

void main() {
  // Fractional Brownian Motion
  vec3 p = vPosition * 4.0 + vec3(time * speed, time * speed * 0.66, 0.0);
  float noise = 0.0;
  noise += snoise(p) * 0.5;
  noise += snoise(p * 2.0) * 0.25;
  noise += snoise(p * 4.0) * 0.125;

  // Density from noise
  float density = smoothstep(-0.1, 0.4, noise);

  // Color mixing
  vec3 finalColor = mix(color2, color1, noise + 0.5);

  // Core glow from embedded light
  float distToCenter = length(vPosition);
  vec3 coreGlow = lightColor * lightIntensity * smoothstep(2.0, 0.0, distToCenter);
  finalColor += coreGlow * density;

  // Fresnel edge fading (volume boundary)
  vec3 viewDirection = normalize(cameraPos - vWorldPosition);
  vec3 fakeNormal = normalize(vPosition);
  float fresnel = abs(dot(fakeNormal, viewDirection));
  fresnel = clamp(fresnel, 0.0, 1.0);
  float edgeFade = pow(fresnel, 2.0);

  gl_FragColor = vec4(finalColor, density * edgeFade * opacity);
}
