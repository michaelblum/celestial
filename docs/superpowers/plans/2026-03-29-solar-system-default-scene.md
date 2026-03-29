# Solar System Default Scene — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the real Solar System as the default scene on startup — Sun, 10 planets/dwarfs, ~130 moons, asteroid belt, Kuiper belt, comets — with a 4-tier LOD system governing rendering and a filter panel for orbit path overlays.

**Architecture:** Data-driven approach. A `SolarSystemData.ts` file contains all physical and visual parameters. A `ScalePolicy.ts` converts real units (km, AU) to scene units. A `SolarSystemLoader.ts` orchestrates entity creation. A `BodyLODManager.ts` manages the Points cloud → Sprite → Low-poly → Hero shader pipeline. A `DebrisVolumeGenerator.ts` with a profiled component handles asteroid belts, Kuiper belt, and planetary rings via unified spherical-coordinate math. A `filterStore.svelte.ts` controls orbit path overlay visibility.

**Tech Stack:** Svelte 5 (runes), Three.js, TypeScript, GLSL, vite-plugin-glsl

**Spec:** `docs/superpowers/specs/2026-03-29-solar-system-default-scene-design.md`

---

## Dependency Graph (for team parallelization)

```
Task 1 (types) ──────────────────────────────┐
                                              │
Task 2 (ScalePolicy) ─ no file dep on T1 ────┤
                                              │
    ┌─────────────────────────────────────────┤
    │                                         │
    ▼                                         ▼
Task 3 (SolarSystemData)     Task 4 (BodyLODManager)
    │                              │
    │                         Task 5 (Points cloud GLSL)
    │                              │
    ▼                              ▼
Task 6 (DebrisVolumeGenerator)  Task 7 (CometGenerator)
    │                              │
    ▼                              ▼
Task 8 (filterStore)          Task 9 (FilterPanel)
    │                              │
    └──────────┬───────────────────┘
               ▼
Task 10 (sceneStore integration — buildThreeObject + animation loop)
               │
               ▼
Task 11 (SolarSystemLoader)
               │
               ▼
Task 12 (Viewport trigger + default scene load)
               │
               ▼
Task 13 (PlanetComponent ring removal)
```

**Parallel groups:**
- **Wave 1** (no deps): Tasks 1, 2
- **Wave 2** (after types): Tasks 3, 4, 5
- **Wave 3** (after data + LOD): Tasks 6, 7, 8, 9
- **Wave 4** (integration): Tasks 10, 11, 12, 13

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/presets/ScalePolicy.ts` | Pure functions: `toSceneRadius(km)`, `toSceneOrbit(au)`, `toSceneMoonOrbit(km, parentKm)`, `toScenePeriod(days)` |
| `src/lib/presets/SolarSystemData.ts` | Static data arrays: planets, moons (all tiers), debris volume profiles, comet configs |
| `src/lib/presets/SolarSystemLoader.ts` | Orchestrator: reads data, calls `addEntity()` for each body, inits LOD and filter defaults |
| `src/lib/generators/DebrisVolumeGenerator.ts` | Creates far proxy (RingGeometry/Sprite) + local bubble InstancedMesh + treadmill recycling |
| `src/lib/generators/CometGenerator.ts` | Creates nucleus mesh + particle tail Points system |
| `src/lib/lod/BodyLODManager.ts` | Manages 4-tier LOD: Points cloud → Sprite → Low-poly → Hero. Owns the shared `THREE.Points` object |
| `src/lib/lod/pointCloud.vert` | GLSL vertex shader for Points cloud (reads size attribute, distance attenuation) |
| `src/lib/lod/pointCloud.frag` | GLSL fragment shader for Points cloud (soft radial dot with per-vertex color) |
| `src/lib/stores/filterStore.svelte.ts` | Svelte 5 rune store: overlay toggle state per entity class/tier |
| `src/ui/panels/FilterPanel.svelte` | Toggle switches UI for orbit path visibility |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/ecs/types.ts` | Add 3 entity types, 3 component interfaces, extend Component union |
| `src/lib/stores/sceneStore.svelte.ts` | Handle new entity types in `buildThreeObject`, integrate `BodyLODManager` + `filterStore` into animation loop |
| `src/ui/layout/Viewport.svelte` | Call `loadSolarSystem()` after engine init when scene is empty |
| `src/lib/ecs/Serializer.ts` | Handle new component types in serialize/deserialize |

---

## Task 1: ECS Type Definitions

**Files:**
- Modify: `src/lib/ecs/types.ts`

- [ ] **Step 1: Add PhysicalDataComponent interface**

Add after the `GalaxyComponent` interface (line ~110):

```ts
export interface PhysicalDataComponent {
  type: 'physical'
  radiusKm: number
  semiMajorAxisAu: number
  orbitalPeriodDays: number
  massKg?: number
  eccentricity: number
  inclinationDeg: number
  axisTiltDeg: number
}
```

- [ ] **Step 2: Add DebrisVolumeProfile and DebrisVolumeComponent**

Add after `PhysicalDataComponent`:

```ts
export interface DebrisVolumeProfile {
  spatial: {
    minRadius: number
    maxRadius: number
    maxInclination: number
    densityCurve: 'uniform' | 'gaussian' | 'banded'
    densityPeak?: number
    orbitSpeed: number
  }
  macroVisuals: {
    proxyType: 'ring' | 'sprite'
    color: string
    opacity: number
    textureStyle: 'smooth' | 'banded' | 'dusty'
    bandCount?: number
  }
  microVisuals: {
    microRenderType: 'mesh'
    geometryType: 'dodecahedron' | 'icosahedron' | 'tetrahedron'
    instanceCount: number
    minSize: number
    maxSize: number
    colorPalette: string[]
    roughness: number
    tumbleSpeed: number
  }
}

export interface DebrisVolumeComponent {
  type: 'debris-volume'
  variant: 'asteroid-belt' | 'kuiper-belt' | 'planetary-ring' | 'oort-cloud'
  profile: DebrisVolumeProfile
}
```

- [ ] **Step 3: Add CometComponent**

```ts
export interface CometComponent {
  type: 'comet'
  nucleusRadius: number
  tailLength: number
  tailParticleCount: number
  tailColor: string
  coreColor: string
}
```

