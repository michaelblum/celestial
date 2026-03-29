attribute float size;
attribute vec3 color;

varying vec3 vColor;

void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  // Distance attenuation: points shrink with distance but have a minimum
  float dist = -mvPosition.z;
  float attenuation = 300.0 / dist;
  gl_PointSize = max(size * attenuation, 2.0);

  gl_Position = projectionMatrix * mvPosition;
}
