import state from './state.js';
import { updateAllColors } from './colors.js';
import { updatePulsars, updateGammaRays, updateAccretion, updateNeutrinos } from './phenomena.js';

// ── Preset Definitions ──
// Organized by category for optgroup nesting.
// Each preset only needs to specify what it CHANGES from the base reset.
// Missing keys inherit from the _reset() defaults.

export const PRESET_CATEGORIES = [
    {
        label: 'Classic',
        presets: [
            { key: 'default', label: 'Default Theme' },
            { key: 'blackhole', label: 'Black Hole' },
            { key: 'crystal', label: 'Pure Crystal' },
            { key: 'neon', label: 'Neon Ghost' },
        ]
    },
    {
        label: 'Natural',
        presets: [
            { key: 'rocky-world', label: 'Rocky World' },
            { key: 'ocean-planet', label: 'Ocean Planet' },
            { key: 'gas-giant', label: 'Gas Giant' },
            { key: 'ice-moon', label: 'Ice Moon' },
            { key: 'lava-world', label: 'Lava World' },
            { key: 'star', label: 'Star' },
        ]
    },
    {
        label: 'Constructed',
        presets: [
            { key: 'death-star', label: 'Death Star' },
            { key: 'city-planet', label: 'City Planet' },
            { key: 'borg-cube', label: 'Borg Cube' },
            { key: 'space-station', label: 'Space Station' },
            { key: 'tron-grid', label: 'Tron Grid' },
        ]
    },
    {
        label: 'Anomalous',
        presets: [
            { key: 'portal-window', label: 'Portal' },
            { key: 'alien-hive', label: 'Alien Hive' },
            { key: 'ancient-relic', label: 'Ancient Relic' },
            { key: 'dark-matter', label: 'Dark Matter' },
        ]
    },
];

