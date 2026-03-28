import state from './state.js';
import { updateGeometry } from './geometry.js';
import { updateAllColors } from './colors.js';
import { buildGrid, updateGridColors } from './grid.js';
import { updatePathVisual } from './pathing.js';
import { applyPreset } from './presets.js';

function makeEditable(id, getMin, getMax, isFloat, onChange) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('editable-val');
    el.title = "Click to type value";

    el.addEventListener('click', () => {
        const currentVal = el.innerText;
        const input = document.createElement('input');
        input.type = 'number';
        input.step = isFloat ? '0.01' : '1';
        input.value = currentVal;
        input.className = 'edit-input';
        input.style.width = Math.max(4, currentVal.length + 1) + 'ch';
        el.style.display = 'none';
        el.parentNode.insertBefore(input, el);
        input.focus();
        input.select();

        let isCommitted = false;
        function commit() {
            if (isCommitted) return;
            isCommitted = true;
            let val = parseFloat(input.value);
            if (isNaN(val)) val = parseFloat(currentVal);
            const min = typeof getMin === 'function' ? getMin() : getMin;
            const max = typeof getMax === 'function' ? getMax() : getMax;
            val = Math.max(min, Math.min(max, val));
            el.innerText = isFloat ? val.toFixed(input.step.includes('.') ? input.step.split('.')[1].length : 0) : Math.round(val).toString();
            el.style.display = '';
            if (input.parentNode) input.parentNode.removeChild(input);
            onChange(val);
        }
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
                if (isCommitted) return;
                isCommitted = true;
                el.style.display = '';
                if (input.parentNode) input.parentNode.removeChild(input);
            }
        });
    });
}

function updateOpacity(val) {
    state.currentOpacity = val;
    if (state.coreMesh) {
        const isSolid = state.currentOpacity >= 0.99;
        if (state.isMaskEnabled) {
            state.coreMesh.visible = false;
        } else {
            state.coreMesh.visible = true;
            state.coreMesh.material.opacity = state.currentOpacity;
            state.coreMesh.material.transparent = !isSolid;
            state.coreMesh.material.depthWrite = isSolid;
            state.coreMesh.material.side = isSolid ? THREE.FrontSide : THREE.DoubleSide;
            if (state.isSpecularEnabled) {
                state.coreMesh.material.specular = new THREE.Color(0x333333);
                state.coreMesh.material.shininess = 80;
            } else {
                state.coreMesh.material.specular = new THREE.Color(0x000000);
                state.coreMesh.material.shininess = 0;
            }
        }
        state.coreMesh.material.needsUpdate = true;
    }
}

function updateEdgeOpacity(val) {
    state.currentEdgeOpacity = val;
    if (state.wireframeMesh) {
        state.wireframeMesh.material.opacity = state.currentEdgeOpacity;
        state.wireframeMesh.material.needsUpdate = true;
    }
}

function updateFOV(val) {
    state.perspCamera.fov = val;
    state.perspCamera.updateProjectionMatrix();
}

function handleRangeChange() {
    updateDualSliderUI();
    document.getElementById('rangeMinVal').innerText = state.depth_range.min.toFixed(2);
    document.getElementById('rangeMaxVal').innerText = state.depth_range.max.toFixed(2);
    const zSlider = document.getElementById('zDepthSlider');
    zSlider.min = state.depth_range.min;
    zSlider.max = state.depth_range.max;
    if (state.z_depth < state.depth_range.min) triggerScaleAnimation(state.depth_range.min, -1);
    if (state.z_depth > state.depth_range.max) triggerScaleAnimation(state.depth_range.max, -1);
    updateStepsUI();
}

function updateDualSliderUI() {
    const minInput = document.getElementById('rangeMin');
    const maxInput = document.getElementById('rangeMax');
    const fill = document.getElementById('dualSliderFill');
    const totalRange = parseFloat(minInput.max) - parseFloat(minInput.min);
    const percentMin = ((state.depth_range.min - parseFloat(minInput.min)) / totalRange) * 100;
    const percentMax = ((state.depth_range.max - parseFloat(minInput.min)) / totalRange) * 100;
    fill.style.left = percentMin + '%';
    fill.style.width = (percentMax - percentMin) + '%';
}

