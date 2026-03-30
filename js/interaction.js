import state from './state.js';

// Camera orbit state (used when 3D grid is active)
let cameraOrbitTheta = 0;       // horizontal angle
let cameraOrbitPhi = Math.PI / 4; // vertical angle (start at 45°)
let cameraOrbitRadius = 7.5;    // initial camera distance
let cameraOrbitInitialized = false;

// Camera transition state (smooth reorientation on mode switch)
let _camTransition = null;  // { startTheta, startPhi, startRadius, targetTheta, targetPhi, targetRadius, progress }

export function resetCameraOrbit() {
    cameraOrbitInitialized = false;
}

/** Start a smooth camera transition to the head-on flat view */
export function transitionToFlatView() {
    // Capture current orbit state
    if (!cameraOrbitInitialized) initCameraOrbit();
    // Normalize theta to [-π, π] for shortest-path interpolation
    let theta = cameraOrbitTheta % (2 * Math.PI);
    if (theta > Math.PI) theta -= 2 * Math.PI;
    if (theta < -Math.PI) theta += 2 * Math.PI;
    // Clamp target radius to flat-mode zoom range [2, 50]
    const targetRadius = Math.max(2, Math.min(50, cameraOrbitRadius));
    _camTransition = {
        startTheta: theta,
        startPhi: cameraOrbitPhi,
        startRadius: cameraOrbitRadius,
        targetTheta: 0,
        targetPhi: Math.PI / 2,   // equator = straight on
        targetRadius: targetRadius,
        progress: 0
    };
}

/** Advance the camera transition each frame. Returns true while active. */
export function updateCameraTransition(dt) {
    if (!_camTransition) return false;
    const speed = 3.0;  // ~0.33s for full transition
    _camTransition.progress = Math.min(1, _camTransition.progress + dt * speed);
    // Smooth ease-out
    const t = 1 - Math.pow(1 - _camTransition.progress, 3);

    const theta = _camTransition.startTheta + (_camTransition.targetTheta - _camTransition.startTheta) * t;
    const phi = _camTransition.startPhi + (_camTransition.targetPhi - _camTransition.startPhi) * t;
    const radius = _camTransition.startRadius + (_camTransition.targetRadius - _camTransition.startRadius) * t;

    cameraOrbitTheta = theta;
    cameraOrbitPhi = phi;
    cameraOrbitRadius = radius;

    state.camera.position.set(
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta)
    );
    state.camera.lookAt(0, 0, 0);

    if (_camTransition.progress >= 1) {
        // Snap to exact head-on and transfer to flat-mode camera z
        state.perspCamera.position.set(0, 0, radius);
        state.perspCamera.lookAt(0, 0, 0);
        cameraOrbitTheta = 0;
        cameraOrbitPhi = Math.PI / 2;
        _camTransition = null;
        return false;
    }
    return true;
}

function initCameraOrbit() {
    const pos = state.camera.position;
    cameraOrbitRadius = pos.length();
    cameraOrbitTheta = Math.atan2(pos.x, pos.z);
    cameraOrbitPhi = Math.acos(Math.min(1, Math.max(-1, pos.y / cameraOrbitRadius)));
    cameraOrbitInitialized = true;
}

function handleMove(clientX, clientY) {
    const mouse = new THREE.Vector2(
        (clientX / window.innerWidth) * 2 - 1,
        -(clientY / window.innerHeight) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, state.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const pos = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, pos)) {
        const travelVector = new THREE.Vector3().subVectors(pos, state.polyGroup.position);
        if (travelVector.length() > 0.1) {
            state.moveRotationAxis.crossVectors(travelVector, new THREE.Vector3(0, 0, 1)).normalize();
            state.moveRotationSpeed = Math.min(travelVector.length() * 0.15, 0.4);
        }
        state.targetPosition.copy(pos);
    }
}

