// 3D Volumetric Spacetime Grid Module
// Gravity-warped voxel grid, probe sphere, and snow globe boundary
import state from './state.js';

// ── Constants ──────────────────────────────────────────────────────────────
const UNIVERSE_SIZE = 24.0;

// ── Scratch vectors (reused per-frame, never allocate in loops) ────────────
const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _toMass = new THREE.Vector3();

// ── Module-level references ────────────────────────────────────────────────
let basePositions = null;   // Float32Array — immutable grid template
let positions = null;       // Float32Array — warped each frame
let colors = null;          // Float32Array — recolored each frame
let gridGeo = null;
let pointGeo = null;
let vertexCount = 0;

// Probe
let probeBasePositions = null;
let probeVelocity = new THREE.Vector3();

// Cloud texture (for grid points)
let cloudTexture = null;

// Grid offset for relative-motion mode
const gridOffset = new THREE.Vector3();

// Cached flat-mode colors (reset when colors change)
let _flatColor1 = null;
let _flatColor2 = null;

// ── Texture generation ─────────────────────────────────────────────────────
function makeCloudTexture() {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

// ── HSL helper (avoids THREE.Color allocation in hot loop) ─────────────────
function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [r, g, b];
}

// ── Grid construction ──────────────────────────────────────────────────────
function buildGrid3dInternal(density) {
    const isFlat = state.gridMode === 'flat';
    const spacing = UNIVERSE_SIZE / density;
    const halfSize = UNIVERSE_SIZE / 2;
    const yLayers = isFlat ? 1 : density;
    vertexCount = density * yLayers * density;

    basePositions = new Float32Array(vertexCount * 3);
    positions = new Float32Array(vertexCount * 3);
    colors = new Float32Array(vertexCount * 3);

    // Fill base positions
    // Flat mode: XY plane at z=-8 (backdrop like old 2D grid), larger scale
    const flatZ = -8;
    const flatScale = isFlat ? 4.0 : 1.0; // Flat grid is 4x larger to fill backdrop
    let idx = 0;
    for (let ix = 0; ix < density; ix++) {
        for (let iy = 0; iy < yLayers; iy++) {
            for (let iz = 0; iz < density; iz++) {
                if (isFlat) {
                    // XY plane at z=flatZ
                    basePositions[idx]     = (-halfSize + ix * spacing + spacing * 0.5) * flatScale;
                    basePositions[idx + 1] = (-halfSize + iz * spacing + spacing * 0.5) * flatScale;
                    basePositions[idx + 2] = flatZ;
                } else {
                    basePositions[idx]     = -halfSize + ix * spacing + spacing * 0.5;
                    basePositions[idx + 1] = -halfSize + iy * spacing + spacing * 0.5;
                    basePositions[idx + 2] = -halfSize + iz * spacing + spacing * 0.5;
                }
                idx += 3;
            }
        }
    }
    // Copy base to warped
    positions.set(basePositions);
    // Default color: dim blue
    for (let i = 0; i < vertexCount * 3; i += 3) {
        colors[i] = 0.15;
        colors[i + 1] = 0.2;
        colors[i + 2] = 0.6;
    }

    // Build index buffer for line segments
    const indices = [];
    for (let ix = 0; ix < density; ix++) {
        for (let iy = 0; iy < yLayers; iy++) {
            for (let iz = 0; iz < density; iz++) {
                const current = ix * yLayers * density + iy * density + iz;
                // X+1 neighbor
                if (ix < density - 1) {
                    indices.push(current, (ix + 1) * yLayers * density + iy * density + iz);
                }
                // Y+1 neighbor (only in 3D mode)
                if (!isFlat && iy < yLayers - 1) {
                    indices.push(current, ix * yLayers * density + (iy + 1) * density + iz);
                }
                // Z+1 neighbor
                if (iz < density - 1) {
                    indices.push(current, ix * yLayers * density + iy * density + (iz + 1));
                }
            }
        }
    }

    // Shared buffer attributes
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const colAttr = new THREE.BufferAttribute(colors, 3);
    colAttr.setUsage(THREE.DynamicDrawUsage);

    // Line segments geometry
    gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', posAttr);
    gridGeo.setAttribute('color', colAttr);
    gridGeo.setIndex(new THREE.BufferAttribute(
        vertexCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices), 1
    ));

    const lineMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    state.grid3dMesh = new THREE.LineSegments(gridGeo, lineMat);
    state.grid3dMesh.frustumCulled = false;

    // Points geometry (shares same data)
    pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute('position', posAttr);
    pointGeo.setAttribute('color', colAttr);

    if (!cloudTexture) cloudTexture = makeCloudTexture();

    const pointMat = new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        alphaTest: 0.05,
        map: cloudTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    state.grid3dPointCloud = new THREE.Points(pointGeo, pointMat);
    state.grid3dPointCloud.frustumCulled = false;
}

