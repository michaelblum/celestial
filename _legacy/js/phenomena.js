import state from './state.js';

export function createPhenomena() {
    // Pulsar Beams
    state.pulsarGroup = new THREE.Group();
    state.pulsarGroup.visible = false;

    const beamGeo = new THREE.CylinderGeometry(0.15, 0.15, 4.0, 16, 16, true);
    const beamPos = beamGeo.attributes.position;
    for (let i = 0; i < beamPos.count; i++) {
        let scale = 1.0 - 0.5 * (Math.abs(beamPos.getY(i)) / 2.0);
        beamPos.setX(i, beamPos.getX(i) * scale);
        beamPos.setZ(i, beamPos.getZ(i) * scale);
    }
    beamGeo.computeVertexNormals();

    state.beamMat = new THREE.MeshBasicMaterial({
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    state.pulsarGroup.add(new THREE.Mesh(beamGeo, state.beamMat));
    state.polyGroup.add(state.pulsarGroup);

    // Gamma Rays
    state.gammaRaysGroup = new THREE.Group();
    state.gammaRaysGroup.visible = false;

    state.gammaBeamMat = new THREE.MeshBasicMaterial({
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    state.gammaRaysGroup.add(new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 15.0, 16, 1, true), state.gammaBeamMat
    ));
    state.polyGroup.add(state.gammaRaysGroup);

    // Accretion Disk
    state.accretionGroup = new THREE.Group();
    state.accretionGroup.visible = false;

    state.diskMat = new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0.15, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false
    });
    let diskMesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 4.0, 128), state.diskMat);
    diskMesh.rotation.x = Math.PI / 2;
    state.accretionGroup.add(diskMesh);

    for (let i = 0; i < 10; i++) {
        let rMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
            transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false
        }));
        rMesh.rotation.x = Math.PI / 2;
        rMesh.position.y = 0.01 + (i * 0.002);
        state.accretionGroup.add(rMesh);

        state.accretionRings.push({
            mesh: rMesh,
            radius: 4.0 * (i / 10),
            targetW: 4.0 * (0.1 + Math.random() * 0.2),
            targetOp: 0.5 + Math.random() * 0.25
        });
    }
    state.polyGroup.add(state.accretionGroup);

    // True Point Flash
    let ptGeo = new THREE.BufferGeometry();
    ptGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
    state.flashVoxel = new THREE.Points(ptGeo, new THREE.PointsMaterial({
        color: 0xffffff, size: 3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false
    }));
    state.polyGroup.add(state.flashVoxel);

    // Neutrinos
    state.neutrinoGroup = new THREE.Group();
    state.neutrinoGroup.visible = false;
    state.neutrinoMat = new THREE.SpriteMaterial({ blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 150; i++) {
        let p = new THREE.Sprite(state.neutrinoMat);
        p.scale.set(0.12, 0.12, 1);
        state.neutrinoGroup.add(p);
        state.neutrinoParticles.push({
            mesh: p,
            yPos: (Math.random() - 0.5) * 8.0,
            speed: Math.random() * 2.5 + 1.5,
            dir: Math.random() > 0.5 ? 1 : -1,
            xOffset: (Math.random() - 0.5) * 0.075,
            zOffset: (Math.random() - 0.5) * 0.075
        });
    }
    state.polyGroup.add(state.neutrinoGroup);
}

export function animatePhenomena(dt) {
    // Accretion Disk Animation
    if (state.isAccretionEnabled && state.accretionRings && !state.isDestroyed) {
        let triggeredFlash = false;
        const c1 = new THREE.Color(state.colors.accretion[0]);
        const c2 = new THREE.Color(state.colors.accretion[1]);

        state.accretionRings.forEach(ring => {
            let speed = 0.2 + (1.5 / Math.max(ring.radius, 0.4));
            ring.radius -= speed * dt;

            if (ring.radius <= 0) {
                ring.radius = 4.0;
                ring.targetW = 4.0 * (0.1 + Math.random() * 0.2);
                ring.targetOp = 0.5 + Math.random() * 0.25;
                triggeredFlash = true;
            }

            let currentR = ring.radius;
            let currentW = 0.01;
            let currentOp = 0;

            if (currentR > 3.0) {
                let t = (4.0 - currentR) / 1.0;
                currentW = 0.01 + (ring.targetW - 0.01) * t;
                currentOp = ring.targetOp * t;
            } else if (currentR > 1.0) {
                currentW = ring.targetW;
                currentOp = ring.targetOp;
            } else {
                let t = currentR / 1.0;
                currentW = ring.targetW * Math.max(t, 0.001);
                currentOp = ring.targetOp;
            }

            if (currentR > 0.001) {
                ring.mesh.visible = true;
                if (ring.mesh.geometry) ring.mesh.geometry.dispose();
                let innerR = Math.max(0.0001, currentR - currentW / 2);
                let outerR = Math.max(innerR + 0.0001, currentR + currentW / 2);
                ring.mesh.geometry = new THREE.RingGeometry(innerR, outerR, 128);
                ring.mesh.material.opacity = currentOp;
                ring.mesh.material.color.copy(c1).lerp(c2, currentR / 4.0);
            } else {
                ring.mesh.visible = false;
            }
        });

        if (triggeredFlash) state.voxelFlashTimer = 1.0;
    } else {
        state.voxelFlashTimer = 0;
        if (state.isDestroyed && state.accretionRings) {
            state.accretionRings.forEach(ring => ring.mesh.visible = false);
        }
    }

    // Voxel Flash
    if (state.voxelFlashTimer > 0 && !state.isDestroyed) {
        state.voxelFlashTimer -= dt * 6.0;
        if (state.flashVoxel) state.flashVoxel.material.opacity = Math.max(0, state.voxelFlashTimer);
    } else if (state.flashVoxel) {
        state.flashVoxel.material.opacity = 0;
    }

    // Neutrinos
    if (state.isNeutrinosEnabled && state.neutrinoParticles && !state.isDestroyed) {
        state.neutrinoParticles.forEach(p => {
            p.yPos += p.speed * p.dir * dt * 3.0;
            if (Math.abs(p.yPos) > 3.5) {
                p.yPos = 0;
                let r = Math.random() * 0.075;
                let theta = Math.random() * Math.PI * 2;
                p.xOffset = r * Math.cos(theta);
                p.zOffset = r * Math.sin(theta);
            }
            p.mesh.position.set(p.xOffset, p.yPos, p.zOffset);
            p.mesh.material.opacity = 1.0 - (Math.abs(p.yPos) / 3.5);
        });
    }
}