// Sync sidebar values into the unified context menu
function _syncContextMenu() {
    const sync = (ctxId, srcId) => {
        const ctx = document.getElementById(ctxId);
        const src = document.getElementById(srcId);
        if (!ctx || !src) return;
        if (ctx.type === 'checkbox') ctx.checked = src.checked;
        else ctx.value = src.value;
    };

    // Geometry tab
    sync('ctx-shape', 'shapeSelect');
    sync('ctx-color', 'masterColor1');
    sync('ctx-opacity', 'opacitySlider');
    sync('ctx-edge-opacity', 'edgeOpacitySlider');
    sync('ctx-stellation', 'stellationSlider');
    sync('ctx-omega-toggle', 'omegaToggle');
    sync('ctx-omega-shape', 'omegaShapeSelect');
    sync('ctx-omega-scale', 'omegaScaleSlider');
    sync('ctx-omega-stellation', 'omegaStellationSlider');

    // Appearance tab
    sync('ctx-master1', 'masterColor1');
    sync('ctx-master2', 'masterColor2');
    sync('ctx-preset', 'presetSelect');
    sync('ctx-face1', 'faceColor1');
    sync('ctx-face2', 'faceColor2');
    sync('ctx-edge1', 'edgeColor1');
    sync('ctx-edge2', 'edgeColor2');
    sync('ctx-aura1', 'auraColor1');
    sync('ctx-aura2', 'auraColor2');

    // Effects tab
    sync('ctx-pulsar', 'pulsarToggle');
    sync('ctx-accretion', 'accretionToggle');
    sync('ctx-gamma', 'gammaToggle');
    sync('ctx-neutrino', 'neutrinoToggle');
    sync('ctx-lightning-toggle', 'lightningToggle');
    sync('ctx-magnetic', 'magneticToggle');
    sync('ctx-swarm', 'swarmToggle');
    sync('ctx-blackhole', 'blackHoleModeToggle');
    sync('ctx-reach', 'auraReachSlider');
    sync('ctx-intensity', 'auraIntensitySlider');
    sync('ctx-spin', 'idleSpinSlider');
    sync('ctx-swarm-count', 'swarmCountSlider');
    sync('ctx-swarm-gravity', 'swarmGravitySlider');
    sync('ctx-swarm-horizon', 'swarmHorizonSlider');
    sync('ctx-lightning-length', 'lightningLengthSlider');
    sync('ctx-lightning-freq', 'lightningFreqSlider');
    sync('ctx-lightning-bright', 'lightningBrightSlider');

    // Environment tab
    sync('ctx-grid-mode', 'gridModeSelect');
    sync('ctx-grid3d-mode', 'grid3dRenderMode');
    sync('ctx-grid3d-density', 'grid3dDensitySlider');
    sync('ctx-grid3d-mass', 'grid3dMassSlider');
    sync('ctx-grid3d-radius', 'grid3dRadiusSlider');
    sync('ctx-grid3d-snowglobe', 'grid3dSnowGlobeToggle');
    sync('ctx-grid3d-probe', 'grid3dProbeToggle');
    sync('ctx-ortho', 'orthoToggle');
    sync('ctx-fov', 'fovSlider');
    sync('ctx-zdepth', 'zDepthSlider');
}