- [ ] **Step 4: Extend Component union and EntityType**

Update the `Component` type to include new components:

```ts
export type Component =
  | TransformComponent
  | StarComponent
  | PlanetComponent
  | NebulaComponent
  | OrbitalComponent
  | ImpostorComponent
  | AlienTechComponent
  | OortCloudComponent
  | GalaxyComponent
  | PhysicalDataComponent
  | DebrisVolumeComponent
  | CometComponent
```

Update `EntityType`:

```ts
export type EntityType =
  | 'star'
  | 'planet'
  | 'moon'
  | 'dwarf-planet'
  | 'nebula'
  | 'galaxy'
  | 'oort-cloud'
  | 'alien-tech'
  | 'debris-volume'
  | 'comet'
  | 'placeholder'
```

- [ ] **Step 5: Add MoonTier type**

Add near the top of the file, after `GradientStop`:

```ts
export type MoonTier = 'major' | 'notable' | 'minor'
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/ecs/types.ts
git commit -m "feat: add ECS types for solar system — PhysicalData, DebrisVolume, Comet, MoonTier"
```

---

## Task 2: Scale Policy

**Files:**
- Create: `src/lib/presets/ScalePolicy.ts`

- [ ] **Step 1: Create the presets directory**

```bash
mkdir -p src/lib/presets
```

- [ ] **Step 2: Write ScalePolicy.ts**

```ts
/**
 * ScalePolicy — converts real physical units to scene rendering units.
 *
 * Three separate scales because real ratios span many orders of magnitude:
 * - Planet orbits: 1 AU = 3 scene units
 * - Moon orbits: compressed, anchored to parent's visual radius
 * - Body radii: linear proportional with min clamp
 * - Periods: 1 Earth year = 60 seconds sim time
 */

// ─── Constants ──────────────────────────────────────────────────────────────

const AU_TO_SCENE = 3
const KM_TO_SCENE_RADIUS = 0.0000063
const MIN_SCENE_RADIUS = 0.001
const MOON_ORBIT_FACTOR = 0.012
const PERIOD_SCALE = 60 / 365.25  // days → sim seconds (Earth year = 60s)

// ─── Public API ─────────────────────────────────────────────────────────────

/** Convert real radius in km to scene-unit radius (with min clamp) */
export function toSceneRadius(km: number): number {
  return Math.max(km * KM_TO_SCENE_RADIUS, MIN_SCENE_RADIUS)
}

/** Convert orbital semi-major axis in AU to scene-unit orbit radius */
export function toSceneOrbit(au: number): number {
  return au * AU_TO_SCENE
}

/**
 * Convert moon orbital radius (km from parent center) to scene-unit orbit radius.
 * Uses compressed scaling anchored to the parent's visual radius so moons
 * don't render inside their parent planets.
 */
export function toSceneMoonOrbit(moonOrbitKm: number, parentRadiusKm: number): number {
  const parentVisRadius = toSceneRadius(parentRadiusKm)
  return parentVisRadius * 1.2 + Math.pow(moonOrbitKm, 0.3) * MOON_ORBIT_FACTOR
}

/** Convert real orbital period in Earth days to sim-time period in seconds */
export function toScenePeriod(days: number): number {
  return days * PERIOD_SCALE
}

/** Convert real orbital period in Earth years to sim-time period in seconds */
export function toScenePeriodYears(years: number): number {
  return years * 60  // 1 year = 60 seconds
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/presets/ScalePolicy.ts
git commit -m "feat: add ScalePolicy — physical-to-scene unit conversion"
```

---

## Task 3: Solar System Data

**Files:**
- Create: `src/lib/presets/SolarSystemData.ts`

This is the largest file — all hardcoded physical and visual parameters. The data is static and has no runtime logic.

- [ ] **Step 1: Create the data file with planet definitions**

Create `src/lib/presets/SolarSystemData.ts`. This file exports typed data arrays. Start with the planet data:

```ts
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
```

- [ ] **Step 2: Add moon data**

Append to the same file. Include all Tier 1 and Tier 2 moons with full data. Tier 3 moons use a compact format (many entries, minimal params):

```ts
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
  // NOTE: The full Tier 3 dataset (~100+ moons) should be extended here following the same format.
  // Data source: NASA/JPL Solar System Dynamics (ssd.jpl.nasa.gov)
  // Each entry needs: name, parent, radiusKm, orbitRadiusKm, periodDays, eccentricity, inclinationDeg, tier, variant, pointColor
]
```

- [ ] **Step 3: Add debris volume profile data**

Append to the same file:

```ts
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
```

- [ ] **Step 4: Add comet data**

Append to the same file:

```ts
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
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/presets/SolarSystemData.ts
git commit -m "feat: add SolarSystemData — planets, moons, debris volumes, comets"
```

---

## Task 4: BodyLODManager — Core Structure

**Files:**
- Create: `src/lib/lod/BodyLODManager.ts`

- [ ] **Step 1: Create the lod directory and BodyLODManager.ts**

```bash
mkdir -p src/lib/lod
```