function getDepthStops() {
    let stops = [];
    for (let i = 0; i < state.steps; i++) {
        let t = i / (state.steps - 1);
        stops.push(state.depth_range.min + t * (state.depth_range.max - state.depth_range.min));
    }
    return stops;
}

function triggerScaleAnimation(target_scale, step_index) {
    if (Math.abs(state.z_depth - target_scale) < 0.001) return;
    state.active_step = step_index;
    state.target_z_depth = target_scale;
    state.scale_anim_start_val = state.z_depth;
    state.scale_anim_start_time = performance.now();
    state.scale_anim_active = true;
}

export function updateStepsUI() {
    document.getElementById('stepsVal').innerText = state.steps;
    const container = document.getElementById('step-buttons-container');
    container.innerHTML = '';
    const stops = getDepthStops();
    for (let i = 0; i < state.steps; i++) {
        const btn = document.createElement('button');
        btn.className = `step-stop ${i === state.active_step ? 'active' : ''}`;
        btn.innerText = `S${i + 1}`;
        btn.title = `Scale: ${stops[i].toFixed(2)}`;
        btn.onclick = () => { state.active_step = i; updateStepsUI(); triggerScaleAnimation(stops[i], i); };
        container.appendChild(btn);
    }
}

function getConfig() {
    return {
        shape: state.currentGeometryType,
        colors: state.colors,
        stellation: state.stellationFactor,
        opacity: state.currentOpacity,
        edgeOpacity: state.currentEdgeOpacity,
        mask: state.isMaskEnabled,
        interiorEdges: state.isInteriorEdgesEnabled,
        specular: state.isSpecularEnabled,
        idleSpin: state.idleSpinSpeed,
        path: state.isPathEnabled,
        centeredView: state.isCenteredView,
        pathType: state.pathType,
        showPath: state.isShowPathEnabled,
        trail: state.isTrailEnabled,
        trailLength: state.trailLength,
        speed: state.pathSpeed,
        aura: state.isAuraEnabled,
        auraReach: state.auraReach,
        auraIntensity: state.auraIntensity,
        pulseRate: state.auraPulseRate,
        pulsar: state.isPulsarEnabled,
        accretion: state.isAccretionEnabled,
        gamma: state.isGammaEnabled,
        neutrinos: state.isNeutrinosEnabled,
        grid: state.isGridEnabled,
        gridDivs: state.gridDivs,
        gridBend: state.isGridBending,
        gridMass: state.gridMass,
        ortho: document.getElementById('orthoToggle').checked,
        fov: state.perspCamera.fov,
        rangeMin: state.depth_range.min,
        rangeMax: state.depth_range.max,
        zDepth: state.z_depth,
        steps: state.steps
    };
}

