// GPU Particle vertex shader — ported from matter-light-exp.html
uniform float time;
uniform vec3 lightPos;
uniform vec3 lightColor;
uniform float lightIntensity;

attribute float size;
attribute vec3 customColor;

varying vec3 vColor;

void main() {
  vec3 pos = position;

  // Orbital rotation: inner particles orbit faster (galaxy spiral)
  float dist = length(pos.xz);
  float angleOffset = time * 1.0 * (1.5 / (dist + 2.0));
  float s = sin(angleOffset);
  float c = cos(angleOffset);
  float nx = pos.x * c - pos.z * s;
  float nz = pos.x * s + pos.z * c;
  pos.x = nx;
  pos.z = nz;

  // Gentle Y oscillation
  pos.y += sin(time * 2.0 + dist * 0.5) * 0.5;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = size * (200.0 / -mvPosition.z);

  // Light influence on particles
  float lightDist = length(pos - lightPos);
  float influence = smoothstep(15.0, 0.0, lightDist);
  vec3 tintedColor = mix(customColor, lightColor, influence * 0.85);
  vColor = tintedColor + (lightColor * lightIntensity * influence * 0.4);

  gl_Position = projectionMatrix * mvPosition;
}