```ts
import * as THREE from 'three'
import pointCloudVert from './pointCloud.vert'
import pointCloudFrag from './pointCloud.frag'

// ─── Types ──────────────────────────────────────────────────────────────────

export type BodyLODLevel = 0 | 1 | 2 | 3

interface BodyLODEntry {
  entityId: string
  color: THREE.Color
  sizeHint: number       // base point size for LOD3
  currentLevel: BodyLODLevel
  heroGroup: THREE.Group | null    // LOD 0: full procedural shader mesh
  // LOD 1, 2 meshes created on demand
}

// ─── Distance Thresholds ────────────────────────────────────────────────────

const LOD_THRESHOLDS = {
  /** Below this distance: LOD 0 (hero shader) */
  heroDistance: 2.0,
  /** Below this distance: LOD 1 (low-poly 3D) */
  lowPolyDistance: 15.0,
  /** Below this distance: LOD 2 (billboard sprite) */
  spriteDistance: 60.0,
  /** Above spriteDistance: LOD 3 (points cloud) */
}

// ─── BodyLODManager ─────────────────────────────────────────────────────────

export class BodyLODManager {
  private entries = new Map<string, BodyLODEntry>()
  private scene: THREE.Scene

  // Points cloud (LOD 3) — single shared object for all distant bodies
  private pointsGeometry: THREE.BufferGeometry
  private pointsMaterial: THREE.ShaderMaterial
  private pointsObject: THREE.Points
  private maxPoints: number

  // Buffer arrays (pre-allocated, updated per frame)
  private positionArray: Float32Array
  private colorArray: Float32Array
  private sizeArray: Float32Array
  private activePointCount = 0

  constructor(scene: THREE.Scene, maxBodies: number = 256) {
    this.scene = scene
    this.maxPoints = maxBodies

    // Pre-allocate typed arrays
    this.positionArray = new Float32Array(maxBodies * 3)
    this.colorArray = new Float32Array(maxBodies * 3)
    this.sizeArray = new Float32Array(maxBodies)

    // Create buffer geometry with attributes
    this.pointsGeometry = new THREE.BufferGeometry()
    this.pointsGeometry.setAttribute('position', new THREE.BufferAttribute(this.positionArray, 3))
    this.pointsGeometry.setAttribute('color', new THREE.BufferAttribute(this.colorArray, 3))
    this.pointsGeometry.setAttribute('size', new THREE.BufferAttribute(this.sizeArray, 1))

    // ShaderMaterial for colored, distance-attenuated point sprites
    this.pointsMaterial = new THREE.ShaderMaterial({
      vertexShader: pointCloudVert,
      fragmentShader: pointCloudFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.pointsObject = new THREE.Points(this.pointsGeometry, this.pointsMaterial)
    this.pointsObject.frustumCulled = false
    this.pointsObject.name = 'body-points-cloud'
    this.scene.add(this.pointsObject)
  }

  /** Register a body for LOD management */
  register(entityId: string, heroGroup: THREE.Group | null, color: string, sizeHint: number): void {
    this.entries.set(entityId, {
      entityId,
      color: new THREE.Color(color),
      sizeHint,
      currentLevel: 3,  // start in points cloud
      heroGroup,
    })

    // Hide hero group initially (LOD 3 = points cloud)
    if (heroGroup) heroGroup.visible = false
  }

  /** Unregister a body */
  unregister(entityId: string): void {
    this.entries.delete(entityId)
  }

  /**
   * Update all body LOD levels based on camera position.
   * Called once per frame from the animation loop.
   * Returns a map of entityId → current LOD level for the caller to use.
   */
  update(camera: THREE.Camera, getWorldPosition: (id: string) => THREE.Vector3 | null): Map<string, BodyLODLevel> {
    const camPos = camera.position
    const levels = new Map<string, BodyLODLevel>()
    let pointIdx = 0

    for (const [id, entry] of this.entries) {
      const worldPos = getWorldPosition(id)
      if (!worldPos) continue

      const dist = camPos.distanceTo(worldPos)
      let level: BodyLODLevel

      if (dist < LOD_THRESHOLDS.heroDistance) {
        level = 0
      } else if (dist < LOD_THRESHOLDS.lowPolyDistance) {
        level = 1
      } else if (dist < LOD_THRESHOLDS.spriteDistance) {
        level = 2
      } else {
        level = 3
      }

      // Transition visibility
      if (level !== entry.currentLevel) {
        this.transitionLevel(entry, level)
        entry.currentLevel = level
      }

      // If LOD 3, write to points cloud buffer
      if (level === 3 && pointIdx < this.maxPoints) {
        const base3 = pointIdx * 3
        this.positionArray[base3] = worldPos.x
        this.positionArray[base3 + 1] = worldPos.y
        this.positionArray[base3 + 2] = worldPos.z
        this.colorArray[base3] = entry.color.r
        this.colorArray[base3 + 1] = entry.color.g
        this.colorArray[base3 + 2] = entry.color.b
        this.sizeArray[pointIdx] = entry.sizeHint
        pointIdx++
      }

      levels.set(id, level)
    }

    // Update draw range and flag buffers dirty
    this.pointsGeometry.setDrawRange(0, pointIdx)
    this.pointsGeometry.attributes.position.needsUpdate = true
    if (pointIdx !== this.activePointCount) {
      this.pointsGeometry.attributes.color.needsUpdate = true
      this.pointsGeometry.attributes.size.needsUpdate = true
    }
    this.activePointCount = pointIdx

    return levels
  }

  private transitionLevel(entry: BodyLODEntry, newLevel: BodyLODLevel): void {
    // For Phase 1: only LOD 0 (hero) and LOD 3 (points) are implemented.
    // LOD 1 and 2 fall through to LOD 0 if hero exists, else LOD 3.
    if (entry.heroGroup) {
      entry.heroGroup.visible = newLevel <= 2
    }
  }

  dispose(): void {
    this.scene.remove(this.pointsObject)
    this.pointsGeometry.dispose()
    this.pointsMaterial.dispose()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/lod/BodyLODManager.ts
git commit -m "feat: add BodyLODManager — 4-tier LOD with Points cloud batching"
```

---

## Task 5: Points Cloud GLSL Shaders

**Files:**
- Create: `src/lib/lod/pointCloud.vert`
- Create: `src/lib/lod/pointCloud.frag`

- [ ] **Step 1: Write the vertex shader**

Create `src/lib/lod/pointCloud.vert`:

```glsl
attribute float size;
attribute vec3 color;

varying vec3 vColor;

void main() {
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  // Distance attenuation: points shrink with distance but have a minimum
  float dist = -mvPosition.z;
  float attenuation = 300.0 / dist;
  gl_PointSize = max(size * attenuation, 2.0);

  gl_Position = projectionMatrix * mvPosition;
}
```

- [ ] **Step 2: Write the fragment shader**

Create `src/lib/lod/pointCloud.frag`:

```glsl
varying vec3 vColor;

void main() {
  // Soft radial falloff — luminous dot, not hard square
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  float alpha = 1.0 - smoothstep(0.3, 0.5, dist);

  if (alpha < 0.01) discard;

  // Slight bloom: brighter at center
  float bloom = exp(-dist * dist * 8.0);
  vec3 col = vColor * (0.8 + 0.4 * bloom);

  gl_FragColor = vec4(col, alpha);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/lod/pointCloud.vert src/lib/lod/pointCloud.frag
git commit -m "feat: add Points cloud GLSL shaders — per-vertex color + size with radial falloff"
```