function applyConfig(c) {
    if (!c) return;
    const setUI = (id, val, strVal) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') {
            if (el.checked !== val) { el.checked = val; el.dispatchEvent(new Event('change')); }
        } else {
            el.value = val;
            if (strVal !== undefined) {
                const vDisp = document.getElementById(id.replace('Slider', 'Val'));
                if (vDisp) vDisp.innerText = strVal;
            }
            el.dispatchEvent(new Event('input'));
            el.dispatchEvent(new Event('change'));
        }
    };

    if (c.shape !== undefined) setUI('shapeSelect', c.shape);
    if (c.stellation !== undefined) setUI('stellationSlider', c.stellation, c.stellation.toFixed(2));
    if (c.opacity !== undefined) setUI('opacitySlider', c.opacity, c.opacity.toFixed(2));
    if (c.edgeOpacity !== undefined) setUI('edgeOpacitySlider', c.edgeOpacity, c.edgeOpacity.toFixed(2));
    if (c.mask !== undefined) setUI('maskToggle', c.mask);
    if (c.interiorEdges !== undefined) setUI('interiorEdgesToggle', c.interiorEdges);
    if (c.specular !== undefined) setUI('specularToggle', c.specular);
    if (c.idleSpin !== undefined) setUI('idleSpinSlider', c.idleSpin, c.idleSpin.toFixed(3));

    if (c.colors) {
        Object.keys(c.colors).forEach(k => {
            state.colors[k] = c.colors[k];
            setUI(k + 'Color1', state.colors[k][0]);
            setUI(k + 'Color2', state.colors[k][1]);
        });
    }

    if (c.path !== undefined) setUI('pathToggle', c.path);
    if (c.centeredView !== undefined) setUI('centeredViewToggle', c.centeredView);
    if (c.pathType !== undefined) setUI('pathTypeSelect', c.pathType);
    if (c.showPath !== undefined) setUI('showPathToggle', c.showPath);
    if (c.trail !== undefined) setUI('trailToggle', c.trail);
    if (c.trailLength !== undefined) setUI('trailLengthSlider', c.trailLength, c.trailLength);
    if (c.speed !== undefined) setUI('speedSlider', c.speed, c.speed.toFixed(1));
    if (c.aura !== undefined) setUI('auraToggle', c.aura);
    if (c.auraReach !== undefined) setUI('auraReachSlider', c.auraReach, c.auraReach.toFixed(2));
    if (c.auraIntensity !== undefined) setUI('auraIntensitySlider', c.auraIntensity, c.auraIntensity.toFixed(2));
    if (c.pulseRate !== undefined) setUI('pulseRateSlider', c.pulseRate, c.pulseRate.toFixed(3));
    if (c.pulsar !== undefined) setUI('pulsarToggle', c.pulsar);
    if (c.accretion !== undefined) setUI('accretionToggle', c.accretion);
    if (c.gamma !== undefined) setUI('gammaToggle', c.gamma);
    if (c.neutrinos !== undefined) setUI('neutrinoToggle', c.neutrinos);
    if (c.grid !== undefined) setUI('gridToggle', c.grid);
    if (c.gridDivs !== undefined) setUI('gridDivsSlider', c.gridDivs, c.gridDivs);
    if (c.gridBend !== undefined) setUI('gridBendToggle', c.gridBend);
    if (c.gridMass !== undefined) setUI('gridMassSlider', c.gridMass, c.gridMass.toFixed(1));
    if (c.ortho !== undefined) setUI('orthoToggle', c.ortho);
    if (c.fov !== undefined) setUI('fovSlider', c.fov, c.fov);
    if (c.rangeMin !== undefined) setUI('rangeMin', c.rangeMin, c.rangeMin.toFixed(2));
    if (c.rangeMax !== undefined) setUI('rangeMax', c.rangeMax, c.rangeMax.toFixed(2));
    if (c.zDepth !== undefined) setUI('zDepthSlider', c.zDepth, c.zDepth.toFixed(2));
    if (c.steps !== undefined) { state.steps = c.steps; updateStepsUI(); }

    updateAllColors();
}