const PRESET_CONFIGS = {
    // ═══════ CLASSIC ═══════
    'default': {
        shapeSelect: 6,
        skinSelect: 'none',
        interiorEdgesToggle: true, specularToggle: true,
        opacitySlider: 0.25, edgeOpacitySlider: 1.0,
        auraToggle: true, auraReachSlider: 1.0, auraIntensitySlider: 1.0,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        masterColor1: '#bc13fe', masterColor2: '#4a2b6e',
    },
    'blackhole': {
        shapeSelect: 100, skinSelect: 'none',
        interiorEdgesToggle: false, specularToggle: false,
        opacitySlider: 1.0, edgeOpacitySlider: 0.0,
        auraToggle: false,
        gridModeSelect: '3d', grid3dGravitySlider: 200, grid3dDensitySlider: 24,
        pulsarToggle: true, accretionToggle: true, gammaToggle: true, neutrinoToggle: true,
        faceColor1: '#000000', faceColor2: '#000000',
        edgeColor1: '#000000', edgeColor2: '#000000',
        pulsarColor1: '#ffffff', pulsarColor2: '#ffffff',
        gammaColor1: '#ffffff', gammaColor2: '#ffffff',
        accretionColor1: '#ffff00', accretionColor2: '#ff8800',
        neutrinoColor1: '#ffff00', neutrinoColor2: '#ffff00',
    },
    'crystal': {
        shapeSelect: 20, skinSelect: 'none',
        interiorEdgesToggle: true, specularToggle: true,
        opacitySlider: 0.15, edgeOpacitySlider: 0.8,
        auraToggle: true, auraReachSlider: 0.8, auraIntensitySlider: 1.5, pulseRateSlider: 0.002,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#00e5ff', faceColor2: '#ffffff',
        edgeColor1: '#ffffff', edgeColor2: '#ffffff',
        auraColor1: '#00e5ff', auraColor2: '#004488',
    },
    'neon': {
        skinSelect: 'none',
        interiorEdgesToggle: true, specularToggle: false,
        opacitySlider: 0.0, edgeOpacitySlider: 1.0,
        auraToggle: true, auraReachSlider: 1.5, auraIntensitySlider: 2.0, pulseRateSlider: 0.008,
        pulsarToggle: true, neutrinoToggle: true, accretionToggle: false, gammaToggle: false,
        faceColor1: '#ff00ff', faceColor2: '#ff00ff',
        edgeColor1: '#00ffcc', edgeColor2: '#0044aa',
        auraColor1: '#ff00ff', auraColor2: '#440044',
        pulsarColor1: '#00ffcc', pulsarColor2: '#ff00ff',
    },

    // ═══════ NATURAL ═══════
    'rocky-world': {
        shapeSelect: 100, skinSelect: 'rocky',
        specularToggle: true,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: false,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#2d5016', faceColor2: '#c4a35a',
        edgeColor1: '#333333', edgeColor2: '#111111',
        sphereSegmentsSlider: 64,
    },
    'ocean-planet': {
        shapeSelect: 100, skinSelect: 'rocky',
        specularToggle: true,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: true, auraReachSlider: 0.3, auraIntensitySlider: 0.6,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#0055aa', faceColor2: '#003366',
        edgeColor1: '#004488', edgeColor2: '#001122',
        auraColor1: '#4488cc', auraColor2: '#001133',
        sphereSegmentsSlider: 64,
    },
    'gas-giant': {
        shapeSelect: 100, skinSelect: 'gas-giant',
        specularToggle: false,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: true, auraReachSlider: 0.5, auraIntensitySlider: 0.4,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#cc8844', faceColor2: '#eedd99',
        edgeColor1: '#886633', edgeColor2: '#443322',
        auraColor1: '#cc8844', auraColor2: '#332211',
        sphereSegmentsSlider: 64,
    },
    'ice-moon': {
        shapeSelect: 100, skinSelect: 'ice',
        specularToggle: true,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: false,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#88bbdd', faceColor2: '#ffffff',
        edgeColor1: '#aaccee', edgeColor2: '#667788',
        sphereSegmentsSlider: 64,
    },
    'lava-world': {
        shapeSelect: 100, skinSelect: 'volcanic',
        specularToggle: false,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: true, auraReachSlider: 0.6, auraIntensitySlider: 1.2,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#ff4400', faceColor2: '#331100',
        edgeColor1: '#ff6600', edgeColor2: '#220000',
        auraColor1: '#ff4400', auraColor2: '#220000',
        sphereSegmentsSlider: 64,
    },
    'star': {
        shapeSelect: 100, skinSelect: 'solar',
        specularToggle: false,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: true, auraReachSlider: 1.5, auraIntensitySlider: 2.0, pulseRateSlider: 0.003,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#ffcc00', faceColor2: '#ff6600',
        edgeColor1: '#ffaa00', edgeColor2: '#993300',
        auraColor1: '#ffcc00', auraColor2: '#441100',
        sphereSegmentsSlider: 64,
    },

    // ═══════ CONSTRUCTED ═══════
    'death-star': {
        shapeSelect: 100, skinSelect: 'tech',
        interiorEdgesToggle: false, specularToggle: true,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: false,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#999999', faceColor2: '#333333',
        edgeColor1: '#666666', edgeColor2: '#222222',
        sphereSegmentsSlider: 64,
    },
    'city-planet': {
        shapeSelect: 100, skinSelect: 'tech',
        interiorEdgesToggle: false, specularToggle: true,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: true, auraReachSlider: 0.3, auraIntensitySlider: 0.5,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#0a0a18', faceColor2: '#ffcc66',
        edgeColor1: '#333344', edgeColor2: '#111122',
        auraColor1: '#ffcc66', auraColor2: '#110800',
        sphereSegmentsSlider: 64,
    },
    'borg-cube': {
        shapeSelect: 6, skinSelect: 'tech',
        interiorEdgesToggle: false, specularToggle: false,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: true, auraReachSlider: 0.4, auraIntensitySlider: 0.8,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#050505', faceColor2: '#00ff88',
        edgeColor1: '#001100', edgeColor2: '#003300',
        auraColor1: '#00ff44', auraColor2: '#001100',
    },
    'space-station': {
        shapeSelect: 100, skinSelect: 'tech',
        interiorEdgesToggle: false, specularToggle: true,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: false,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#667788', faceColor2: '#0088ff',
        edgeColor1: '#445566', edgeColor2: '#223344',
        sphereSegmentsSlider: 48,
    },
    'tron-grid': {
        shapeSelect: 100, skinSelect: 'circuit',
        interiorEdgesToggle: false, specularToggle: false,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: true, auraReachSlider: 0.5, auraIntensitySlider: 1.5,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#000811', faceColor2: '#00ddff',
        edgeColor1: '#003344', edgeColor2: '#000000',
        auraColor1: '#00ddff', auraColor2: '#000511',
        sphereSegmentsSlider: 48,
    },

    // ═══════ ANOMALOUS ═══════
    'portal-window': {
        shapeSelect: 100, skinSelect: 'portal',
        interiorEdgesToggle: false, specularToggle: false,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: true, auraReachSlider: 0.8, auraIntensitySlider: 1.5, pulseRateSlider: 0.004,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#000000', faceColor2: '#ffffff',
        edgeColor1: '#4400ff', edgeColor2: '#000000',
        auraColor1: '#4400ff', auraColor2: '#110033',
        sphereSegmentsSlider: 64,
    },
    'alien-hive': {
        shapeSelect: 100, skinSelect: 'alien',
        interiorEdgesToggle: false, specularToggle: false,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: true, auraReachSlider: 0.5, auraIntensitySlider: 0.8,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#1a0a00', faceColor2: '#00ff66',
        edgeColor1: '#003311', edgeColor2: '#000000',
        auraColor1: '#00ff44', auraColor2: '#000800',
        sphereSegmentsSlider: 64,
    },
    'ancient-relic': {
        shapeSelect: 12, skinSelect: 'ancient',
        interiorEdgesToggle: false, specularToggle: true,
        opacitySlider: 1.0, edgeOpacitySlider: 0,
        auraToggle: true, auraReachSlider: 0.6, auraIntensitySlider: 1.0, pulseRateSlider: 0.002,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#3a3020', faceColor2: '#00ccff',
        edgeColor1: '#222222', edgeColor2: '#111111',
        auraColor1: '#00ccff', auraColor2: '#001122',
    },
    'dark-matter': {
        shapeSelect: 20, skinSelect: 'none',
        interiorEdgesToggle: true, specularToggle: false,
        opacitySlider: 0.0, edgeOpacitySlider: 0.3,
        auraToggle: true, auraReachSlider: 2.5, auraIntensitySlider: 0.5, pulseRateSlider: 0.001,
        auraSpike: 1.0,
        pulsarToggle: false, accretionToggle: false, gammaToggle: false, neutrinoToggle: false,
        faceColor1: '#110022', faceColor2: '#000000',
        edgeColor1: '#220044', edgeColor2: '#000000',
        auraColor1: '#330066', auraColor2: '#000000',
    },
};