---

## Task 6: DebrisVolumeGenerator

**Files:**
- Create: `src/lib/generators/DebrisVolumeGenerator.ts`

- [ ] **Step 1: Write the generator**

```ts
import * as THREE from 'three'
import type { DebrisVolumeComponent } from '@lib/ecs/types'

/**
 * DebrisVolumeGenerator — unified generator for asteroid belts, Kuiper belt,
 * planetary rings, and Oort cloud. Uses spherical coordinates with maxInclination
 * to morph between flat disk (ring) and spherical shell (cloud).
 *
 * LOD approach:
 * - Far: static proxy mesh (RingGeometry or Sprite)
 * - Near: local-bubble InstancedMesh with treadmill recycling
 */

// ─── Far LOD: Proxy Mesh ────────────────────────────────────────────────────

function createFarProxy(comp: DebrisVolumeComponent): THREE.Object3D {
  const { spatial, macroVisuals } = comp.profile

  if (macroVisuals.proxyType === 'ring') {
    const geo = new THREE.RingGeometry(spatial.minRadius, spatial.maxRadius, 128)
    const mat = new THREE.MeshBasicMaterial({
      color: macroVisuals.color,
      transparent: true,
      opacity: macroVisuals.opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2  // flat on ecliptic plane
    mesh.name = 'debris-far-proxy'
    return mesh
  }

  // Sprite proxy (for Oort cloud or spherical shells)
  const spriteMat = new THREE.SpriteMaterial({
    color: macroVisuals.color,
    transparent: true,
    opacity: macroVisuals.opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(spriteMat)
  const avgRadius = (spatial.minRadius + spatial.maxRadius) / 2
  sprite.scale.setScalar(avgRadius * 2)
  sprite.name = 'debris-far-proxy'
  return sprite
}

// ─── Near LOD: Local Bubble InstancedMesh ───────────────────────────────────

function createLocalBubble(comp: DebrisVolumeComponent): THREE.InstancedMesh {
  const { microVisuals } = comp.profile

  // Pick geometry type
  let geo: THREE.BufferGeometry
  switch (microVisuals.geometryType) {
    case 'icosahedron': geo = new THREE.IcosahedronGeometry(1, 0); break
    case 'tetrahedron': geo = new THREE.TetrahedronGeometry(1, 0); break
    default:            geo = new THREE.DodecahedronGeometry(1, 0); break
  }

  const mat = new THREE.MeshStandardMaterial({
    color: microVisuals.colorPalette[0] ?? '#888888',
    roughness: microVisuals.roughness,
    metalness: 0,
  })

  const mesh = new THREE.InstancedMesh(geo, mat, microVisuals.instanceCount)
  mesh.name = 'debris-local-bubble'
  mesh.visible = false  // hidden until camera enters volume
  mesh.frustumCulled = false
  return mesh
}

// ─── Spherical Coordinate Placement ─────────────────────────────────────────

interface RockInstance {
  radius: number
  theta: number       // longitude
  phi: number         // inclination
  scale: number
  spinX: number
  spinY: number
  orbitSpeed: number
}

function generateInstances(comp: DebrisVolumeComponent): RockInstance[] {
  const { spatial, microVisuals } = comp.profile
  const instances: RockInstance[] = []

  for (let i = 0; i < microVisuals.instanceCount; i++) {
    // Radial placement with density curve
    let radius: number
    if (spatial.densityCurve === 'gaussian') {
      const peak = spatial.densityPeak ?? (spatial.minRadius + spatial.maxRadius) / 2
      const sigma = (spatial.maxRadius - spatial.minRadius) / 4
      radius = peak + gaussianRandom() * sigma
      radius = Math.max(spatial.minRadius, Math.min(spatial.maxRadius, radius))
    } else {
      radius = spatial.minRadius + Math.random() * (spatial.maxRadius - spatial.minRadius)
    }

    const theta = Math.random() * Math.PI * 2
    const phi = (Math.random() * 2 - 1) * spatial.maxInclination

    const scale = microVisuals.minSize + Math.random() * (microVisuals.maxSize - microVisuals.minSize)
    const spinX = (Math.random() - 0.5) * microVisuals.tumbleSpeed
    const spinY = (Math.random() - 0.5) * microVisuals.tumbleSpeed * 0.7
    const orbitSpeed = spatial.orbitSpeed * (spatial.minRadius / radius)  // Kepler-ish

    instances.push({ radius, theta, phi, scale, spinX, spinY, orbitSpeed })
  }

  return instances
}

/** Box-Muller transform for approximate gaussian random */
function gaussianRandom(): number {
  const u = 1 - Math.random()
  const v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

// ─── Main Generator ─────────────────────────────────────────────────────────

export function generateDebrisVolume(comp: DebrisVolumeComponent): THREE.Group {
  const group = new THREE.Group()
  group.name = `debris-${comp.variant}`

  // Far proxy
  const proxy = createFarProxy(comp)
  group.add(proxy)

  // Local bubble (hidden initially)
  const bubble = createLocalBubble(comp)
  group.add(bubble)

  // Pre-generate instance data
  const instances = generateInstances(comp)
  const dummy = new THREE.Object3D()

  // Set initial instance transforms
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i]
    const x = Math.cos(inst.theta) * inst.radius * Math.cos(inst.phi)
    const y = Math.sin(inst.phi) * inst.radius
    const z = Math.sin(inst.theta) * inst.radius * Math.cos(inst.phi)

    dummy.position.set(x, y, z)
    dummy.scale.setScalar(inst.scale)
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
    dummy.updateMatrix()
    bubble.setMatrixAt(i, dummy.matrix)
  }
  bubble.instanceMatrix.needsUpdate = true

  // Animation: update function stored on userData
  group.userData.update = (dt: number, _elapsed: number, camera: THREE.Camera) => {
    const camPos = camera.position
    const avgRadius = (comp.profile.spatial.minRadius + comp.profile.spatial.maxRadius) / 2
    const volumeWidth = comp.profile.spatial.maxRadius - comp.profile.spatial.minRadius
    const distToVolume = Math.abs(camPos.length() - avgRadius)

    // Distance-aware update
    const isNear = distToVolume < volumeWidth * 1.5
    bubble.visible = isNear
    proxy.visible = !isNear || true  // proxy always visible as background

    if (isNear) {
      // Per-instance orbital update
      for (let i = 0; i < instances.length; i++) {
        const inst = instances[i]
        inst.theta += inst.orbitSpeed * dt

        const x = Math.cos(inst.theta) * inst.radius * Math.cos(inst.phi)
        const y = Math.sin(inst.phi) * inst.radius
        const z = Math.sin(inst.theta) * inst.radius * Math.cos(inst.phi)

        dummy.position.set(x, y, z)
        dummy.scale.setScalar(inst.scale)
        dummy.rotation.x += inst.spinX * dt
        dummy.rotation.y += inst.spinY * dt
        dummy.updateMatrix()
        bubble.setMatrixAt(i, dummy.matrix)
      }
      bubble.instanceMatrix.needsUpdate = true
    }
  }

  return group
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/generators/DebrisVolumeGenerator.ts
git commit -m "feat: add DebrisVolumeGenerator — unified spherical-coord debris with far/near LOD"
```