function randomizeAll() {
    const setUI = (id, val, strVal) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') {
            if (el.checked !== val) { el.checked = val; el.dispatchEvent(new Event('change')); }
        } else {
            el.value = val;
            if (strVal !== undefined) {
                const vDisp = document.getElementById(id.replace('Slider', 'Val'));
                if (vDisp) vDisp.innerText = strVal;
            }
            el.dispatchEvent(new Event('input'));
            el.dispatchEvent(new Event('change'));
        }
    };

    const shapes = [4, 6, 8, 12, 20, 90, 91, 100];
    setUI('shapeSelect', shapes[Math.floor(Math.random() * shapes.length)]);

    let stellation = (Math.random() * 3 - 1).toFixed(2); setUI('stellationSlider', stellation, stellation);
    let opacity = Math.random().toFixed(2); setUI('opacitySlider', opacity, opacity);
    let edgeOpacity = (Math.random() * 0.8 + 0.2).toFixed(2); setUI('edgeOpacitySlider', edgeOpacity, edgeOpacity);
    let aReach = (Math.random() * 3).toFixed(2); setUI('auraReachSlider', aReach, aReach);
    let aInt = (Math.random() * 3).toFixed(2); setUI('auraIntensitySlider', aInt, aInt);
    let spin = (Math.random() * 0.025).toFixed(3); setUI('idleSpinSlider', spin, spin);
    let pulse = (Math.random() * 0.019 + 0.001).toFixed(3); setUI('pulseRateSlider', pulse, pulse);
    let mass = (Math.random() * 3).toFixed(1); setUI('gridMassSlider', mass, mass);

    setUI('pathToggle', Math.random() > 0.5);
    setUI('centeredViewToggle', Math.random() > 0.5);
    setUI('pathTypeSelect', Math.random() > 0.5 ? 'curve' : 'direct');
    setUI('trailToggle', Math.random() > 0.5);
    setUI('pulsarToggle', Math.random() > 0.7);
    setUI('accretionToggle', Math.random() > 0.7);
    setUI('gammaToggle', Math.random() > 0.7);
    setUI('neutrinoToggle', Math.random() > 0.7);

    let tailLen = Math.floor(Math.random() * 190 + 10); setUI('trailLengthSlider', tailLen, tailLen);
    let spd = (Math.random() * 9.9 + 0.1).toFixed(1); setUI('speedSlider', spd, spd);

    setUI('maskToggle', Math.random() > 0.5);
    setUI('interiorEdgesToggle', Math.random() > 0.5);
    setUI('specularToggle', Math.random() > 0.5);
    setUI('gridToggle', Math.random() > 0.5);
    setUI('gridBendToggle', Math.random() > 0.2);

    if (state.camera.isPerspectiveCamera) {
        state.perspCamera.position.z = Math.random() * 20 + 5;
    } else {
        state.orthoCamera.zoom = Math.random() * 4 + 0.5;
        state.orthoCamera.updateProjectionMatrix();
    }

    if (Math.random() > 0.5) {
        let c1 = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        let c2 = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        setUI('masterColor1', c1);
        setUI('masterColor2', c2);
    }
}

