// Raymarched Heightfield Flat Grid
// Fragment shader raymarches against an analytical warp surface and draws grid lines procedurally.
import state from './state.js';

// ── Constants ──────────────────────────────────────────────────────────────
const UNIVERSE_SIZE = 24.0;
const FLAT_SCALE = 4.0;
const FLAT_Z = -8.0;

// ── Module reference ───────────────────────────────────────────────────────
let flatMesh = null;

// ── Shaders ────────────────────────────────────────────────────────────────
const vertexShader = /* glsl */ `
varying vec2 vWorldXY;

void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldXY = worldPos.xy;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const fragmentShader = /* glsl */ `
uniform vec2 uMassPos;
uniform float uDepth;
uniform float uSoftening;
uniform vec3 uGridColor1;
uniform vec3 uGridColor2;
uniform float uGridSpacing;
uniform float uLineWidth;
uniform vec2 uGridOffset;
uniform float uCutoutRadius;

varying vec2 vWorldXY;

void main() {
    // Cut out a circle around the mass — the well geometry fills this hole
    float distToMass = length(vWorldXY - uMassPos);
    if (uCutoutRadius > 0.0 && distToMass < uCutoutRadius) discard;

    // Evaluate grid directly at this pixel's world XY
    vec2 xy = vWorldXY + uGridOffset;

    // Procedural grid lines via fract + fwidth
    vec2 gridXY = xy / uGridSpacing;
    vec2 grid = abs(fract(gridXY - 0.5) - 0.5);
    vec2 fw = fwidth(gridXY);
    vec2 lineAA = smoothstep(fw * uLineWidth, vec2(0.0), grid);
    float lineMask = max(lineAA.x, lineAA.y);

    if (lineMask < 0.01) discard;

    // Color: distance gradient + warp brightness boost
    vec2 d = vWorldXY - uMassPos;
    float xyDist = length(d);
    float t = min(xyDist / 50.0, 1.0);
    vec3 baseColor = mix(uGridColor1, uGridColor2, t);

    float distSq = dot(d, d);
    float zOff = abs(uDepth / sqrt(distSq + uSoftening * uSoftening));
    float warpBright = min(1.0, zOff / 10.0 * 3.0);
    vec3 col = baseColor + vec3(warpBright * 0.3, warpBright * 0.1, warpBright * 0.4);

    gl_FragColor = vec4(col, lineMask * 0.5);
}
`;

// ── Create ─────────────────────────────────────────────────────────────────
export function createFlatGrid() {
    if (flatMesh) return;

    const geometry = new THREE.PlaneGeometry(200, 200);

    const material = new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader,
        fragmentShader,
        uniforms: {
            uMassPos:     { value: new THREE.Vector2(0, 0) },
            uDepth:       { value: 0.0 },
            uSoftening:   { value: 0.3 },
            uGridColor1:  { value: new THREE.Color() },
            uGridColor2:  { value: new THREE.Color() },
            uGridSpacing: { value: 1.0 },
            uLineWidth:   { value: 1.5 },
            uGridOffset:  { value: new THREE.Vector2(0, 0) },
            uCutoutRadius: { value: 0.0 },
        },
    });

    flatMesh = new THREE.Mesh(geometry, material);
    flatMesh.position.z = FLAT_Z;
    flatMesh.rotation.x = -0.14;  // ~8° tilt — subtle perspective cue
    flatMesh.frustumCulled = false;
    flatMesh.visible = false;

    state.scene.add(flatMesh);
}

// ── Animate ────────────────────────────────────────────────────────────────
export function animateFlatGrid(dt) {
    if (!flatMesh) return;

    if (state.gridMode !== 'flat') {
        flatMesh.visible = false;
        return;
    }

    flatMesh.visible = true;

    // Mass center — use logical position when relative motion is active
    const massPos = (state.grid3dRelativeMotion && state._grid3dLogicalPos)
        ? state._grid3dLogicalPos
        : state.polyGroup.position;

    const mass = Math.min(state.swarmGravity * 0.05, 3.0);
    const u = flatMesh.material.uniforms;

    u.uMassPos.value.set(massPos.x, massPos.y);
    u.uDepth.value = mass * 8.0;
    u.uSoftening.value = Math.max(mass * 0.5, 0.3);
    u.uGridColor1.value.set(state.colors.grid[0]);
    u.uGridColor2.value.set(state.colors.grid[1]);
    u.uGridSpacing.value = (UNIVERSE_SIZE * FLAT_SCALE) / state.grid3dDensity;
    // Cutout radius matches the gravity well funnel — 0 if well is off
    u.uCutoutRadius.value = (state.gravityWellStyle !== 'off') ? 15.0 : 0.0;

    // Relative motion offset
    if (state.grid3dRelativeMotion) {
        u.uGridOffset.value.set(-massPos.x, -massPos.y);
    } else {
        u.uGridOffset.value.set(0, 0);
    }
}

// ── Destroy ────────────────────────────────────────────────────────────────
export function destroyFlatGrid() {
    if (!flatMesh) return;

    state.scene.remove(flatMesh);
    flatMesh.geometry.dispose();
    flatMesh.material.dispose();
    flatMesh = null;
}
