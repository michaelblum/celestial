import type { GradientStop, MoonTier, DebrisVolumeProfile } from '@lib/ecs/types'

// ─── Planet Data ────────────────────────────────────────────────────────────

export interface PlanetData {
  name: string
  entityType: 'planet' | 'dwarf-planet'
  variant: 'rocky' | 'gas-giant' | 'ice' | 'volcanic'
  radiusKm: number
  orbitAu: number
  periodYears: number
  eccentricity: number
  inclinationDeg: number
  axisTiltDeg: number
  atmosphereEnabled: boolean
  atmosphereColor: string
  atmosphereDensity: number
  colorRamp: GradientStop[]
  noiseScale: number
  roughness: number
  /** Characteristic color for the Points cloud LOD (LOD Level 3) */
  pointColor: string
}

function ramp(colors: string[]): GradientStop[] {
  return colors.map((color, i) => ({
    position: i / (colors.length - 1),
    color,
  }))
}

export const PLANETS: PlanetData[] = [
  {
    name: 'Mercury',
    entityType: 'planet',
    variant: 'rocky',
    radiusKm: 2440,
    orbitAu: 0.387,
    periodYears: 0.241,
    eccentricity: 0.206,
    inclinationDeg: 7.0,
    axisTiltDeg: 0.03,
    atmosphereEnabled: false,
    atmosphereColor: '#888888',
    atmosphereDensity: 0,
    colorRamp: ramp(['#3d3832', '#5e574e', '#8a8078', '#a09688']),
    noiseScale: 4,
    roughness: 0.6,
    pointColor: '#8a8078',
  },
  {
    name: 'Venus',
    entityType: 'planet',
    variant: 'rocky',
    radiusKm: 6052,
    orbitAu: 0.723,
    periodYears: 0.615,
    eccentricity: 0.007,
    inclinationDeg: 3.4,
    axisTiltDeg: 177.4,
    atmosphereEnabled: true,
    atmosphereColor: '#e8c56d',
    atmosphereDensity: 0.8,
    colorRamp: ramp(['#b89d6e', '#d4bc8a', '#e8d5a3', '#f0e6c8']),
    noiseScale: 3,
    roughness: 0.2,
    pointColor: '#e8d5a3',
  },
  {
    name: 'Earth',
    entityType: 'planet',
    variant: 'rocky',
    radiusKm: 6371,
    orbitAu: 1.0,
    periodYears: 1.0,
    eccentricity: 0.017,
    inclinationDeg: 0.0,
    axisTiltDeg: 23.4,
    atmosphereEnabled: true,
    atmosphereColor: '#6b93d6',
    atmosphereDensity: 0.5,
    colorRamp: ramp(['#1a3a5c', '#2d6a4f', '#7b6b43', '#a8a8a8', '#f0f0f0']),
    noiseScale: 3,
    roughness: 0.35,
    pointColor: '#6b93d6',
  },
  {
    name: 'Mars',
    entityType: 'planet',
    variant: 'rocky',
    radiusKm: 3390,
    orbitAu: 1.524,
    periodYears: 1.881,
    eccentricity: 0.093,
    inclinationDeg: 1.9,
    axisTiltDeg: 25.2,
    atmosphereEnabled: true,
    atmosphereColor: '#c1440e',
    atmosphereDensity: 0.15,
    colorRamp: ramp(['#5c2a0e', '#8b3a1a', '#c1440e', '#d4956a']),
    noiseScale: 4,
    roughness: 0.5,
    pointColor: '#c1440e',
  },
  {
    name: 'Jupiter',
    entityType: 'planet',
    variant: 'gas-giant',
    radiusKm: 69911,
    orbitAu: 5.203,
    periodYears: 11.86,
    eccentricity: 0.049,
    inclinationDeg: 1.3,
    axisTiltDeg: 3.1,
    atmosphereEnabled: true,
    atmosphereColor: '#d4a060',
    atmosphereDensity: 0.6,
    colorRamp: ramp(['#8b6914', '#c49b3a', '#e8c56d', '#d4a060', '#8b5e3c']),
    noiseScale: 2,
    roughness: 0.1,
    pointColor: '#e8c56d',
  },
  {
    name: 'Saturn',
    entityType: 'planet',
    variant: 'gas-giant',
    radiusKm: 58232,
    orbitAu: 9.537,
    periodYears: 29.46,
    eccentricity: 0.054,
    inclinationDeg: 2.5,
    axisTiltDeg: 26.7,
    atmosphereEnabled: true,
    atmosphereColor: '#e8d5a3',
    atmosphereDensity: 0.5,
    colorRamp: ramp(['#a08040', '#c8a850', '#e0d090', '#d8c078', '#b09848']),
    noiseScale: 2,
    roughness: 0.1,
    pointColor: '#e0d090',
  },
  {
    name: 'Uranus',
    entityType: 'planet',
    variant: 'ice',
    radiusKm: 25362,
    orbitAu: 19.19,
    periodYears: 84.01,
    eccentricity: 0.047,
    inclinationDeg: 0.8,
    axisTiltDeg: 97.8,
    atmosphereEnabled: true,
    atmosphereColor: '#d1e7e7',
    atmosphereDensity: 0.4,
    colorRamp: ramp(['#5f8f8f', '#8ec4c4', '#b0d8d8', '#d1e7e7']),
    noiseScale: 2,
    roughness: 0.15,
    pointColor: '#b0d8d8',
  },
  {
    name: 'Neptune',
    entityType: 'planet',
    variant: 'ice',
    radiusKm: 24622,
    orbitAu: 30.07,
    periodYears: 164.8,
    eccentricity: 0.009,
    inclinationDeg: 1.8,
    axisTiltDeg: 28.3,
    atmosphereEnabled: true,
    atmosphereColor: '#3f54ba',
    atmosphereDensity: 0.5,
    colorRamp: ramp(['#1a2a6c', '#2d3fa0', '#3f54ba', '#5a6fd0']),
    noiseScale: 2,
    roughness: 0.15,
    pointColor: '#3f54ba',
  },
  {
    name: 'Pluto',
    entityType: 'dwarf-planet',
    variant: 'ice',
    radiusKm: 1188,
    orbitAu: 39.48,
    periodYears: 247.9,
    eccentricity: 0.249,
    inclinationDeg: 17.2,
    axisTiltDeg: 122.5,
    atmosphereEnabled: true,
    atmosphereColor: '#c9b8a0',
    atmosphereDensity: 0.1,
    colorRamp: ramp(['#7a6a5a', '#9e8e7e', '#c9b8a0', '#a8967e']),
    noiseScale: 4,
    roughness: 0.5,
    pointColor: '#c9b8a0',
  },
  {
    name: 'Ceres',
    entityType: 'dwarf-planet',
    variant: 'rocky',
    radiusKm: 473,
    orbitAu: 2.77,
    periodYears: 4.6,
    eccentricity: 0.076,
    inclinationDeg: 10.6,
    axisTiltDeg: 4.0,
    atmosphereEnabled: false,
    atmosphereColor: '#888888',
    atmosphereDensity: 0,
    colorRamp: ramp(['#3a3a3a', '#555555', '#6e6e6e', '#888888']),
    noiseScale: 5,
    roughness: 0.7,
    pointColor: '#6e6e6e',
  },
]

