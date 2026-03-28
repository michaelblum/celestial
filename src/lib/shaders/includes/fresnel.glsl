// Fresnel edge effects — from matter-light-exp.html
// Used for atmosphere glow, corona edges, volumetric boundaries

float fresnelEdge(vec3 normal, vec3 viewDir, float power) {
  float fresnel = abs(dot(normalize(normal), normalize(viewDir)));
  return pow(1.0 - clamp(fresnel, 0.0, 1.0), power);
}

// Softer version for atmospheric shells — bright at edges, transparent at center
float atmosphereFresnel(vec3 position, vec3 cameraPos, float power) {
  vec3 viewDirection = normalize(cameraPos - position);
  vec3 fakeNormal = normalize(position); // relative to center
  float fresnel = abs(dot(fakeNormal, viewDirection));
  return pow(1.0 - clamp(fresnel, 0.0, 1.0), power);
}

// Limb darkening for stars — dark at edges, bright at center (inverse fresnel)
float limbDarkening(vec3 normal, vec3 viewDir, float power) {
  float cosAngle = max(dot(normalize(normal), normalize(viewDir)), 0.0);
  return pow(cosAngle, power);
}
