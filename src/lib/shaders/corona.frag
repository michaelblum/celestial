uniform float time;
uniform vec3 coronaColor;
uniform float intensity;
uniform float reach;

varying vec2 vUv;

void main() {
  // Distance from center of the sprite (0 at center, 1 at edge)
  vec2 centered = vUv * 2.0 - 1.0;
  float dist = length(centered);

  // Soft radial falloff
  float alpha = smoothstep(1.0, 0.0, dist);
  alpha = pow(alpha, 1.5); // Shape the falloff curve

  // Animated pulse
  float pulse = 1.0 + 0.15 * sin(time * 2.0) + 0.08 * sin(time * 5.3);

  // Radial rays
  float angle = atan(centered.y, centered.x);
  float rays = 0.5 + 0.5 * sin(angle * 12.0 + time * 0.5);
  rays = pow(rays, 3.0) * 0.3;

  // Combine
  float finalAlpha = alpha * intensity * pulse * reach;
  finalAlpha += rays * alpha * 0.2 * intensity;
  finalAlpha = clamp(finalAlpha, 0.0, 1.0);

  // Color: brighter toward center
  vec3 color = mix(coronaColor, vec3(1.0), alpha * 0.4);

  gl_FragColor = vec4(color, finalAlpha);
}
