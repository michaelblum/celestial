// Gravity Well — cartesian grid lines warped into a funnel inside the grid cutout
import state from './state.js';

// ── Constants ──────────────────────────────────────────────────────────────
const FLAT_Z = -8.0;
const UNIVERSE_SIZE = 24.0;
const FLAT_SCALE = 4.0;
const MAX_RADIUS = 15.0;
const VERTS_PER_LINE = 128;

// ── Cached for rebuild detection ───────────────────────────────────────────
let _lastDensity = -1;

// ── Build cartesian grid clipped to circle ─────────────────────────────────
function buildWellGeometry(gridSpacing) {
    const positions = [];
    const indices = [];
    const halfGrid = Math.floor(MAX_RADIUS / gridSpacing);
    let vertIdx = 0;

    // X-direction lines (varying X along each line, fixed Y per line)
    for (let iy = -halfGrid; iy <= halfGrid; iy++) {
        const y = iy * gridSpacing;
        if (Math.abs(y) >= MAX_RADIUS) continue;
        const xExtent = Math.sqrt(MAX_RADIUS * MAX_RADIUS - y * y);
        for (let i = 0; i < VERTS_PER_LINE; i++) {
            const t = i / (VERTS_PER_LINE - 1);
            const x = -xExtent + t * 2 * xExtent;
            positions.push(x, y, 0);
            if (i > 0) indices.push(vertIdx - 1, vertIdx);
            vertIdx++;
        }
    }

    // Y-direction lines (fixed X per line, varying Y along each line)
    for (let ix = -halfGrid; ix <= halfGrid; ix++) {
        const x = ix * gridSpacing;
        if (Math.abs(x) >= MAX_RADIUS) continue;
        const yExtent = Math.sqrt(MAX_RADIUS * MAX_RADIUS - x * x);
        for (let i = 0; i < VERTS_PER_LINE; i++) {
            const t = i / (VERTS_PER_LINE - 1);
            const y = -yExtent + t * 2 * yExtent;
            positions.push(x, y, 0);
            if (i > 0) indices.push(vertIdx - 1, vertIdx);
            vertIdx++;
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setIndex(indices);
    return geo;
}

// ── Build a filled disc surface clipped to circle (for solid/glow styles) ──
function buildWellSurface(gridSpacing) {
    // Simple disc with enough radial/ring segments for smooth warp
    const geo = new THREE.CircleGeometry(MAX_RADIUS, 48, 0, Math.PI * 2);
    return geo;
}

// ── Vertex shader — shared between lines and surface ───────────────────────
const wellVertexShader = /* glsl */ `
    uniform vec2 uMassPos;
    uniform float uDepth;
    uniform float uSoftening;
    uniform float uFlatZ;
    uniform vec3 uGridColor1;
    uniform vec3 uGridColor2;

    varying vec3 vColor;

    void main() {
        // Position is in local space (centered on mass), offset to world
        vec3 pos = position;
        pos.x += uMassPos.x;
        pos.y += uMassPos.y;

        // Warp Z: trampoline funnel
        float dx = position.x;
        float dy = position.y;
        float distSq = dx * dx + dy * dy;
        float zOffset = -uDepth / sqrt(distSq + uSoftening * uSoftening);
        pos.z = uFlatZ + zOffset;

        // Color: distance gradient + warp brightness
        float xyDist = sqrt(distSq);
        float t = min(xyDist / 50.0, 1.0);
        vec3 baseColor = mix(uGridColor1, uGridColor2, t);
        float warpBright = min(1.0, abs(zOffset) / 10.0 * 3.0);
        vColor = baseColor + vec3(warpBright * 0.3, warpBright * 0.1, warpBright * 0.4);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const wellFragmentShader = /* glsl */ `
    varying vec3 vColor;
    void main() {
        gl_FragColor = vec4(vColor, 1.0);
    }
`;

const surfaceFragmentShader = /* glsl */ `
    varying vec3 vColor;
    uniform float uSurfaceOpacity;
    void main() {
        gl_FragColor = vec4(vColor, uSurfaceOpacity);
    }
`;

// ── Shared uniforms (reused across materials) ──────────────────────────────
function makeWellUniforms() {
    return {
        uMassPos:    { value: new THREE.Vector2(0, 0) },
        uDepth:      { value: 0.0 },
        uSoftening:  { value: 0.3 },
        uFlatZ:      { value: FLAT_Z },
        uGridColor1: { value: new THREE.Color() },
        uGridColor2: { value: new THREE.Color() },
    };
}

// ── Dispose helper ─────────────────────────────────────────────────────────
function disposeMesh(mesh) {
    if (!mesh) return;
    state.scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
}

// ── Public API ─────────────────────────────────────────────────────────────

export function createGravityWell() {
    if (state.gravityWellStyle === 'off') return;

    const gridSpacing = (UNIVERSE_SIZE * FLAT_SCALE) / state.grid3dDensity;
    _lastDensity = state.grid3dDensity;

    const lineGeo = buildWellGeometry(gridSpacing);
    const style = state.gravityWellStyle;

    // Line mesh (all styles use this)
    const lineOpacity = style === 'wireframe' ? 0.5 : 0.4;
    const lineMat = new THREE.ShaderMaterial({
        uniforms: makeWellUniforms(),
        vertexShader: wellVertexShader,
        fragmentShader: wellFragmentShader,
        transparent: true,
        opacity: lineOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const lineMesh = new THREE.LineSegments(lineGeo, lineMat);
    lineMesh.frustumCulled = false;
    lineMesh.visible = false;
    state.gravityWellMesh = lineMesh;
    state.scene.add(lineMesh);

    // Surface mesh (solid and wireframe+glow styles)
    if (style === 'solid' || style === 'wireframe+glow') {
        const surfGeo = buildWellSurface(gridSpacing);
        const surfOpacity = style === 'solid' ? 0.15 : 0.08;
        const surfUniforms = makeWellUniforms();
        surfUniforms.uSurfaceOpacity = { value: surfOpacity };
        const surfMat = new THREE.ShaderMaterial({
            uniforms: surfUniforms,
            vertexShader: wellVertexShader,
            fragmentShader: surfaceFragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        const surfMesh = new THREE.Mesh(surfGeo, surfMat);
        surfMesh.frustumCulled = false;
        surfMesh.visible = false;
        state.gravityWellGlowMesh = surfMesh;
        state.scene.add(surfMesh);
    } else {
        state.gravityWellGlowMesh = null;
    }
}

export function animateGravityWell(dt) {
    const isFlat = state.gridMode === 'flat';
    const style = state.gravityWellStyle;

    if (!isFlat || style === 'off') {
        if (state.gravityWellMesh) state.gravityWellMesh.visible = false;
        if (state.gravityWellGlowMesh) state.gravityWellGlowMesh.visible = false;
        return;
    }

    if (!state.gravityWellMesh) {
        createGravityWell();
        if (!state.gravityWellMesh) return;
    }

    // Rebuild if density changed (grid spacing must match)
    if (state.grid3dDensity !== _lastDensity) {
        destroyGravityWell();
        createGravityWell();
        if (!state.gravityWellMesh) return;
    }

    const massPos = (state.grid3dRelativeMotion && state._grid3dLogicalPos)
        ? state._grid3dLogicalPos
        : state.polyGroup.position;

    const mass = Math.min(state.swarmGravity * 0.05, 3.0);
    const depth = mass * 8.0;
    const softening = Math.max(mass * 0.5, 0.3);

    // Update uniforms on all well meshes
    const meshes = [state.gravityWellMesh, state.gravityWellGlowMesh];
    for (const mesh of meshes) {
        if (!mesh) continue;
        mesh.visible = true;
        const u = mesh.material.uniforms;
        u.uMassPos.value.set(massPos.x, massPos.y);
        u.uDepth.value = depth;
        u.uSoftening.value = softening;
        u.uGridColor1.value.set(state.colors.grid[0]);
        u.uGridColor2.value.set(state.colors.grid[1]);
    }
}

export function destroyGravityWell() {
    disposeMesh(state.gravityWellMesh);
    state.gravityWellMesh = null;
    disposeMesh(state.gravityWellGlowMesh);
    state.gravityWellGlowMesh = null;
    _lastDensity = -1;
}