// ─── Moon Data ──────────────────────────────────────────────────────────────

export interface MoonData {
  name: string
  parent: string           // planet name to match against
  radiusKm: number
  orbitRadiusKm: number    // from parent center
  periodDays: number
  eccentricity: number
  inclinationDeg: number
  tier: MoonTier
  variant: 'rocky' | 'ice'
  pointColor: string
}

export const MOONS: MoonData[] = [
  // ── Tier 1: Major ──
  { name: 'Moon',      parent: 'Earth',   radiusKm: 1737,  orbitRadiusKm: 384400,  periodDays: 27.3,   eccentricity: 0.055, inclinationDeg: 5.1,   tier: 'major', variant: 'rocky', pointColor: '#c0c0c0' },
  { name: 'Io',        parent: 'Jupiter',  radiusKm: 1822,  orbitRadiusKm: 421700,  periodDays: 1.77,   eccentricity: 0.004, inclinationDeg: 0.04,  tier: 'major', variant: 'rocky', pointColor: '#e8c840' },
  { name: 'Europa',    parent: 'Jupiter',  radiusKm: 1561,  orbitRadiusKm: 671034,  periodDays: 3.55,   eccentricity: 0.009, inclinationDeg: 0.47,  tier: 'major', variant: 'ice',   pointColor: '#c8d8e8' },
  { name: 'Ganymede',  parent: 'Jupiter',  radiusKm: 2634,  orbitRadiusKm: 1070412, periodDays: 7.15,   eccentricity: 0.001, inclinationDeg: 0.18,  tier: 'major', variant: 'ice',   pointColor: '#a0a0b0' },
  { name: 'Callisto',  parent: 'Jupiter',  radiusKm: 2410,  orbitRadiusKm: 1882709, periodDays: 16.69,  eccentricity: 0.007, inclinationDeg: 0.19,  tier: 'major', variant: 'ice',   pointColor: '#8a8a90' },
  { name: 'Titan',     parent: 'Saturn',   radiusKm: 2575,  orbitRadiusKm: 1221870, periodDays: 15.95,  eccentricity: 0.029, inclinationDeg: 0.33,  tier: 'major', variant: 'ice',   pointColor: '#d4a040' },
  { name: 'Triton',    parent: 'Neptune',  radiusKm: 1353,  orbitRadiusKm: 354759,  periodDays: 5.88,   eccentricity: 0.000, inclinationDeg: 156.9, tier: 'major', variant: 'ice',   pointColor: '#c0d0e0' },
  { name: 'Charon',    parent: 'Pluto',    radiusKm: 606,   orbitRadiusKm: 19591,   periodDays: 6.39,   eccentricity: 0.000, inclinationDeg: 0.08,  tier: 'major', variant: 'ice',   pointColor: '#a09888' },

  // ── Tier 2: Notable ──
  { name: 'Phobos',    parent: 'Mars',     radiusKm: 11,    orbitRadiusKm: 9376,    periodDays: 0.32,   eccentricity: 0.015, inclinationDeg: 1.1,   tier: 'notable', variant: 'rocky', pointColor: '#7a7060' },
  { name: 'Deimos',    parent: 'Mars',     radiusKm: 6,     orbitRadiusKm: 23458,   periodDays: 1.26,   eccentricity: 0.000, inclinationDeg: 0.9,   tier: 'notable', variant: 'rocky', pointColor: '#8a8070' },
  { name: 'Enceladus', parent: 'Saturn',   radiusKm: 252,   orbitRadiusKm: 237948,  periodDays: 1.37,   eccentricity: 0.005, inclinationDeg: 0.02,  tier: 'notable', variant: 'ice',   pointColor: '#f0f0ff' },
  { name: 'Mimas',     parent: 'Saturn',   radiusKm: 198,   orbitRadiusKm: 185404,  periodDays: 0.94,   eccentricity: 0.020, inclinationDeg: 1.57,  tier: 'notable', variant: 'ice',   pointColor: '#d0d0d0' },
  { name: 'Rhea',      parent: 'Saturn',   radiusKm: 764,   orbitRadiusKm: 527108,  periodDays: 4.52,   eccentricity: 0.001, inclinationDeg: 0.35,  tier: 'notable', variant: 'ice',   pointColor: '#c8c8c8' },
  { name: 'Dione',     parent: 'Saturn',   radiusKm: 561,   orbitRadiusKm: 377396,  periodDays: 2.74,   eccentricity: 0.002, inclinationDeg: 0.02,  tier: 'notable', variant: 'ice',   pointColor: '#d0d0d0' },
  { name: 'Tethys',    parent: 'Saturn',   radiusKm: 531,   orbitRadiusKm: 294619,  periodDays: 1.89,   eccentricity: 0.000, inclinationDeg: 1.12,  tier: 'notable', variant: 'ice',   pointColor: '#e0e0e0' },
  { name: 'Iapetus',   parent: 'Saturn',   radiusKm: 735,   orbitRadiusKm: 3560820, periodDays: 79.3,   eccentricity: 0.029, inclinationDeg: 15.47, tier: 'notable', variant: 'ice',   pointColor: '#908070' },
  { name: 'Miranda',   parent: 'Uranus',   radiusKm: 236,   orbitRadiusKm: 129390,  periodDays: 1.41,   eccentricity: 0.001, inclinationDeg: 4.34,  tier: 'notable', variant: 'ice',   pointColor: '#b0b0b0' },
  { name: 'Ariel',     parent: 'Uranus',   radiusKm: 579,   orbitRadiusKm: 190900,  periodDays: 2.52,   eccentricity: 0.001, inclinationDeg: 0.26,  tier: 'notable', variant: 'ice',   pointColor: '#c0c0c0' },
  { name: 'Umbriel',   parent: 'Uranus',   radiusKm: 585,   orbitRadiusKm: 266000,  periodDays: 4.14,   eccentricity: 0.004, inclinationDeg: 0.13,  tier: 'notable', variant: 'ice',   pointColor: '#808080' },
  { name: 'Titania',   parent: 'Uranus',   radiusKm: 789,   orbitRadiusKm: 435910,  periodDays: 8.71,   eccentricity: 0.001, inclinationDeg: 0.08,  tier: 'notable', variant: 'ice',   pointColor: '#b0b0b0' },
  { name: 'Oberon',    parent: 'Uranus',   radiusKm: 761,   orbitRadiusKm: 583520,  periodDays: 13.46,  eccentricity: 0.001, inclinationDeg: 0.07,  tier: 'notable', variant: 'ice',   pointColor: '#a0a0a0' },

  // ── Tier 3: Minor (representative subset — extend as needed) ──
  // Jupiter minor moons
  { name: 'Amalthea',  parent: 'Jupiter',  radiusKm: 84,    orbitRadiusKm: 181366,  periodDays: 0.498,  eccentricity: 0.003, inclinationDeg: 0.37,  tier: 'minor', variant: 'rocky', pointColor: '#a08060' },
  { name: 'Himalia',   parent: 'Jupiter',  radiusKm: 85,    orbitRadiusKm: 11461000, periodDays: 250.6, eccentricity: 0.162, inclinationDeg: 27.5,  tier: 'minor', variant: 'rocky', pointColor: '#808080' },
  { name: 'Thebe',     parent: 'Jupiter',  radiusKm: 49,    orbitRadiusKm: 221889,  periodDays: 0.675,  eccentricity: 0.018, inclinationDeg: 1.08,  tier: 'minor', variant: 'rocky', pointColor: '#909090' },
  { name: 'Metis',     parent: 'Jupiter',  radiusKm: 22,    orbitRadiusKm: 128852,  periodDays: 0.295,  eccentricity: 0.000, inclinationDeg: 0.06,  tier: 'minor', variant: 'rocky', pointColor: '#808080' },
  // Pluto minor moons
  { name: 'Nix',       parent: 'Pluto',    radiusKm: 23,    orbitRadiusKm: 48694,   periodDays: 24.85,  eccentricity: 0.002, inclinationDeg: 0.13,  tier: 'minor', variant: 'ice',   pointColor: '#a0a0a0' },
  { name: 'Hydra',     parent: 'Pluto',    radiusKm: 25,    orbitRadiusKm: 64738,   periodDays: 38.2,   eccentricity: 0.006, inclinationDeg: 0.24,  tier: 'minor', variant: 'ice',   pointColor: '#a0a0a0' },
  { name: 'Kerberos',  parent: 'Pluto',    radiusKm: 12,    orbitRadiusKm: 57783,   periodDays: 32.17,  eccentricity: 0.003, inclinationDeg: 0.39,  tier: 'minor', variant: 'ice',   pointColor: '#909090' },
  { name: 'Styx',      parent: 'Pluto',    radiusKm: 8,     orbitRadiusKm: 42656,   periodDays: 20.16,  eccentricity: 0.006, inclinationDeg: 0.81,  tier: 'minor', variant: 'ice',   pointColor: '#909090' },
]