---

## Task 7: CometGenerator

**Files:**
- Create: `src/lib/generators/CometGenerator.ts`

- [ ] **Step 1: Write the generator**

```ts
import * as THREE from 'three'
import type { CometComponent } from '@lib/ecs/types'

/**
 * CometGenerator — creates a nucleus (small rocky sphere) and a particle tail.
 * Tail always points away from the origin (sun) — anti-sunward direction.
 */

export function generateComet(comp: CometComponent): THREE.Group {
  const group = new THREE.Group()
  group.name = 'comet'

  // ── Nucleus ──
  const nucleusGeo = new THREE.DodecahedronGeometry(comp.nucleusRadius, 1)
  const nucleusMat = new THREE.MeshStandardMaterial({
    color: comp.coreColor,
    roughness: 0.8,
    metalness: 0,
    emissive: comp.coreColor,
    emissiveIntensity: 0.2,
  })
  const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat)
  nucleus.name = 'comet-nucleus'
  group.add(nucleus)

  // ── Tail (Points system) ──
  const count = comp.tailParticleCount
  const positions = new Float32Array(count * 3)
  const alphas = new Float32Array(count)
  const lifetimes = new Float32Array(count)
  const velocities = new Float32Array(count * 3)

  // Initialize particles behind the comet
  for (let i = 0; i < count; i++) {
    const t = Math.random()  // lifetime 0-1
    lifetimes[i] = t
    alphas[i] = 1.0 - t
    // Scatter particles behind the nucleus
    positions[i * 3] = (Math.random() - 0.5) * 0.02
    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.02
    positions[i * 3 + 2] = t * comp.tailLength
    // Initial velocity (will be overridden by anti-sunward direction)
    velocities[i * 3] = 0
    velocities[i * 3 + 1] = 0
    velocities[i * 3 + 2] = 0.5 + Math.random() * 0.5
  }

  const tailGeo = new THREE.BufferGeometry()
  tailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  tailGeo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))

  const tailMat = new THREE.PointsMaterial({
    color: comp.tailColor,
    size: 0.02,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })

  const tail = new THREE.Points(tailGeo, tailMat)
  tail.name = 'comet-tail'
  tail.frustumCulled = false
  group.add(tail)

  // ── Animation ──
  const sunPos = new THREE.Vector3(0, 0, 0)
  const antiSun = new THREE.Vector3()

  group.userData.update = (dt: number) => {
    // Anti-sunward direction (tail points away from origin)
    const worldPos = new THREE.Vector3()
    group.getWorldPosition(worldPos)
    antiSun.copy(worldPos).sub(sunPos).normalize()

    // Distance to sun affects tail intensity
    const distToSun = worldPos.length()
    const tailIntensity = Math.min(1.0, 3.0 / (distToSun + 0.5))
    tailMat.opacity = 0.6 * tailIntensity

    // Emissive intensity based on proximity to sun
    nucleusMat.emissiveIntensity = 0.2 + tailIntensity * 0.5

    // Update particle positions
    const posAttr = tailGeo.attributes.position as THREE.BufferAttribute
    const posArr = posAttr.array as Float32Array

    for (let i = 0; i < count; i++) {
      lifetimes[i] += dt * (0.3 + Math.random() * 0.1)

      if (lifetimes[i] > 1.0) {
        // Reset particle at nucleus
        lifetimes[i] = 0
        posArr[i * 3] = (Math.random() - 0.5) * 0.02
        posArr[i * 3 + 1] = (Math.random() - 0.5) * 0.02
        posArr[i * 3 + 2] = 0
      } else {
        // Drift in anti-sunward direction (in local space, align tail)
        const speed = (0.5 + Math.random() * 0.3) * dt * comp.tailLength
        posArr[i * 3] += (Math.random() - 0.5) * dt * 0.05  // lateral scatter
        posArr[i * 3 + 1] += (Math.random() - 0.5) * dt * 0.05
        posArr[i * 3 + 2] += speed
      }
    }

    posAttr.needsUpdate = true

    // Orient the tail group so +Z points anti-sunward
    if (antiSun.lengthSq() > 0.001) {
      const up = new THREE.Vector3(0, 1, 0)
      const quat = new THREE.Quaternion()
      const targetDir = group.worldToLocal(sunPos.clone().add(antiSun.clone().multiplyScalar(10)))
      tail.lookAt(targetDir)
    }
  }

  return group
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/generators/CometGenerator.ts
git commit -m "feat: add CometGenerator — nucleus + particle tail with anti-sunward drift"
```

---

## Task 8: Filter Store

**Files:**
- Create: `src/lib/stores/filterStore.svelte.ts`

- [ ] **Step 1: Write the filter store**