export function setupInteraction() {
    // Prevent default context menu
    window.addEventListener('contextmenu', e => e.preventDefault());

    // Unified context menu tab switching
    document.querySelectorAll('.ctx-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const menu = document.getElementById('ctx-unified');
            menu.querySelectorAll('.ctx-tab').forEach(t => t.classList.remove('active'));
            menu.querySelectorAll('.ctx-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById(tab.getAttribute('data-ctx-tab'));
            if (panel) panel.classList.add('active');
        });
    });

    // Close context menu on click outside or Escape
    window.addEventListener('mousedown', (e) => {
        const menu = document.getElementById('ctx-unified');
        if (menu && menu.classList.contains('visible') && !menu.contains(e.target) && e.button !== 2) {
            menu.classList.remove('visible');
            state.isMenuOpen = false;
        }
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const menu = document.getElementById('ctx-unified');
            if (menu) menu.classList.remove('visible');
            state.isMenuOpen = false;
        }
    });

    // Mouse Wheel Zoom
    window.addEventListener('wheel', (e) => {
        if (e.target.closest('#sidebar') || e.target.closest('.context-menu')) return;
        e.preventDefault();
        if (state.gridMode === '3d') {
            // Orbit zoom: adjust radius and reposition camera
            if (!cameraOrbitInitialized) initCameraOrbit();
            cameraOrbitRadius = Math.max(3, Math.min(80, cameraOrbitRadius + e.deltaY * 0.02));
            state.camera.position.set(
                cameraOrbitRadius * Math.sin(cameraOrbitPhi) * Math.sin(cameraOrbitTheta),
                cameraOrbitRadius * Math.cos(cameraOrbitPhi),
                cameraOrbitRadius * Math.sin(cameraOrbitPhi) * Math.cos(cameraOrbitTheta)
            );
            state.camera.lookAt(0, 0, 0);
            return;
        } else if (state.camera.isPerspectiveCamera) {
            state.perspCamera.position.z = Math.max(2, Math.min(50, state.perspCamera.position.z + e.deltaY * 0.01));
        } else {
            state.orthoCamera.zoom = Math.max(0.1, Math.min(10, state.orthoCamera.zoom - e.deltaY * 0.005));
            state.orthoCamera.updateProjectionMatrix();
        }
    }, { passive: false });

    // Mouse Down
    window.addEventListener('mousedown', (e) => {
        const isUI = e.target.closest('#sidebar') || e.target.closest('.context-menu');
        if (isUI) return;

        document.querySelectorAll('.context-menu').forEach(m => m.classList.remove('visible'));
        state.isMenuOpen = false;

        const mouse = new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, state.camera);

        let intersects = false;
        if (!state.isDestroyed) {
            if (state.coreMesh && state.coreMesh.visible && raycaster.intersectObject(state.coreMesh).length > 0) intersects = true;
            else if (state.depthMesh && state.depthMesh.visible && raycaster.intersectObject(state.depthMesh).length > 0) intersects = true;
            else {
                raycaster.params.Line.threshold = 0.2;
                if (state.wireframeMesh && raycaster.intersectObject(state.wireframeMesh).length > 0) intersects = true;
            }
        }

        if (e.button === 2) {
            state.isMenuOpen = true;
            const menu = document.getElementById('ctx-unified');
            if (!menu) return;

            // Close any existing context menus
            document.querySelectorAll('.context-menu').forEach(m => m.classList.remove('visible'));

            // Select the correct tab based on click target
            const targetTab = intersects ? 'ctx-geom' : 'ctx-environ';
            menu.querySelectorAll('.ctx-tab').forEach(t => t.classList.remove('active'));
            menu.querySelectorAll('.ctx-panel').forEach(p => p.classList.remove('active'));
            const tab = menu.querySelector(`[data-ctx-tab="${targetTab}"]`);
            const panel = document.getElementById(targetTab);
            if (tab) tab.classList.add('active');
            if (panel) panel.classList.add('active');

            // Sync ALL context menu values from sidebar
            _syncContextMenu();

            // Position the menu
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
            menu.classList.add('visible');

            setTimeout(() => {
                const rect = menu.getBoundingClientRect();
                if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
                if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
            }, 0);

        } else if (e.button === 0) {
            if (state.gridMode === '3d') {
                // 3D grid mode: ALL left-click = camera orbit. No object interaction.
                state.isDraggingObject = true;
                state.previousMouse.x = e.clientX;
                state.previousMouse.y = e.clientY;
            } else if (e.shiftKey) {
                if (intersects) {
                    state.isPanningObject = true;
                } else {
                    state.isPanningCamera = true;
                }
                state.previousMouse.x = e.clientX;
                state.previousMouse.y = e.clientY;
            } else {
                if (intersects) {
                    state.isDraggingObject = true;
                    state.previousMouse.x = e.clientX;
                    state.previousMouse.y = e.clientY;
                    state.lastMoveTime = performance.now();
                    state.dragVelocity = { x: 0, y: 0 };
                    state.dragMomentumSpeed = 0;
                } else if (!state.isPathEnabled && !state.isDestroyed) {
                    handleMove(e.clientX, e.clientY);
                }
            }
        }
    });

    // Mouse Move
    window.addEventListener('mousemove', (e) => {
        let dx = e.clientX - state.previousMouse.x;
        let dy = e.clientY - state.previousMouse.y;

        if (state.isPanningCamera) {
            let panSpeed = state.camera.isPerspectiveCamera
                ? (state.camera.position.z * 0.0015)
                : (1.0 / (state.orthoCamera.zoom * 20.0));
            state.camera.position.x -= dx * panSpeed;
            state.camera.position.y += dy * panSpeed;
            if (!state.isCenteredView) {
                state.targetPosition.x -= dx * panSpeed;
                state.targetPosition.y += dy * panSpeed;
            }
            state.previousMouse.x = e.clientX;
            state.previousMouse.y = e.clientY;
        } else if (state.isPanningObject && !state.isDestroyed) {
            let panSpeed = state.camera.isPerspectiveCamera
                ? (state.camera.position.z * 0.0015)
                : (1.0 / (state.orthoCamera.zoom * 20.0));
            state.polyGroup.position.x += dx * panSpeed;
            state.polyGroup.position.y -= dy * panSpeed;
            state.targetPosition.copy(state.polyGroup.position);
            state.previousMouse.x = e.clientX;
            state.previousMouse.y = e.clientY;
        } else if (state.isDraggingObject && state.gridMode === '3d') {
            // Camera orbit mode: orbit camera around the object
            if (!cameraOrbitInitialized) initCameraOrbit();
            cameraOrbitTheta -= dx * 0.005;
            cameraOrbitPhi = Math.max(0.1, Math.min(Math.PI - 0.1, cameraOrbitPhi + dy * 0.005));

            state.camera.position.set(
                cameraOrbitRadius * Math.sin(cameraOrbitPhi) * Math.sin(cameraOrbitTheta),
                cameraOrbitRadius * Math.cos(cameraOrbitPhi),
                cameraOrbitRadius * Math.sin(cameraOrbitPhi) * Math.cos(cameraOrbitTheta)
            );
            state.camera.lookAt(0, 0, 0);

            state.previousMouse.x = e.clientX;
            state.previousMouse.y = e.clientY;
        } else if (state.isDraggingObject && !state.isDestroyed) {
            let currentTime = performance.now();
            let dt = currentTime - state.lastMoveTime;

            if (dt > 0) {
                state.dragVelocity.x = (state.dragVelocity.x * 0.5) + ((dx / dt) * 0.5);
                state.dragVelocity.y = (state.dragVelocity.y * 0.5) + ((dy / dt) * 0.5);
            }

            let deltaRotationQuaternion = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(dy * 0.005, dx * 0.005, 0, 'XYZ')
            );
            state.polyGroup.quaternion.multiplyQuaternions(deltaRotationQuaternion, state.polyGroup.quaternion);

            state.previousMouse.x = e.clientX;
            state.previousMouse.y = e.clientY;
            state.lastMoveTime = currentTime;
        }
    });

    // Mouse Up
    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            state.isPanningCamera = false;
            state.isPanningObject = false;
            if (state.isDraggingObject) {
                state.isDraggingObject = false;
                // No drag momentum in 3D grid mode (camera orbit doesn't fling the object)
                if (!state.gridMode === '3d') {
                    let speed = Math.sqrt(state.dragVelocity.x ** 2 + state.dragVelocity.y ** 2);
                    if (speed > 0.05) {
                        state.dragMomentumAxis.set(state.dragVelocity.y, state.dragVelocity.x, 0).normalize();
                        state.dragMomentumSpeed = Math.min(speed * 0.05, 0.5);
                    }
                }
            }
        }
    });
}
