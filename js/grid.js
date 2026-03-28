import state from './state.js';

export function buildGrid() {
    if (!state.isGridEnabled) {
        if (state.gridHelper) state.gridHelper.visible = false;
        return;
    }
    if (state.gridHelper) {
        state.scene.remove(state.gridHelper);
        state.gridHelper.geometry.dispose();
        state.gridHelper.material.dispose();
    }

    const size = 100;
    const step = size / state.gridDivs;
    const halfSize = size / 2;
    const segmentsPerLine = Math.max(state.gridDivs, 60);
    const vertices = [];

    for (let i = 0, k = -halfSize; i <= state.gridDivs; i++, k += step) {
        for (let s = 0; s < segmentsPerLine; s++) {
            vertices.push(k, -halfSize + (s * size / segmentsPerLine), 0, k, -halfSize + ((s + 1) * size / segmentsPerLine), 0);
            vertices.push(-halfSize + (s * size / segmentsPerLine), k, 0, -halfSize + ((s + 1) * size / segmentsPerLine), k, 0);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('basePosition', new THREE.Float32BufferAttribute([...vertices], 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertices.length), 3));

    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3 });
    state.gridHelper = new THREE.LineSegments(geo, mat);
    state.gridHelper.position.z = -8;
    state.scene.add(state.gridHelper);
    updateGridColors();
}

export function updateGridColors() {
    if (!state.gridHelper || !state.gridHelper.visible) return;
    const pos = state.gridHelper.geometry.attributes.basePosition;
    const col = state.gridHelper.geometry.attributes.color;
    const c1 = new THREE.Color(state.colors.grid[0]);
    const c2 = new THREE.Color(state.colors.grid[1]);
    const tC = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        let dist = Math.sqrt(Math.pow(pos.getX(i), 2) + Math.pow(pos.getY(i), 2));
        tC.copy(c1).lerp(c2, Math.min(dist / 50.0, 1.0));
        col.setXYZ(i, tC.r, tC.g, tC.b);
    }
    col.needsUpdate = true;
}

export function animateGrid() {
    if (state.gridHelper && state.gridHelper.visible && state.gridHelper.geometry.attributes.basePosition) {
        const positions = state.gridHelper.geometry.attributes.position;
        const basePositions = state.gridHelper.geometry.attributes.basePosition;

        if (state.isGridBending && state.gridMass > 0) {
            let projectedPos = new THREE.Vector3();
            if (state.camera.isPerspectiveCamera) {
                let dir = new THREE.Vector3().subVectors(state.polyGroup.position, state.camera.position).normalize();
                let t = (-8 - state.camera.position.z) / dir.z;
                projectedPos.copy(state.camera.position).add(dir.multiplyScalar(t));
            } else {
                let dir = new THREE.Vector3();
                state.camera.getWorldDirection(dir);
                let t = (-8 - state.polyGroup.position.z) / dir.z;
                projectedPos.copy(state.polyGroup.position).add(dir.multiplyScalar(t));
            }
            state.gridHelper.worldToLocal(projectedPos);

            const influenceRadius = Math.max(state.gridMass * 2.5, 1.0);

            for (let i = 0; i < positions.count; i++) {
                const x = basePositions.getX(i);
                const y = basePositions.getY(i);
                const dx = x - projectedPos.x;
                const dy = y - projectedPos.y;
                const distSq = dx * dx + dy * dy;

                let zOffset = -(state.gridMass * 10.0) * Math.exp(-distSq / (influenceRadius * influenceRadius));
                positions.setZ(i, basePositions.getZ(i) + zOffset);
            }
            positions.needsUpdate = true;
        } else if (positions.getZ(0) !== basePositions.getZ(0)) {
            for (let i = 0; i < positions.count; i++) {
                positions.setZ(i, basePositions.getZ(i));
            }
            positions.needsUpdate = true;
        }
    }
}