```ts
import type { Entity, MoonTier } from '@lib/ecs/types'

/**
 * Filter store — controls visibility of orbit path overlays.
 * Does NOT control body rendering (that's BodyLODManager's job).
 */

// ─── Reactive State ─────────────────────────────────────────────────────────

let planetOrbits = $state(true)
let dwarfPlanetOrbits = $state(true)
let majorMoonOrbits = $state(true)
let notableMoonOrbits = $state(false)
let minorMoonOrbits = $state(false)
let cometOrbits = $state(true)

// ─── Public Getters / Setters ───────────────────────────────────────────────

export function getFilters() {
  return {
    planetOrbits,
    dwarfPlanetOrbits,
    majorMoonOrbits,
    notableMoonOrbits,
    minorMoonOrbits,
    cometOrbits,
  }
}

export function setFilter(key: keyof ReturnType<typeof getFilters>, value: boolean): void {
  switch (key) {
    case 'planetOrbits': planetOrbits = value; break
    case 'dwarfPlanetOrbits': dwarfPlanetOrbits = value; break
    case 'majorMoonOrbits': majorMoonOrbits = value; break
    case 'notableMoonOrbits': notableMoonOrbits = value; break
    case 'minorMoonOrbits': minorMoonOrbits = value; break
    case 'cometOrbits': cometOrbits = value; break
  }
}

// ─── Visibility Check ───────────────────────────────────────────────────────

/**
 * Determine if an entity's orbit path overlay should be visible.
 * This only controls orbit LINE visibility, not the body itself.
 */
export function isOverlayVisible(entity: Entity): boolean {
  switch (entity.type) {
    case 'planet':
      return planetOrbits
    case 'dwarf-planet':
      return dwarfPlanetOrbits
    case 'moon': {
      const tier = (entity as any).userData?.moonTier as MoonTier | undefined
      if (tier === 'major') return majorMoonOrbits
      if (tier === 'notable') return notableMoonOrbits
      if (tier === 'minor') return minorMoonOrbits
      return majorMoonOrbits // default
    }
    case 'comet':
      return cometOrbits
    default:
      return true
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/stores/filterStore.svelte.ts
git commit -m "feat: add filterStore — orbit path overlay toggle state"
```

---

## Task 9: Filter Panel UI

**Files:**
- Create: `src/ui/panels/FilterPanel.svelte`

- [ ] **Step 1: Write the panel component**

```svelte
<script lang="ts">
  import { getFilters, setFilter } from '@lib/stores/filterStore.svelte'

  const filters = $derived(getFilters())

  function toggle(key: keyof typeof filters) {
    setFilter(key, !filters[key])
  }
</script>

<div class="filter-panel bg-black/70 backdrop-blur-xl border border-white/10 rounded-lg p-3">
  <h3 class="text-white/60 text-xs font-medium uppercase tracking-wider mb-2">Orbit Overlays</h3>

  <label class="filter-row">
    <input type="checkbox" checked={filters.planetOrbits} onchange={() => toggle('planetOrbits')} />
    <span>Planets</span>
  </label>

  <label class="filter-row">
    <input type="checkbox" checked={filters.dwarfPlanetOrbits} onchange={() => toggle('dwarfPlanetOrbits')} />
    <span>Dwarf Planets</span>
  </label>

  <label class="filter-row">
    <input type="checkbox" checked={filters.majorMoonOrbits} onchange={() => toggle('majorMoonOrbits')} />
    <span>Major Moons</span>
  </label>

  <label class="filter-row">
    <input type="checkbox" checked={filters.notableMoonOrbits} onchange={() => toggle('notableMoonOrbits')} />
    <span>Notable Moons</span>
  </label>

  <label class="filter-row">
    <input type="checkbox" checked={filters.minorMoonOrbits} onchange={() => toggle('minorMoonOrbits')} />
    <span>Minor Moons</span>
  </label>

  <label class="filter-row">
    <input type="checkbox" checked={filters.cometOrbits} onchange={() => toggle('cometOrbits')} />
    <span>Comets</span>
  </label>
</div>

<style>
  .filter-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.8rem;
  }
  .filter-row:hover {
    color: white;
  }
  .filter-row input[type="checkbox"] {
    accent-color: #4488ff;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/panels/FilterPanel.svelte
git commit -m "feat: add FilterPanel — orbit path overlay toggles"
```

---

## Task 10: sceneStore Integration

**Files:**
- Modify: `src/lib/stores/sceneStore.svelte.ts`

This task wires the new entity types into `buildThreeObject` and integrates the `BodyLODManager` + `filterStore` into the animation loop.

- [ ] **Step 1: Add imports for new generators and stores**

At the top of `sceneStore.svelte.ts`, add these imports alongside the existing ones:

```ts
import { generateDebrisVolume } from '@lib/generators/DebrisVolumeGenerator'
import { generateComet } from '@lib/generators/CometGenerator'
import { BodyLODManager } from '@lib/lod/BodyLODManager'
import { isOverlayVisible } from '@lib/stores/filterStore.svelte'
import type { DebrisVolumeComponent, CometComponent } from '@lib/ecs/types'
```

- [ ] **Step 2: Add new entity type branches in buildThreeObject**

In the `buildThreeObject` function (around line 567), add cases for `dwarf-planet`, `debris-volume`, and `comet` BEFORE the fallback `else` block:

After the `alien-tech` block and before the `else` fallback:

```ts
  // Dwarf Planet (same rendering as planet)
  } else if (type === 'dwarf-planet') {
    const planetComp = (entity.components['planet'] as PlanetComponent) ?? defaultPlanetConfig()
    if (!entity.components['planet']) entity.components['planet'] = planetComp
    group = generatePlanet(planetComp)
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) child.userData.entityId = entity.id
    })

  // Debris Volume (belt, ring, cloud)
  } else if (type === 'debris-volume') {
    const debrisComp = entity.components['debris-volume'] as DebrisVolumeComponent | undefined
    if (debrisComp) {
      group = generateDebrisVolume(debrisComp)
    } else {
      group = new THREE.Group()
    }
    group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.userData.entityId = entity.id
      }
    })

  // Comet
  } else if (type === 'comet') {
    const cometComp = entity.components['comet'] as CometComponent | undefined
    if (cometComp) {
      group = generateComet(cometComp)
    } else {
      group = new THREE.Group()
    }
    group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        child.userData.entityId = entity.id
      }
    })
```

