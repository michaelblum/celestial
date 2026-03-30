import state from './state.js';
import { updateFaceVertexColors, updateEdgeVertexColors } from './colors.js';

export function createStellatedGeometry(baseGeometry, factor) {
    const nonIndexed = baseGeometry.toNonIndexed();
    if (Math.abs(factor) < 0.01) { nonIndexed.computeVertexNormals(); return nonIndexed; }
    const positionAttribute = nonIndexed.getAttribute('position');
    const count = positionAttribute.count;
    const newVertices = [];
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
    const centroid = new THREE.Vector3(), normal = new THREE.Vector3();
    const cb = new THREE.Vector3(), ab = new THREE.Vector3();

    for (let i = 0; i < count; i += 3) {
        vA.fromBufferAttribute(positionAttribute, i);
        vB.fromBufferAttribute(positionAttribute, i + 1);
        vC.fromBufferAttribute(positionAttribute, i + 2);
        centroid.copy(vA).add(vB).add(vC).divideScalar(3);
        cb.subVectors(vC, vB); ab.subVectors(vA, vB);
        normal.crossVectors(cb, ab).normalize();
        const peak = new THREE.Vector3().copy(centroid).add(normal.multiplyScalar(factor));

        newVertices.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, peak.x, peak.y, peak.z);
        newVertices.push(vB.x, vB.y, vB.z, vC.x, vC.y, vC.z, peak.x, peak.y, peak.z);
        newVertices.push(vC.x, vC.y, vC.z, vA.x, vA.y, vA.z, peak.x, peak.y, peak.z);
    }
    const stellatedGeometry = new THREE.BufferGeometry();
    stellatedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newVertices, 3));
    stellatedGeometry.computeVertexNormals();
    return stellatedGeometry;
}

export function createPseudoTetartoid(size) {
    const geo = new THREE.DodecahedronGeometry(size, 0);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const angle = v.y * 0.4;
        v.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
}