export function applyPreset(presetKey) {
    const config = PRESET_CONFIGS[presetKey];
    if (!config) return;

    const setUI = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') {
            el.checked = val;
            el.dispatchEvent(new Event('change'));
        } else {
            el.value = val;
            el.dispatchEvent(new Event('input'));
            el.dispatchEvent(new Event('change'));
        }
    };

    // Reset multi-instance counts to 1
    ['pulsarCount', 'accretionCount', 'gammaCount', 'neutrinoCount'].forEach(id => setUI(id, 1));
    state.pulsarRayCount = 1; state.accretionDiskCount = 1;
    state.gammaRayCount = 1; state.neutrinoJetCount = 1;
    updatePulsars(1); updateGammaRays(1); updateAccretion(1); updateNeutrinos(1);

    // Reset lightning, magnetic, omega
    setUI('lightningToggle', false);
    setUI('magneticToggle', false);
    setUI('omegaToggle', false);

    // Keys that set state directly (no corresponding DOM element)
    const STATE_DIRECT = { auraSpike: 'auraSpike' };

    // Apply all config entries
    for (const [key, val] of Object.entries(config)) {
        if (STATE_DIRECT[key]) {
            state[STATE_DIRECT[key]] = val;
        } else {
            setUI(key, val);
        }
    }
}