- [ ] **Step 3: Add BodyLODManager to module scope and registerAnimationTick**

Add a module-level variable near `lodManager`:

```ts
let bodyLODManager: BodyLODManager | null = null
```

In `registerAnimationTick()`, after `lodManager = new LODManager(...)` (around line 644), add:

```ts
bodyLODManager = new BodyLODManager(engine.scene, 256)
```

Export a getter:

```ts
export function getBodyLODManager(): BodyLODManager | null {
  return bodyLODManager
}
```

- [ ] **Step 4: Integrate filter visibility into the animation loop**

In the animation loop inside `registerAnimationTick()` (the `engine.onTick` callback), update the entity iteration to check overlay visibility:

After the existing orbital animation block that sets `obj.position.copy(pos)`, add the overlay filter check:

```ts
      // Filter: orbit path overlay visibility
      const orbitLine = obj.getObjectByName('orbit-path') as THREE.Line | null
      if (orbitLine && entity) {
        orbitLine.visible = isOverlayVisible(entity)
      }
```

- [ ] **Step 5: Add entity color helper for new types**

In the `getEntityColor` function, add:

```ts
    case 'dwarf-planet': return 0x9988aa
    case 'debris-volume': return 0x888888
    case 'comet': return 0x88bbff
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/stores/sceneStore.svelte.ts
git commit -m "feat: integrate debris volumes, comets, LOD manager, and filter into sceneStore"
```

---

## Task 11: Solar System Loader

**Files:**
- Create: `src/lib/presets/SolarSystemLoader.ts`

- [ ] **Step 1: Write the loader**

```ts
import { PLANETS, MOONS, DEBRIS_VOLUMES, COMETS, SUN_CONFIG } from './SolarSystemData'
import { toSceneRadius, toSceneOrbit, toSceneMoonOrbit, toScenePeriodYears, toScenePeriod } from './ScalePolicy'
import { addEntity, enterSystemStudio, getBodyLODManager } from '@lib/stores/sceneStore.svelte'
import { defaultStarConfig } from '@lib/generators/StarGenerator'
import { defaultOrbitalConfig } from '@lib/generators/OrbitalSystem'
import type {
  PlanetComponent, OrbitalComponent, PhysicalDataComponent,
  DebrisVolumeComponent, CometComponent, MoonTier,
} from '@lib/ecs/types'

/**
 * SolarSystemLoader — creates the full Solar System as the default scene.
 * Call once after engine init when the scene is empty.
 */
export function loadSolarSystem(): void {
  // ── 1. Sun ──
  const starConfig = {
    ...defaultStarConfig(SUN_CONFIG.spectralClass),
    radius: SUN_CONFIG.radius,
    temperature: SUN_CONFIG.temperature,
    coronaIntensity: SUN_CONFIG.coronaIntensity,
    coronaReach: SUN_CONFIG.coronaReach,
    surfaceDetail: SUN_CONFIG.surfaceDetail,
  }

  const sun = addEntity('star', SUN_CONFIG.name, null, {
    star: starConfig,
  })
  sun.mass = SUN_CONFIG.mass
  sun.size = SUN_CONFIG.size

  const lodMgr = getBodyLODManager()

  // ── 2. Planets + Dwarf Planets ──
  const planetEntityMap = new Map<string, string>()  // planet name → entityId

  for (const p of PLANETS) {
    const sceneRadius = toSceneRadius(p.radiusKm)
    const orbitRadius = toSceneOrbit(p.orbitAu)
    const period = toScenePeriodYears(p.periodYears)

    const planetComp: PlanetComponent = {
      type: 'planet',
      variant: p.variant,
      radius: sceneRadius,
      colorRamp: p.colorRamp,
      roughness: p.roughness,
      noiseScale: p.noiseScale,
      noiseOctaves: 4,
      atmosphereEnabled: p.atmosphereEnabled,
      atmosphereColor: p.atmosphereColor,
      atmosphereDensity: p.atmosphereDensity,
      ringEnabled: false,
      ringInnerRadius: 0,
      ringOuterRadius: 0,
      ringSegments: 0,
      moonCount: 0,
      axisTilt: p.axisTiltDeg,
      rotationSpeed: 0.1,
    }

    const orbitalComp: OrbitalComponent = {
      type: 'orbital',
      orbitRadius,
      period,
      inclination: p.inclinationDeg,
      eccentricity: p.eccentricity,
      phase: Math.random() * Math.PI * 2,
    }

    const physicalComp: PhysicalDataComponent = {
      type: 'physical',
      radiusKm: p.radiusKm,
      semiMajorAxisAu: p.orbitAu,
      orbitalPeriodDays: p.periodYears * 365.25,
      eccentricity: p.eccentricity,
      inclinationDeg: p.inclinationDeg,
      axisTiltDeg: p.axisTiltDeg,
    }

    const entity = addEntity(p.entityType, p.name, sun.id, {
      planet: planetComp,
      orbital: orbitalComp,
      physical: physicalComp,
    })

    planetEntityMap.set(p.name, entity.id)

    // Register with LOD manager
    lodMgr?.register(entity.id, null, p.pointColor, sceneRadius * 100)
  }

  // ── 3. Moons ──
  for (const m of MOONS) {
    const parentId = planetEntityMap.get(m.parent)
    if (!parentId) continue

    const parentData = PLANETS.find(p => p.name === m.parent)
    if (!parentData) continue

    const sceneRadius = toSceneRadius(m.radiusKm)
    const orbitRadius = toSceneMoonOrbit(m.orbitRadiusKm, parentData.radiusKm)
    const period = toScenePeriod(m.periodDays)

    const planetComp: PlanetComponent = {
      type: 'planet',
      variant: m.variant,
      radius: sceneRadius,
      colorRamp: [
        { position: 0, color: '#555555' },
        { position: 0.5, color: m.pointColor },
        { position: 1, color: '#aaaaaa' },
      ],
      roughness: 0.5,
      noiseScale: 4,
      noiseOctaves: 3,
      atmosphereEnabled: false,
      atmosphereColor: '#888888',
      atmosphereDensity: 0,
      ringEnabled: false,
      ringInnerRadius: 0,
      ringOuterRadius: 0,
      ringSegments: 0,
      moonCount: 0,
      axisTilt: 0,
      rotationSpeed: 0.05,
    }

    const orbitalComp: OrbitalComponent = {
      type: 'orbital',
      orbitRadius,
      period,
      inclination: m.inclinationDeg,
      eccentricity: m.eccentricity,
      phase: Math.random() * Math.PI * 2,
    }

    const physicalComp: PhysicalDataComponent = {
      type: 'physical',
      radiusKm: m.radiusKm,
      semiMajorAxisAu: m.orbitRadiusKm / 149597870.7,
      orbitalPeriodDays: m.periodDays,
      eccentricity: m.eccentricity,
      inclinationDeg: m.inclinationDeg,
      axisTiltDeg: 0,
    }

    const entity = addEntity('moon', m.name, parentId, {
      planet: planetComp,
      orbital: orbitalComp,
      physical: physicalComp,
    })

    // Store moon tier on entity for filter lookups
    ;(entity as any).userData = { moonTier: m.tier }

    // Register with LOD manager
    lodMgr?.register(entity.id, null, m.pointColor, sceneRadius * 100)
  }

  // ── 4. Debris Volumes ──
  for (const dv of DEBRIS_VOLUMES) {
    const parentId = dv.parent === 'Sun' ? sun.id : planetEntityMap.get(dv.parent)
    if (!parentId) continue

    const debrisComp: DebrisVolumeComponent = {
      type: 'debris-volume',
      variant: dv.variant,
      profile: dv.profile,
    }

    addEntity('debris-volume', dv.name, parentId, {
      'debris-volume': debrisComp,
    })
  }

  // ── 5. Comets ──
  for (const c of COMETS) {
    // Comets need very large orbits. Semi-major axis from period + eccentricity:
    // For a Kepler orbit: a³ = P² (in AU/years with solar mass)
    const semiMajorAu = Math.pow(c.periodYears, 2 / 3)
    const orbitRadius = toSceneOrbit(semiMajorAu)
    const period = toScenePeriodYears(c.periodYears)

    const cometComp: CometComponent = {
      type: 'comet',
      nucleusRadius: c.nucleusRadius,
      tailLength: c.tailLength,
      tailParticleCount: c.tailParticleCount,
      tailColor: c.tailColor,
      coreColor: c.coreColor,
    }

    const orbitalComp: OrbitalComponent = {
      type: 'orbital',
      orbitRadius,
      period,
      inclination: c.inclinationDeg,
      eccentricity: c.eccentricity,
      phase: Math.random() * Math.PI * 2,
    }

    const entity = addEntity('comet', c.name, sun.id, {
      comet: cometComp,
      orbital: orbitalComp,
    })

    lodMgr?.register(entity.id, null, c.pointColor, 3.0)
  }

  // ── 6. Camera ──
  enterSystemStudio(sun.id)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/presets/SolarSystemLoader.ts
git commit -m "feat: add SolarSystemLoader — orchestrates full solar system creation on startup"
```