export function setupUI() {
    // Sidebar Navigation
    const navIcons = document.querySelectorAll('.nav-icon[data-target]');
    const panels = document.querySelectorAll('.panel');

    let isTitleScrolled = false;
    let hasScrolledOnce = false;
    const titleWrapper = document.getElementById('sidebar-title-wrapper');

    const checkScroll = (panel) => {
        if (panel.scrollTop > 10 && !isTitleScrolled) {
            isTitleScrolled = true;
            hasScrolledOnce = true;
            titleWrapper.classList.remove('scrolled-up');
            titleWrapper.classList.add('scrolled');
        } else if (panel.scrollTop <= 10 && isTitleScrolled) {
            isTitleScrolled = false;
            if (hasScrolledOnce) {
                titleWrapper.classList.remove('scrolled');
                titleWrapper.classList.add('scrolled-up');
            }
        }
    };

    panels.forEach(p => {
        p.addEventListener('scroll', () => {
            if (p.classList.contains('active')) checkScroll(p);
        });
    });

    navIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            navIcons.forEach(n => n.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));
            icon.classList.add('active');
            const targetPanel = document.getElementById(icon.getAttribute('data-target'));
            targetPanel.classList.add('active');
            document.getElementById('sidebar').classList.add('expanded');
            document.getElementById('sidebar').classList.remove('collapsed');
            checkScroll(targetPanel);
        });
    });

    document.getElementById('toggle-sidebar').addEventListener('click', () => {
        const sb = document.getElementById('sidebar');
        if (sb.classList.contains('expanded')) {
            sb.classList.remove('expanded'); sb.classList.add('collapsed');
        } else {
            sb.classList.remove('collapsed'); sb.classList.add('expanded');
        }
    });

    // Action Buttons
    document.getElementById('btn-randomize').addEventListener('click', randomizeAll);

    document.getElementById('btn-save').addEventListener('click', () => {
        const config = getConfig();
        const jsonStr = JSON.stringify(config, null, 2);
        const textArea = document.createElement("textarea");
        textArea.value = jsonStr;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus(); textArea.select();
        try { document.execCommand('copy'); } catch (err) { console.error("Clipboard fallback failed", err); }
        document.body.removeChild(textArea);

        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'celestial_config.json';
        a.click(); URL.revokeObjectURL(url);
    });

    document.getElementById('btn-load').addEventListener('click', () => {
        document.getElementById('file-loader').click();
    });

    document.getElementById('file-loader').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try { applyConfig(JSON.parse(ev.target.result)); } catch (err) { console.error('Invalid JSON file', err); }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // Master Gradient color pickers
    document.getElementById('masterColor1').addEventListener('input', (e) => {
        const v = e.target.value;
        ['face', 'edge', 'aura', 'grid', 'pulsar', 'accretion', 'gamma', 'neutrino'].forEach(k => {
            document.getElementById(k + 'Color1').value = v;
            state.colors[k][0] = v;
        });
        updateAllColors();
    });
    document.getElementById('masterColor2').addEventListener('input', (e) => {
        const v = e.target.value;
        ['face', 'edge', 'aura', 'grid', 'pulsar', 'accretion', 'gamma', 'neutrino'].forEach(k => {
            document.getElementById(k + 'Color2').value = v;
            state.colors[k][1] = v;
        });
        updateAllColors();
    });

    // Component gradient pickers
    ['face', 'edge', 'aura', 'grid', 'pulsar', 'accretion', 'gamma', 'neutrino'].forEach(k => {
        document.getElementById(k + 'Color1').addEventListener('input', e => { state.colors[k][0] = e.target.value; updateAllColors(); });
        document.getElementById(k + 'Color2').addEventListener('input', e => { state.colors[k][1] = e.target.value; updateAllColors(); });
    });

    // Context menu proxies
    const proxyInput = (ctxId, sidebarId) => {
        document.getElementById(ctxId).addEventListener('input', (e) => {
            const sideEl = document.getElementById(sidebarId);
            if (sideEl.type === 'checkbox') sideEl.checked = e.target.checked;
            else sideEl.value = e.target.value;
            sideEl.dispatchEvent(new Event('change'));
            sideEl.dispatchEvent(new Event('input'));
        });
    };
    proxyInput('ctx-shape', 'shapeSelect');
    proxyInput('ctx-opacity', 'opacitySlider');
    proxyInput('ctx-edge-opacity', 'edgeOpacitySlider');
    proxyInput('ctx-reach', 'auraReachSlider');
    proxyInput('ctx-intensity', 'auraIntensitySlider');
    proxyInput('ctx-spin', 'idleSpinSlider');
    proxyInput('ctx-grid', 'gridToggle');
    proxyInput('ctx-ortho', 'orthoToggle');
    proxyInput('ctx-fov', 'fovSlider');
    proxyInput('ctx-grid-bend', 'gridBendToggle');
    proxyInput('ctx-grid-mass', 'gridMassSlider');

    // Context menu color proxies to gradient primary
    document.getElementById('ctx-color').addEventListener('input', (e) => {
        const v = e.target.value;
        ['face', 'edge', 'aura', 'grid', 'pulsar', 'accretion', 'gamma', 'neutrino'].forEach(k => {
            document.getElementById(k + 'Color1').value = v;
            state.colors[k][0] = v;
        });
        updateAllColors();
    });
    document.getElementById('ctx-grid-color').addEventListener('input', (e) => {
        document.getElementById('gridColor1').value = e.target.value;
        state.colors.grid[0] = e.target.value;
        updateAllColors();
    });

    // Preset select
    document.getElementById('presetSelect').addEventListener('change', (e) => applyPreset(e.target.value));

    // Shape
    document.getElementById('shapeSelect').addEventListener('change', (e) => {
        state.currentGeometryType = parseInt(e.target.value);
        updateGeometry(state.currentGeometryType);
    });
    document.getElementById('stellationSlider').addEventListener('input', (e) => {
        state.stellationFactor = parseFloat(e.target.value);
        document.getElementById('stellationVal').innerText = state.stellationFactor.toFixed(2);
        updateGeometry(state.currentGeometryType);
    });

    // Opacity
    document.getElementById('opacitySlider').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('opacityVal').innerText = val.toFixed(2);
        updateOpacity(val);
    });
    document.getElementById('edgeOpacitySlider').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('edgeOpacityVal').innerText = val.toFixed(2);
        updateEdgeOpacity(val);
    });
    document.getElementById('maskToggle').addEventListener('change', (e) => { state.isMaskEnabled = e.target.checked; updateOpacity(state.currentOpacity); });
    document.getElementById('interiorEdgesToggle').addEventListener('change', (e) => {
        state.isInteriorEdgesEnabled = e.target.checked;
        if (state.depthMesh) state.depthMesh.visible = !state.isInteriorEdgesEnabled;
        updateOpacity(state.currentOpacity);
    });
    document.getElementById('specularToggle').addEventListener('change', (e) => { state.isSpecularEnabled = e.target.checked; updateOpacity(state.currentOpacity); });

    // Phenomena toggles
    document.getElementById('pulsarToggle').addEventListener('change', (e) => {
        state.isPulsarEnabled = e.target.checked;
        if (state.pulsarGroup) state.pulsarGroup.visible = state.isPulsarEnabled;
    });
    document.getElementById('accretionToggle').addEventListener('change', (e) => {
        state.isAccretionEnabled = e.target.checked;
        if (state.accretionGroup) state.accretionGroup.visible = state.isAccretionEnabled;
    });
    document.getElementById('gammaToggle').addEventListener('change', (e) => {
        state.isGammaEnabled = e.target.checked;
        if (state.gammaRaysGroup) state.gammaRaysGroup.visible = state.isGammaEnabled;
    });
    document.getElementById('neutrinoToggle').addEventListener('change', (e) => {
        state.isNeutrinosEnabled = e.target.checked;
        if (state.neutrinoGroup) state.neutrinoGroup.visible = state.isNeutrinosEnabled;
    });

    // Spin
    document.getElementById('idleSpinSlider').addEventListener('input', (e) => {
        state.idleSpinSpeed = parseFloat(e.target.value);
        document.getElementById('idleSpinVal').innerText = state.idleSpinSpeed.toFixed(3);
    });
    document.getElementById('btn-quick-spin').addEventListener('click', () => {
        state.quickSpinAxis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        state.quickSpinSpeed = 0.4;
        state.quickSpinActive = true;
        state.quickSpinEndTime = performance.now() + 2000;
    });

    // Aura
    document.getElementById('auraToggle').addEventListener('change', (e) => {
        state.isAuraEnabled = e.target.checked;
        document.getElementById('auraIntensityWrapper').style.display = state.isAuraEnabled ? 'block' : 'none';
    });
    document.getElementById('auraReachSlider').addEventListener('input', (e) => {
        state.auraReach = parseFloat(e.target.value);
        document.getElementById('auraReachVal').innerText = state.auraReach.toFixed(2);
    });
    document.getElementById('auraIntensitySlider').addEventListener('input', (e) => {
        state.auraIntensity = parseFloat(e.target.value);
        document.getElementById('auraIntensityVal').innerText = state.auraIntensity.toFixed(2);
    });
    document.getElementById('pulseRateSlider').addEventListener('input', (e) => {
        state.auraPulseRate = parseFloat(e.target.value);
        document.getElementById('pulseRateVal').innerText = state.auraPulseRate.toFixed(3);
    });
    document.getElementById('btn-spike').addEventListener('click', () => { state.auraSpike = 1.0; });
    document.getElementById('spikeMultiplier').addEventListener('input', (e) => { state.spikeMultiplier = parseFloat(e.target.value); });

    // Super Charge
    const btnCharge = document.getElementById('btn-supercharge');
    const startCharge = (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        state.isCharging = true; state.chargeTime = 0; state.chargeLevel = 0;
        state.collapseTime = 0; state.chargeReleaseTimer = 0;
        state.isShockwaveActive = false; state.wasFullCharge = false;
    };
    const endCharge = () => {
        if (state.isCharging) {
            state.isCharging = false;
            btnCharge.classList.remove('vibrate');
            document.getElementById('charge-fill').style.width = '0%';
            if (state.chargeTime > 0) {
                state.collapseTime = 0.75;
                state.wasFullCharge = (state.chargeLevel >= 0.99);
            }
            state.chargeTime = 0; state.chargeLevel = 0;
        }
    };
    btnCharge.addEventListener('mousedown', startCharge);
    btnCharge.addEventListener('touchstart', startCharge, { passive: true });
    window.addEventListener('mouseup', endCharge);
    window.addEventListener('touchend', endCharge);

    // Pathing
    document.getElementById('pathToggle').addEventListener('change', (e) => {
        state.isPathEnabled = e.target.checked;
        document.getElementById('pathSettings').style.display = state.isPathEnabled ? 'flex' : 'none';
        if (state.isPathEnabled) {
            state.polyGroup.position.set(0, 0, 0);
            state.targetPosition.copy(state.pathPoints[0]);
            state.pathProgress = 0; state.currentPathIndex = 0; state.segmentProgress = 0;
            updatePathVisual();
        } else {
            if (state.pathLine) { state.scene.remove(state.pathLine); state.pathLine = null; }
        }
    });
    document.getElementById('centeredViewToggle').addEventListener('change', (e) => { state.isCenteredView = e.target.checked; });
    document.getElementById('btn-pause').addEventListener('click', (e) => {
        state.isPaused = !state.isPaused;
        e.target.innerText = state.isPaused ? "Resume" : "Pause";
        e.target.style.background = state.isPaused ? "#bc13fe" : "";
    });
    document.getElementById('pathTypeSelect').addEventListener('change', (e) => { state.pathType = e.target.value; updatePathVisual(); });
    document.getElementById('speedSlider').addEventListener('input', (e) => {
        state.pathSpeed = parseFloat(e.target.value);
        document.getElementById('speedVal').innerText = state.pathSpeed.toFixed(1);
    });
    document.getElementById('showPathToggle').addEventListener('change', (e) => { state.isShowPathEnabled = e.target.checked; updatePathVisual(); });
    document.getElementById('trailToggle').addEventListener('change', (e) => {
        state.isTrailEnabled = e.target.checked;
        document.getElementById('trailSettings').style.display = state.isTrailEnabled ? 'flex' : 'none';
    });
    document.getElementById('trailLengthSlider').addEventListener('input', (e) => {
        state.trailLength = parseInt(e.target.value);
        document.getElementById('trailLengthVal').innerText = state.trailLength;
    });

    // Grid
    document.getElementById('gridToggle').addEventListener('change', (e) => {
        state.isGridEnabled = e.target.checked;
        document.getElementById('gridSettings').style.display = state.isGridEnabled ? 'block' : 'none';
        buildGrid();
    });
    document.getElementById('gridDivsSlider').addEventListener('input', (e) => {
        state.gridDivs = parseInt(e.target.value);
        document.getElementById('gridDivsVal').innerText = state.gridDivs;
        buildGrid();
    });
    document.getElementById('gridBendToggle').addEventListener('change', (e) => { state.isGridBending = e.target.checked; });
    document.getElementById('gridMassSlider').addEventListener('input', (e) => {
        state.gridMass = parseFloat(e.target.value);
        document.getElementById('gridMassVal').innerText = state.gridMass.toFixed(1);
    });

    // Camera
    document.getElementById('orthoToggle').addEventListener('change', (e) => {
        state.camera = e.target.checked ? state.orthoCamera : state.perspCamera;
        document.getElementById('fovGroup').style.opacity = e.target.checked ? '0.3' : '1';
        document.getElementById('fovSlider').disabled = e.target.checked;
    });
    document.getElementById('fovSlider').addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('fovVal').innerText = val;
        updateFOV(val);
    });

    // Scale bounds
    const rangeMinInput = document.getElementById('rangeMin');
    const rangeMaxInput = document.getElementById('rangeMax');
    rangeMinInput.addEventListener('input', (e) => {
        let minVal = parseFloat(e.target.value);
        let maxVal = parseFloat(rangeMaxInput.value);
        if (minVal > maxVal) { minVal = maxVal; e.target.value = minVal; }
        state.depth_range.min = minVal;
        handleRangeChange();
    });
    rangeMaxInput.addEventListener('input', (e) => {
        let maxVal = parseFloat(e.target.value);
        let minVal = parseFloat(rangeMinInput.value);
        if (maxVal < minVal) { maxVal = minVal; e.target.value = maxVal; }
        state.depth_range.max = maxVal;
        handleRangeChange();
    });
    document.getElementById('zDepthSlider').addEventListener('input', (e) => {
        state.scale_anim_active = false;
        state.z_depth = parseFloat(e.target.value);
        document.getElementById('zDepthVal').innerText = state.z_depth.toFixed(2);
        state.active_step = -1;
        updateStepsUI();
    });
    document.getElementById('btn-step-minus').addEventListener('click', () => { if (state.steps > 2) { state.steps--; updateStepsUI(); } });
    document.getElementById('btn-step-plus').addEventListener('click', () => { if (state.steps < 5) { state.steps++; updateStepsUI(); } });

    // Initial UI state
    updateDualSliderUI();
    updateStepsUI();
}

