varying vec3 vColor;

void main() {
  // Soft radial falloff — luminous dot, not hard square
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  float alpha = 1.0 - smoothstep(0.3, 0.5, dist);

  if (alpha < 0.01) discard;

  // Slight bloom: brighter at center
  float bloom = exp(-dist * dist * 8.0);
  vec3 col = vColor * (0.8 + 0.4 * bloom);

  gl_FragColor = vec4(col, alpha);
}
