// Schwarzschild black hole ray-tracer
// Adapted from vlwkaos/threejs-blackhole (GPL v3)
// Leapfrog geodesic integration through curved spacetime

#define PI 3.141592653589793

// All coordinates in Schwarzschild units (event horizon radius = 1.0)
uniform float time;
uniform vec3 cam_pos;
uniform float sphereRadius;
uniform float stepSize;   // ray march step (smaller = better quality, slower)
uniform int maxSteps;     // max integration steps

// Accretion disk parameters
const float DISK_IN = 2.0;
const float DISK_WIDTH = 4.0;

varying vec3 vLocalPosition;

vec3 temp_to_color(float temp_kelvin) {
  vec3 color;
  temp_kelvin = clamp(temp_kelvin, 1000.0, 40000.0) / 100.0;

  if (temp_kelvin <= 66.0) {
    color.r = 1.0;
    color.g = clamp(0.39008 * log(temp_kelvin) - 0.63184, 0.0, 1.0);
  } else {
    color.r = clamp(1.29293 * pow(temp_kelvin - 60.0, -0.1332), 0.0, 1.0);
    color.g = clamp(1.12989 * pow(temp_kelvin - 60.0, -0.0755), 0.0, 1.0);
  }

  if (temp_kelvin >= 66.0) {
    color.b = 1.0;
  } else if (temp_kelvin <= 19.0) {
    color.b = 0.0;
  } else {
    color.b = clamp(0.54320 * log(temp_kelvin - 10.0) - 1.19625, 0.0, 1.0);
  }

  return color;
}

void main() {
  vec3 fragPos = vLocalPosition;
  vec3 ray_dir = normalize(fragPos - cam_pos);

  // Initialize geodesic
  vec3 point = cam_pos;
  vec3 velocity = ray_dir;
  vec3 c = cross(point, velocity);
  float h2 = dot(c, c);

  vec4 color = vec4(0.0, 0.0, 0.0, 0.0);
  vec3 oldpoint;
  float distance;
  bool hit_horizon = false;
  bool hit_disk = false;

  // Leapfrog geodesic integration
  for (int i = 0; i < 1000; i++) {
    if (i >= maxSteps) break;

    oldpoint = point;
    point += velocity * stepSize;

    float r2 = dot(point, point);
    vec3 accel = -1.5 * h2 * point / pow(r2, 2.5);
    velocity += accel * stepSize;

    distance = length(point);

    // Event horizon crossing
    if (distance < 1.0 && length(oldpoint) > 1.0) {
      hit_horizon = true;
      break;
    }

    // Accretion disk intersection (crossing y=0 plane)
    if (oldpoint.y * point.y < 0.0) {
      float lambda = -oldpoint.y / velocity.y;
      vec3 intersection = oldpoint + lambda * velocity;
      float r = length(intersection);

      if (r >= DISK_IN && r <= DISK_IN + DISK_WIDTH) {
        float disk_temperature = 10000.0 * pow(r / DISK_IN, -0.75);
        float phi = atan(intersection.x, intersection.z) - time * 0.3;
        float pattern = 0.8 + 0.2 * sin(phi * 6.0 + r * 2.0);

        vec3 disk_color = temp_to_color(disk_temperature) * pattern;
        float disk_alpha = clamp(dot(disk_color, disk_color) / 3.0, 0.0, 1.0);

        float inner_fade = smoothstep(DISK_IN, DISK_IN + 0.3, r);
        float outer_fade = smoothstep(DISK_IN + DISK_WIDTH, DISK_IN + DISK_WIDTH - 0.5, r);
        disk_alpha *= inner_fade * outer_fade;

        color += vec4(disk_color, 1.0) * disk_alpha;
        hit_disk = true;
      }
    }

    // Ray escaped past closest approach
    if (distance > sphereRadius * 0.9 && distance > length(oldpoint)) break;
  }

  if (hit_horizon) {
    // Event horizon — pure black, fully opaque
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else if (hit_disk) {
    // Accretion disk over transparent background (scene shows through)
    gl_FragColor = color;
  } else {
    // Escaped ray — transparent so the actual scene background shows through
    // The gravitational lensing distortion is lost without a bg texture,
    // but this integrates cleanly with the scene
    discard;
  }
}
