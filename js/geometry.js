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
