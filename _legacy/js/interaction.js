import state from './state.js';

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

export function setupInteraction() {
    // Prevent default context menu
    window.addEventListener('contextmenu', e => e.preventDefault());

    // Mouse Wheel Zoom
    window.addEventListener('wheel', (e) => {
        if (e.target.closest('#sidebar') || e.target.closest('.context-menu')) return;
        e.preventDefault();
        if (state.camera.isPerspectiveCamera) {
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
            const menu = intersects ? document.getElementById('ctx-object') : document.getElementById('ctx-env');

            if (intersects) {
                document.getElementById('ctx-shape').value = document.getElementById('shapeSelect').value;
                document.getElementById('ctx-color').value = document.getElementById('masterColor1').value;
                document.getElementById('ctx-opacity').value = document.getElementById('opacitySlider').value;
                document.getElementById('ctx-edge-opacity').value = document.getElementById('edgeOpacitySlider').value;
                document.getElementById('ctx-reach').value = document.getElementById('auraReachSlider').value;
                document.getElementById('ctx-intensity').value = document.getElementById('auraIntensitySlider').value;
                document.getElementById('ctx-spin').value = document.getElementById('idleSpinSlider').value;
            } else {
                document.getElementById('ctx-grid').checked = document.getElementById('gridToggle').checked;
                document.getElementById('ctx-grid-color').value = document.getElementById('gridColor1').value;
                document.getElementById('ctx-grid-bend').checked = document.getElementById('gridBendToggle').checked;
                document.getElementById('ctx-grid-mass').value = document.getElementById('gridMassSlider').value;
                document.getElementById('ctx-ortho').checked = document.getElementById('orthoToggle').checked;
                document.getElementById('ctx-fov').value = document.getElementById('fovSlider').value;
            }

            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
            menu.classList.add('visible');

            setTimeout(() => {
                const rect = menu.getBoundingClientRect();
                if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 10) + 'px';
                if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 10) + 'px';
            }, 0);

        } else if (e.button === 0) {
            if (e.shiftKey) {
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
                let speed = Math.sqrt(state.dragVelocity.x ** 2 + state.dragVelocity.y ** 2);
                if (speed > 0.05) {
                    state.dragMomentumAxis.set(state.dragVelocity.y, state.dragVelocity.x, 0).normalize();
                    state.dragMomentumSpeed = Math.min(speed * 0.05, 0.5);
                }
            }
        }
    });
}