// ─── Debris Volume Profiles ─────────────────────────────────────────────────

export interface DebrisVolumeData {
  name: string
  variant: 'asteroid-belt' | 'kuiper-belt' | 'planetary-ring' | 'oort-cloud'
  parent: string  // 'Sun' for belts, planet name for rings
  profile: DebrisVolumeProfile
}

export const DEBRIS_VOLUMES: DebrisVolumeData[] = [
  {
    name: 'Asteroid Belt',
    variant: 'asteroid-belt',
    parent: 'Sun',
    profile: {
      spatial: {
        minRadius: 6.6,   // 2.2 AU * 3
        maxRadius: 9.6,   // 3.2 AU * 3
        maxInclination: 0.035,
        densityCurve: 'gaussian',
        densityPeak: 8.1, // 2.7 AU * 3
        orbitSpeed: 0.02,
      },
      macroVisuals: {
        proxyType: 'ring',
        color: '#777777',
        opacity: 0.3,
        textureStyle: 'dusty',
      },
      microVisuals: {
        microRenderType: 'mesh',
        geometryType: 'dodecahedron',
        instanceCount: 3000,
        minSize: 0.005,
        maxSize: 0.03,
        colorPalette: ['#666666', '#7a7060', '#8a7a6a'],
        roughness: 1.0,
        tumbleSpeed: 0.3,
      },
    },
  },
  {
    name: 'Kuiper Belt',
    variant: 'kuiper-belt',
    parent: 'Sun',
    profile: {
      spatial: {
        minRadius: 90,   // 30 AU * 3
        maxRadius: 150,  // 50 AU * 3
        maxInclination: 0.17,
        densityCurve: 'gaussian',
        orbitSpeed: 0.005,
      },
      macroVisuals: {
        proxyType: 'ring',
        color: '#8899aa',
        opacity: 0.15,
        textureStyle: 'dusty',
      },
      microVisuals: {
        microRenderType: 'mesh',
        geometryType: 'dodecahedron',
        instanceCount: 4000,
        minSize: 0.008,
        maxSize: 0.05,
        colorPalette: ['#8899aa', '#99aabb', '#7788aa'],
        roughness: 0.8,
        tumbleSpeed: 0.15,
      },
    },
  },
  {
    name: "Saturn's Rings",
    variant: 'planetary-ring',
    parent: 'Saturn',
    profile: {
      spatial: {
        minRadius: 0.55,   // relative to Saturn's visual radius
        maxRadius: 1.3,
        maxInclination: 0.001,
        densityCurve: 'banded',
        bandCount: 5,
        orbitSpeed: 0.1,
      },
      macroVisuals: {
        proxyType: 'ring',
        color: '#e8d5a3',
        opacity: 0.7,
        textureStyle: 'banded',
        bandCount: 5,
      },
      microVisuals: {
        microRenderType: 'mesh',
        geometryType: 'icosahedron',
        instanceCount: 2000,
        minSize: 0.001,
        maxSize: 0.008,
        colorPalette: ['#f0e8d8', '#e8dcc8', '#d8ccb8'],
        roughness: 0.3,
        tumbleSpeed: 0.5,
      },
    },
  },
  {
    name: "Uranus's Rings",
    variant: 'planetary-ring',
    parent: 'Uranus',
    profile: {
      spatial: {
        minRadius: 0.4,
        maxRadius: 0.6,
        maxInclination: 0.001,
        densityCurve: 'banded',
        orbitSpeed: 0.08,
      },
      macroVisuals: {
        proxyType: 'ring',
        color: '#aabbcc',
        opacity: 0.1,
        textureStyle: 'banded',
      },
      microVisuals: {
        microRenderType: 'mesh',
        geometryType: 'icosahedron',
        instanceCount: 500,
        minSize: 0.001,
        maxSize: 0.005,
        colorPalette: ['#c0d0e0', '#b0c0d0'],
        roughness: 0.4,
        tumbleSpeed: 0.4,
      },
    },
  },
]

