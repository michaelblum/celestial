// Centralized application state
const state = {
    // Three.js object references (set during init)
    scene: null,
    perspCamera: null,
    orthoCamera: null,
    camera: null,  // active camera reference
    renderer: null,
    polyGroup: null,
    glowSprite: null,
    coreSprite: null,
    coreMesh: null,
    wireframeMesh: null,
    depthMesh: null,
    pointLight: null,
    gridHelper: null,
    chargeSpheroid: null,
    whiteDwarfSprite: null,
    shockwaveSphere: null,
    shockwaveDisk: null,
    flashVoxel: null,
    pathLine: null,

    // Phenomena groups
    pulsarGroup: null,
    accretionGroup: null,
    gammaRaysGroup: null,
    neutrinoGroup: null,

    // Materials (shared references for color updates)
    beamMat: null,
    diskMat: null,
    gammaBeamMat: null,
    neutrinoMat: null,

    // Collections
    accretionRings: [],
    neutrinoParticles: [],
    particles: [],
    coloredParticles: [],
    inwardParticles: [],
    chargeFlares: [],
    trailSprites: [],
    trailPositions: [],

    // Constants
    frustumSize: 8,

    // Gradient Color System
    colors: {
        face: ['#bc13fe', '#4a2b6e'],
        edge: ['#bc13fe', '#4a2b6e'],
        aura: ['#bc13fe', '#2a1b3d'],
        pulsar: ['#ffffff', '#bc13fe'],
        accretion: ['#bc13fe', '#4a2b6e'],
        gamma: ['#ffffff', '#00ffff'],
        neutrino: ['#bc13fe', '#4a2b6e'],
        grid: ['#442266', '#110022']
    },

    // Geometry
    currentOpacity: 0.25,
    currentEdgeOpacity: 1.0,
    idleSpinSpeed: 0.01,
    currentGeometryType: 6,
    stellationFactor: 0.0,
    isMaskEnabled: true,
    isInteriorEdgesEnabled: true,
    isSpecularEnabled: true,

    // Aura
    isAuraEnabled: true,
    auraReach: 1.0,
    auraIntensity: 1.0,
    auraPulseRate: 0.005,
    auraSpike: 0.0,
    spikeMultiplier: 1.5,

    // Cosmic Phenomena Toggles
    isPulsarEnabled: false,
    isAccretionEnabled: false,
    isGammaEnabled: false,
    isNeutrinosEnabled: false,

    // Voxel flash
    voxelFlashTimer: 0,

    // Super Charge/Nova
    isCharging: false,
    chargeLevel: 0,
    chargeTime: 0,
    chargeReleaseTimer: 0,
    wasFullCharge: false,
    collapseTime: 0,

    // Super Nova
    isDestroyed: false,
    superNovaTimer: 0,
    isRespawning: false,
    respawnTimer: 0,
    novaScale: 1.0,

    // Shockwave
    isShockwaveActive: false,
    shockwaveTime: 0,

    // Quick Spin
    quickSpinActive: false,
    quickSpinAxis: null, // set to THREE.Vector3 during init
    quickSpinSpeed: 0,
    quickSpinEndTime: 0,

    // Grid
    isGridEnabled: true,
    isGridBending: false,
    gridMass: 0.0,
    gridDivs: 30,

    // Scale / Depth
    depth_range: { min: 0.25, max: 3.0 },
    z_depth: 1.1,
    scale_anim_active: false,
    target_z_depth: 1.1,
    scale_anim_start_val: 1.1,
    scale_anim_start_time: 0,
    steps: 3,
    active_step: -1,

    // Drag & Momentum
    isDraggingObject: false,
    isPanningCamera: false,
    isPanningObject: false,
    previousMouse: { x: 0, y: 0 },
    dragVelocity: { x: 0, y: 0 },
    lastMoveTime: 0,
    dragMomentumAxis: null, // set to THREE.Vector3 during init
    dragMomentumSpeed: 0,
    isMenuOpen: false,

    // Movement / Pathing
    targetPosition: null, // set to THREE.Vector3 during init
    moveRotationAxis: null, // set to THREE.Vector3 during init
    moveRotationSpeed: 0,
    isPathEnabled: false,
    isCenteredView: false,
    pathType: 'direct',
    isPaused: false,
    pathSpeed: 1.0,

    // Path Visuals
    isShowPathEnabled: false,
    isTrailEnabled: false,
    trailLength: 50,

    // Path coordinates (set during init)
    pathPoints: null,
    smoothCurve: null,
    pathProgress: 0,
    currentPathIndex: 0,
    segmentProgress: 0,

    // Force aura visible flag (used during charge)
    forceAuraVisible: false
};

export default state;