export function updateGeometry(type) {
    if (state.coreMesh) state.polyGroup.remove(state.coreMesh);
    if (state.wireframeMesh) state.polyGroup.remove(state.wireframeMesh);
    if (state.depthMesh) state.polyGroup.remove(state.depthMesh);

    let baseGeometry;
    const size = 1.0;
    switch (type) {
        case 4: baseGeometry = new THREE.TetrahedronGeometry(size); break;
        case 8: baseGeometry = new THREE.OctahedronGeometry(size); break;
        case 12: baseGeometry = new THREE.DodecahedronGeometry(size); break;
        case 20: baseGeometry = new THREE.IcosahedronGeometry(size); break;
        case 90: baseGeometry = createPseudoTetartoid(size); break;
        case 91: baseGeometry = new THREE.TorusKnotGeometry(size * 0.6, size * 0.25, 64, 8); break;
        case 100: baseGeometry = new THREE.SphereGeometry(size, 32, 32); break;
        default: baseGeometry = new THREE.BoxGeometry(size, size, size); break;
    }

    const finalGeometry = createStellatedGeometry(baseGeometry, state.stellationFactor);

    const depthMat = new THREE.MeshBasicMaterial({
        colorWrite: false, side: THREE.FrontSide, depthWrite: true,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
    state.depthMesh = new THREE.Mesh(finalGeometry, depthMat);
    state.depthMesh.renderOrder = 2;
    state.depthMesh.visible = !state.isInteriorEdgesEnabled;
    state.polyGroup.add(state.depthMesh);

    const isSolid = state.currentOpacity >= 0.99;
    const coreMat = new THREE.MeshPhongMaterial({
        transparent: !isSolid, opacity: state.currentOpacity,
        shininess: state.isSpecularEnabled ? 80 : 0,
        specular: state.isSpecularEnabled ? new THREE.Color(0x333333) : new THREE.Color(0x000000),
        side: isSolid ? THREE.FrontSide : THREE.DoubleSide,
        depthWrite: isSolid,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
    state.coreMesh = new THREE.Mesh(finalGeometry, coreMat);
    state.coreMesh.renderOrder = 3;
    state.coreMesh.visible = !state.isMaskEnabled;
    state.polyGroup.add(state.coreMesh);

    const edgeGeo = new THREE.EdgesGeometry(finalGeometry);
    const edgeMat = new THREE.LineBasicMaterial({
        linewidth: 2, depthTest: true, transparent: true, opacity: state.currentEdgeOpacity
    });
    state.wireframeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    state.wireframeMesh.renderOrder = 4;
    state.polyGroup.add(state.wireframeMesh);

    updateFaceVertexColors();
    updateEdgeVertexColors();
}

export function updateOmegaGeometry(type) {
    if (state.omegaCoreMesh) state.omegaGroup.remove(state.omegaCoreMesh);
    if (state.omegaWireframeMesh) state.omegaGroup.remove(state.omegaWireframeMesh);
    if (state.omegaDepthMesh) state.omegaGroup.remove(state.omegaDepthMesh);

    let baseGeometry;
    const size = 1.0;
    switch (type) {
        case 4: baseGeometry = new THREE.TetrahedronGeometry(size); break;
        case 8: baseGeometry = new THREE.OctahedronGeometry(size); break;
        case 12: baseGeometry = new THREE.DodecahedronGeometry(size); break;
        case 20: baseGeometry = new THREE.IcosahedronGeometry(size); break;
        case 90: baseGeometry = createPseudoTetartoid(size); break;
        case 91: baseGeometry = new THREE.TorusKnotGeometry(size * 0.6, size * 0.25, 64, 8); break;
        case 100: baseGeometry = new THREE.SphereGeometry(size, 32, 32); break;
        default: baseGeometry = new THREE.BoxGeometry(size, size, size); break;
    }

    const finalGeometry = createStellatedGeometry(baseGeometry, state.omegaStellationFactor);

    // Depth pre-pass mesh
    const depthMat = new THREE.MeshBasicMaterial({
        colorWrite: false, side: THREE.FrontSide, depthWrite: true,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
    state.omegaDepthMesh = new THREE.Mesh(finalGeometry, depthMat);
    state.omegaDepthMesh.renderOrder = 2;
    state.omegaDepthMesh.visible = !state.omegaIsInteriorEdgesEnabled;
    state.omegaGroup.add(state.omegaDepthMesh);

    // Core face mesh
    const isSolid = state.omegaOpacity >= 0.99;
    const coreMat = new THREE.MeshPhongMaterial({
        transparent: !isSolid, opacity: state.omegaOpacity,
        shininess: state.omegaIsSpecularEnabled ? 80 : 0,
        specular: state.omegaIsSpecularEnabled ? new THREE.Color(0x333333) : new THREE.Color(0x000000),
        side: isSolid ? THREE.FrontSide : THREE.DoubleSide,
        depthWrite: isSolid,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
    state.omegaCoreMesh = new THREE.Mesh(finalGeometry, coreMat);
    state.omegaCoreMesh.renderOrder = 3;
    state.omegaCoreMesh.visible = !state.omegaIsMaskEnabled;
    state.omegaGroup.add(state.omegaCoreMesh);

    // Wireframe edge mesh
    const edgeGeo = new THREE.EdgesGeometry(finalGeometry);
    const edgeMat = new THREE.LineBasicMaterial({
        linewidth: 2, depthTest: true, transparent: true, opacity: state.omegaEdgeOpacity
    });
    state.omegaWireframeMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    state.omegaWireframeMesh.renderOrder = 4;
    state.omegaGroup.add(state.omegaWireframeMesh);

    // Apply vertex colors
    _updateOmegaFaceVertexColors();
    _updateOmegaEdgeVertexColors();
}

function _updateOmegaFaceVertexColors() {
    if (!state.omegaCoreMesh) return;
    const geo = state.omegaCoreMesh.geometry;
    const count = geo.attributes.position.count;
    if (!geo.attributes.color || geo.attributes.color.count !== count) {
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    }
    const col = geo.attributes.color;
    geo.computeBoundingBox();
    const min = geo.boundingBox.min.y;
    const range = (geo.boundingBox.max.y - min) || 1;
    const c1 = new THREE.Color(state.colors.omegaFace[0]);
    const c2 = new THREE.Color(state.colors.omegaFace[1]);
    const tC = new THREE.Color();
    for (let i = 0; i < count; i++) {
        tC.copy(c1).lerp(c2, (geo.attributes.position.getY(i) - min) / range);
        col.setXYZ(i, tC.r, tC.g, tC.b);
    }
    col.needsUpdate = true;
    state.omegaCoreMesh.material.vertexColors = true;
    state.omegaCoreMesh.material.color.setHex(0xffffff);
    if (state.omegaCoreMesh.material.map) { state.omegaCoreMesh.material.map.dispose(); state.omegaCoreMesh.material.map = null; }
    state.omegaCoreMesh.material.needsUpdate = true;
}

function _updateOmegaEdgeVertexColors() {
    if (!state.omegaWireframeMesh) return;
    const geo = state.omegaWireframeMesh.geometry;
    const count = geo.attributes.position.count;
    if (!geo.attributes.color || geo.attributes.color.count !== count) {
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    }
    const col = geo.attributes.color;
    geo.computeBoundingBox();
    const min = geo.boundingBox.min.y;
    const range = (geo.boundingBox.max.y - min) || 1;
    const c1 = new THREE.Color(state.colors.omegaEdge[0]);
    const c2 = new THREE.Color(state.colors.omegaEdge[1]);
    const tC = new THREE.Color();
    for (let i = 0; i < count; i++) {
        tC.copy(c1).lerp(c2, (geo.attributes.position.getY(i) - min) / range);
        col.setXYZ(i, tC.r, tC.g, tC.b);
    }
    col.needsUpdate = true;
    state.omegaWireframeMesh.material.vertexColors = true;
    state.omegaWireframeMesh.material.color.setHex(0xffffff);
    state.omegaWireframeMesh.material.needsUpdate = true;
}