export function setupEditableLabels() {
    makeEditable('stellationVal', -1, 2, true, (val) => { document.getElementById('stellationSlider').value = val; state.stellationFactor = val; updateGeometry(state.currentGeometryType); });
    makeEditable('opacityVal', 0, 1, true, (val) => { document.getElementById('opacitySlider').value = val; updateOpacity(val); });
    makeEditable('edgeOpacityVal', 0, 1, true, (val) => { document.getElementById('edgeOpacitySlider').value = val; updateEdgeOpacity(val); });
    makeEditable('idleSpinVal', 0, 0.1, true, (val) => { document.getElementById('idleSpinSlider').value = val; state.idleSpinSpeed = val; });
    makeEditable('auraReachVal', 0, 3, true, (val) => { document.getElementById('auraReachSlider').value = val; state.auraReach = val; });
    makeEditable('auraIntensityVal', 0, 3, true, (val) => { document.getElementById('auraIntensitySlider').value = val; state.auraIntensity = val; });
    makeEditable('pulseRateVal', 0.001, 0.02, true, (val) => { document.getElementById('pulseRateSlider').value = val; state.auraPulseRate = val; });
    makeEditable('gridDivsVal', 5, 100, false, (val) => { document.getElementById('gridDivsSlider').value = val; state.gridDivs = val; buildGrid(); });
    makeEditable('gridMassVal', 0, 3, true, (val) => { document.getElementById('gridMassSlider').value = val; state.gridMass = val; });
    makeEditable('fovVal', 10, 120, false, (val) => { document.getElementById('fovSlider').value = val; updateFOV(val); });
    makeEditable('rangeMinVal', 0.25, () => state.depth_range.max, true, (val) => { document.getElementById('rangeMin').value = val; state.depth_range.min = val; handleRangeChange(); });
    makeEditable('rangeMaxVal', () => state.depth_range.min, 3.00, true, (val) => { document.getElementById('rangeMax').value = val; state.depth_range.max = val; handleRangeChange(); });
    makeEditable('zDepthVal', () => state.depth_range.min, () => state.depth_range.max, true, (val) => { document.getElementById('zDepthSlider').value = val; state.z_depth = val; state.scale_anim_active = false; state.active_step = -1; updateStepsUI(); });
    makeEditable('speedVal', 0.1, 10.0, true, (val) => { document.getElementById('speedSlider').value = val; state.pathSpeed = val; });
    makeEditable('trailLengthVal', 10, 200, false, (val) => { document.getElementById('trailLengthSlider').value = val; state.trailLength = val; });
}