// ── Probe construction ─────────────────────────────────────────────────────
function buildProbe() {
    const geo = new THREE.SphereGeometry(2, 24, 24);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x00ff66,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    state.grid3dProbeMesh = new THREE.Mesh(geo, mat);
    state.grid3dProbeMesh.frustumCulled = false;

    // Store original vertex positions
    const posArr = geo.attributes.position.array;
    probeBasePositions = new Float32Array(posArr.length);
    probeBasePositions.set(posArr);

    // Initial position: distance 25 from origin
    state.grid3dProbeMesh.position.set(25, 0, 0);
    probeVelocity.set(-0.3, 0.1, 0.05);
}

// ── Accessory construction ─────────────────────────────────────────────────
function buildAccessories() {
    // Snow globe
    const globeGeo = new THREE.SphereGeometry(1, 64, 64);
    const globeMat = new THREE.MeshBasicMaterial({
        color: 0x4488ff,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
        side: THREE.BackSide,
        depthWrite: false
    });
    state.grid3dGlobeMesh = new THREE.Mesh(globeGeo, globeMat);
    state.grid3dGlobeMesh.frustumCulled = false;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function createGrid3d() {
    // 1. Build the initial 3D grid
    buildGrid3dInternal(state.grid3dDensity);

    // 2. Create probe sphere
    buildProbe();

    // 3. Create accessories (globe)
    buildAccessories();

    // 4. Add everything to scene
    state.scene.add(state.grid3dMesh);
    state.scene.add(state.grid3dPointCloud);
    state.scene.add(state.grid3dProbeMesh);
    state.scene.add(state.grid3dGlobeMesh);

    // 5. Set all invisible initially
    state.grid3dMesh.visible = false;
    state.grid3dPointCloud.visible = false;
    state.grid3dProbeMesh.visible = false;
    state.grid3dGlobeMesh.visible = false;
}

export function rebuildGrid3d() {
    // Remove old grid meshes from scene and dispose
    if (state.grid3dMesh) {
        state.scene.remove(state.grid3dMesh);
        state.grid3dMesh.geometry.dispose();
        state.grid3dMesh.material.dispose();
        state.grid3dMesh = null;
    }
    if (state.grid3dPointCloud) {
        state.scene.remove(state.grid3dPointCloud);
        state.grid3dPointCloud.geometry.dispose();
        state.grid3dPointCloud.material.dispose();
        state.grid3dPointCloud = null;
    }

    // Rebuild with new density
    buildGrid3dInternal(state.grid3dDensity);

    // Re-add to scene
    state.scene.add(state.grid3dMesh);
    state.scene.add(state.grid3dPointCloud);

    // Apply current visibility
    const isWireframe = state.grid3dRenderMode === 'wireframe';
    state.grid3dMesh.visible = state.gridMode !== 'off' && isWireframe;
    state.grid3dPointCloud.visible = state.gridMode !== 'off' && !isWireframe;
}

export function animateGrid3d(dt) {
    // ── Visibility gate ────────────────────────────────────────────────
    if (state.gridMode === 'off') {
        const meshes = [
            state.grid3dMesh, state.grid3dPointCloud,
            state.grid3dProbeMesh, state.grid3dGlobeMesh
        ];
        for (let i = 0; i < meshes.length; i++) {
            if (meshes[i]) meshes[i].visible = false;
        }
        return;
    }

    const isFlat = state.gridMode === 'flat';
    // Flat mode: much weaker gravity (backdrop effect), 3D mode: full strength
    const mass = isFlat ? Math.min(state.swarmGravity * 0.05, 3.0) : state.swarmGravity;
    const eventHorizon = state.z_depth * state.novaScale;
    const renderRadius = isFlat ? 999 : state.grid3dRenderRadius; // Flat grid always fully visible
    const isBlackHole = state.isBlackHoleMode;
    const isSnowGlobe = state.grid3dSnowGlobe;
    const isWireframe = state.grid3dRenderMode === 'wireframe';
    const timeScale = state.grid3dTimeScale;

    // Mass center
    // In relative motion mode, use the logical position (polyGroup stays at origin visually)
    const massPos = (state.grid3dRelativeMotion && state._grid3dLogicalPos)
        ? state._grid3dLogicalPos
        : state.polyGroup.position;

    // ── Toggle mesh visibility ─────────────────────────────────────────
    if (state.grid3dMesh) state.grid3dMesh.visible = isWireframe;
    if (state.grid3dPointCloud) state.grid3dPointCloud.visible = !isWireframe;
    if (state.grid3dProbeMesh) state.grid3dProbeMesh.visible = !isFlat && state.grid3dShowProbe;
    if (state.grid3dGlobeMesh) state.grid3dGlobeMesh.visible = !isFlat && isSnowGlobe;

    // ── Relative motion offset ─────────────────────────────────────────
    if (state.grid3dRelativeMotion) {
        gridOffset.set(-massPos.x, -massPos.y, -massPos.z);
    } else {
        gridOffset.set(0, 0, 0);
    }

    // ── Warp grid vertices ─────────────────────────────────────────────
    if (basePositions && positions && colors) {
        const renderRadSq = renderRadius * renderRadius;

        for (let i = 0; i < vertexCount; i++) {
            const i3 = i * 3;

            // Base position + offset for relative motion
            const bx = basePositions[i3]     + gridOffset.x;
            const by = basePositions[i3 + 1] + gridOffset.y;
            const bz = basePositions[i3 + 2] + gridOffset.z;

            let dx, dy, dz, dist, distSq, pull, nx, ny, nz;

            if (isFlat) {
                // Flat mode: Gaussian Z-dip based on XY distance from mass projection
                dx = bx - massPos.x;
                dy = by - massPos.y;
                distSq = dx * dx + dy * dy;
                dist = Math.sqrt(distSq);
                const influenceRadius = Math.max(mass * 2.5, 1.0);
                const zOffset = -(mass * 10.0) * Math.exp(-distSq / (influenceRadius * influenceRadius));
                nx = bx;
                ny = by;
                nz = bz + zOffset;
                pull = Math.abs(zOffset) / 10.0; // For color intensity
            } else {
                // 3D mode: radial pull toward mass center
                if (state.grid3dRelativeMotion) {
                    dx = -bx; dy = -by; dz = -bz;
                } else {
                    dx = massPos.x - bx;
                    dy = massPos.y - by;
                    dz = massPos.z - bz;
                }

                distSq = dx * dx + dy * dy + dz * dz;
                dist = Math.sqrt(distSq);

                if (isBlackHole) {
                    pull = (mass / 2) / (Math.pow(dist, 1.5) + 1);
                } else {
                    pull = (mass / 10) / (distSq + 1);
                }

                if (pull > dist - eventHorizon) {
                    pull = Math.max(0, dist - eventHorizon);
                }

                if (dist > 0.001) {
                    const invDist = 1 / dist;
                    nx = bx + dx * invDist * pull;
                    ny = by + dy * invDist * pull;
                    nz = bz + dz * invDist * pull;
                } else {
                    nx = bx; ny = by; nz = bz;
                }
            }

            positions[i3]     = nx;
            positions[i3 + 1] = ny;
            positions[i3 + 2] = nz;

            // ── Color ──────────────────────────────────────────────────
            if (isFlat) {
                // Flat mode: use grid gradient colors with distance-based fade
                _flatColor1 = _flatColor1 || new THREE.Color();
                _flatColor2 = _flatColor2 || new THREE.Color();
                _flatColor1.set(state.colors.grid[0]);
                _flatColor2.set(state.colors.grid[1]);
                const c1 = _flatColor1;
                const c2 = _flatColor2;
                const xyDist = Math.sqrt((bx - massPos.x) ** 2 + (by - massPos.y) ** 2);
                const t = Math.min(xyDist / 50.0, 1.0);
                const cr = c1.r + (c2.r - c1.r) * t;
                const cg = c1.g + (c2.g - c1.g) * t;
                const cb = c1.b + (c2.b - c1.b) * t;
                // Brighten near gravity well
                const warpBright = Math.min(1.0, pull * 3.0);
                colors[i3]     = cr + warpBright * 0.3;
                colors[i3 + 1] = cg + warpBright * 0.1;
                colors[i3 + 2] = cb + warpBright * 0.4;
            } else {
                const intensity = Math.min(pull / (dist + 0.5), 1.0);
                let hue, sat, light;
                if (isBlackHole) {
                    hue = 0.15 - intensity * 0.15;
                    sat = 1.0;
                    light = 0.1 + intensity * 0.6;
                    if (dist < eventHorizon * 2) {
                        light = Math.min(1.0, light + 0.3 * (1 - dist / (eventHorizon * 2)));
                    }
                } else {
                    hue = 0.6 - intensity * 0.6;
                    sat = 1.0;
                    light = 0.08 + intensity * 0.45;
                }

                let alpha = 1.0;
                const distFromMass = dist;
                if (isSnowGlobe) {
                    if (distFromMass > renderRadius) alpha = 0.0;
                } else {
                    if (distFromMass > renderRadius * 0.7) {
                        alpha = Math.max(0, 1.0 - (distFromMass - renderRadius * 0.7) / (renderRadius * 0.3));
                    }
                }

                const [cr, cg, cb] = hslToRgb(hue, sat, light);
                colors[i3]     = cr * alpha;
                colors[i3 + 1] = cg * alpha;
                colors[i3 + 2] = cb * alpha;
            }
        }

        // Mark attributes for GPU upload
        gridGeo.attributes.position.needsUpdate = true;
        gridGeo.attributes.color.needsUpdate = true;
        // pointGeo shares the same attributes, no separate update needed
    }

    // ── Probe physics ──────────────────────────────────────────────────
    if (state.grid3dShowProbe && state.grid3dProbeMesh) {
        const probePos = state.grid3dProbeMesh.position;

        // Drift toward mass
        _toMass.set(
            massPos.x - probePos.x,
            massPos.y - probePos.y,
            massPos.z - probePos.z
        );
        const probeDist = _toMass.length();

        if (probeDist > 0.001) {
            const probePull = (mass * 0.3) / (probeDist * probeDist + 1);
            _toMass.normalize().multiplyScalar(probePull * dt * timeScale);
            probeVelocity.add(_toMass);
        }

        probePos.add(_v.copy(probeVelocity).multiplyScalar(dt * timeScale));

        // Absorbed? Respawn
        const distToMass = probePos.distanceTo(massPos);
        if (distToMass < eventHorizon * 0.8) {
            // Respawn at distance 25, velocity pointing inward
            const angle = Math.random() * Math.PI * 2;
            const elevation = (Math.random() - 0.5) * Math.PI;
            probePos.set(
                massPos.x + 25 * Math.cos(elevation) * Math.cos(angle),
                massPos.y + 25 * Math.sin(elevation),
                massPos.z + 25 * Math.cos(elevation) * Math.sin(angle)
            );
            _dir.set(
                massPos.x - probePos.x,
                massPos.y - probePos.y,
                massPos.z - probePos.z
            ).normalize().multiplyScalar(0.5);
            probeVelocity.copy(_dir);
        }

        // Warp probe vertices with gravity
        const geo = state.grid3dProbeMesh.geometry;
        const posArr = geo.attributes.position.array;
        const count = posArr.length / 3;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            // World position of this probe vertex
            const wx = probeBasePositions[i3]     + probePos.x;
            const wy = probeBasePositions[i3 + 1] + probePos.y;
            const wz = probeBasePositions[i3 + 2] + probePos.z;

            const dx = massPos.x - wx;
            const dy = massPos.y - wy;
            const dz = massPos.z - wz;
            const distSq = dx * dx + dy * dy + dz * dz;
            const dist = Math.sqrt(distSq);

            let pull;
            if (isBlackHole) {
                pull = (mass / 2) / (Math.pow(dist, 1.5) + 1);
            } else {
                pull = (mass / 10) / (distSq + 1);
            }
            if (pull > dist - eventHorizon) {
                pull = Math.max(0, dist - eventHorizon);
            }

            if (dist > 0.001) {
                const invDist = 1 / dist;
                // Local offset (subtract probePos to keep in local space)
                posArr[i3]     = probeBasePositions[i3]     + dx * invDist * pull;
                posArr[i3 + 1] = probeBasePositions[i3 + 1] + dy * invDist * pull;
                posArr[i3 + 2] = probeBasePositions[i3 + 2] + dz * invDist * pull;
            } else {
                posArr[i3]     = probeBasePositions[i3];
                posArr[i3 + 1] = probeBasePositions[i3 + 1];
                posArr[i3 + 2] = probeBasePositions[i3 + 2];
            }
        }
        geo.attributes.position.needsUpdate = true;
    }

    // ── Accessories ────────────────────────────────────────────────────

    // Snow globe: scales to render radius, positioned at mass
    if (state.grid3dGlobeMesh) {
        if (state.grid3dRelativeMotion) {
            state.grid3dGlobeMesh.position.set(0, 0, 0);
        } else {
            state.grid3dGlobeMesh.position.copy(massPos);
        }
        state.grid3dGlobeMesh.scale.setScalar(renderRadius);
    }
}