---

## Task 12: Viewport Default Scene Trigger

**Files:**
- Modify: `src/ui/layout/Viewport.svelte`

- [ ] **Step 1: Add import and default scene load call**

In `Viewport.svelte`, add the import:

```ts
import { getEntities } from '@lib/stores/sceneStore.svelte'
import { loadSolarSystem } from '@lib/presets/SolarSystemLoader'
```

After `registerAnimationTick()` (around line 46), add:

```ts
    // Load default solar system if scene is empty
    if (getEntities().length === 0) {
      loadSolarSystem()
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/layout/Viewport.svelte
git commit -m "feat: load solar system as default scene on startup"
```

---

## Task 13: PlanetComponent Ring Removal

**Files:**
- Modify: `src/lib/ecs/types.ts` (ring fields stay for backward compat but default to false/0)
- Modify: `src/lib/presets/SolarSystemLoader.ts` (already sets `ringEnabled: false`)

Per the spec, rings are now debris-volume children. The `ringEnabled` field stays on `PlanetComponent` for backward compatibility with existing scenes, but the Solar System loader always sets it to `false` and creates ring debris volumes instead.

- [ ] **Step 1: Verify ring fields default to disabled in the loader**

Confirm that `SolarSystemLoader.ts` already sets `ringEnabled: false` for all planets (it does — see Task 11). No code changes needed; this task is a verification step.

The existing `PlanetGenerator.ts` still supports `ringEnabled` for user-created custom planets. The ring removal from PlanetComponent is deferred to Phase 2 to avoid breaking existing saved scenes.

- [ ] **Step 2: Commit (documentation only)**

No code changes. Mark this task complete — the ring deprecation is documented in the spec's "Out of Scope" section.

---

## Post-Implementation Checklist

After all tasks are complete:

- [ ] Run `npm run dev` and verify the solar system loads on startup
- [ ] Verify orbit paths are visible at system scale
- [ ] Verify filter panel toggles hide/show orbit paths
- [ ] Verify zooming in on a planet shows its procedural shader
- [ ] Verify asteroid belt renders as a ring proxy from system view
- [ ] Verify Points cloud shows colored dots for distant bodies
- [ ] Run `npm run build` to check for TypeScript errors
- [ ] Commit any fixes

---

## Notes for Implementers

1. **Svelte 5 runes**: The `filterStore.svelte.ts` file uses `$state` and `$derived` — these only work in `.svelte` and `.svelte.ts` files.
2. **GLSL imports**: The GLSL files use `vite-plugin-glsl` which is already configured. Import them as strings: `import vert from './file.vert'`.
3. **Three.js auto-uniforms**: Do NOT redeclare `cameraPosition` in GLSL — Three.js injects it automatically for `ShaderMaterial`.
4. **Vite cache**: After editing GLSL files, you may need to clear the Vite cache: `rm -rf node_modules/.vite && npm run dev`.
5. **Entity tree**: The sidebar entity tree already supports parent-child relationships. New entity types will appear automatically.
6. **Moon tier**: The `userData.moonTier` property on moon entities is used by `filterStore` to determine overlay visibility tier. It's set during entity creation in the loader.