// ─── Comet Data ─────────────────────────────────────────────────────────────

export interface CometData {
  name: string
  periodYears: number
  eccentricity: number
  inclinationDeg: number
  nucleusRadius: number    // scene units
  tailLength: number       // scene units
  tailParticleCount: number
  tailColor: string
  coreColor: string
  pointColor: string
}

export const COMETS: CometData[] = [
  {
    name: "Halley's Comet",
    periodYears: 75.3,
    eccentricity: 0.967,
    inclinationDeg: 162.3,
    nucleusRadius: 0.01,
    tailLength: 2.0,
    tailParticleCount: 400,
    tailColor: '#88bbff',
    coreColor: '#aaddff',
    pointColor: '#88bbff',
  },
  {
    name: 'Comet Hale-Bopp',
    periodYears: 2520,
    eccentricity: 0.995,
    inclinationDeg: 89.4,
    nucleusRadius: 0.015,
    tailLength: 3.0,
    tailParticleCount: 500,
    tailColor: '#aaccff',
    coreColor: '#ccddff',
    pointColor: '#aaccff',
  },
]

// ─── Sun Config ─────────────────────────────────────────────────────────────

export const SUN_CONFIG = {
  name: 'Sun',
  mass: 100,
  size: 1,
  spectralClass: 'G' as const,
  radius: 0.5,
  temperature: 5778,
  coronaIntensity: 1.2,
  coronaReach: 1.5,
  surfaceDetail: 3,
}
