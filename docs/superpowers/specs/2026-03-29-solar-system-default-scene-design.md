# Solar System Default Scene

**Date:** 2026-03-29
**Scope:** Default scene loading, solar system data, asteroid/Kuiper belts, comets, filter UI
**Phase:** This is Phase 1. Phase 2 (texture override system for planet-specific visuals) is separate.

## Overview

On startup, the app loads the real Solar System as the default scene: Sun, all 8 planets, Pluto, all named moons (~130+), an asteroid belt, a Kuiper belt, and 1-2 comets. A filter panel lets users toggle visibility of object classes and moon tiers.

## Architecture Decisions

### Physical vs. Visual Data Decoupling

Every entity stores **real physical values** (km, AU, days) alongside **scene-unit values** for rendering. A single scaling policy function converts between them.

```ts
interface PhysicalData {
  radiusKm: number
  semiMajorAxisAu: number
  orbitalPeriodDays: number
  massKg?: number
  eccentricity: number
  inclinationDeg: number
  axisTiltDeg: number
}
```

**Scaling policy** (swappable):
- Orbit distances: `1 AU = 3 scene units`
- Planet radii: `sceneRadius = realKm * 0.0000063` (linear proportional, Earth = 0.04)
- Orbital periods: `scenePeriod = realDays * (60 / 365.25)` (1 Earth year = 60 seconds of sim time)

The `PlanetComponent.radius` and `OrbitalComponent.orbitRadius` use scene values. `PhysicalData` is stored as a component on the entity (type: `'physical'`) so it's serializable and accessible via the ECS.

### New Entity Types

Add to the `EntityType` union in `types.ts`:
- `'dwarf-planet'` — Pluto, Ceres (renders via `PlanetComponent`, separate type for filtering)
- `'asteroid-belt'` — single entity, Three.js object is an InstancedMesh of rocks
- `'comet'` — nucleus mesh + particle tail

### New Component Types

```ts
interface AsteroidBeltComponent {
  type: 'asteroid-belt'
  innerRadius: number       // scene units
  outerRadius: number       // scene units
  instanceCount: number     // 2000-5000
  heightSpread: number      // vertical scatter (scene units)
  minRockSize: number       // scene units
  maxRockSize: number       // scene units
  orbitSpeed: number        // base angular speed
  color: string             // hex
}

interface CometComponent {
  type: 'comet'
  nucleusRadius: number     // scene units
  tailLength: number        // scene units
  tailParticleCount: number // 200-500
  tailColor: string         // hex
  coreColor: string         // hex
}
```

Both Kuiper belt and asteroid belt use `AsteroidBeltComponent` — same rendering tech, different parameters. The entity name distinguishes them.

## Solar System Data

### Planets

| # | Name | Type | Variant | Radius (km) | Orbit (AU) | Period (yr) | Ecc. | Inc. (deg) | Tilt (deg) | Atmo | Rings |
|---|------|------|---------|-------------|------------|-------------|------|-----------|-----------|------|-------|
| 1 | Mercury | planet | rocky | 2,440 | 0.387 | 0.241 | 0.206 | 7.0 | 0.03 | no | no |
| 2 | Venus | planet | rocky | 6,052 | 0.723 | 0.615 | 0.007 | 3.4 | 177.4 | yes (thick, #e8c56d) | no |
| 3 | Earth | planet | rocky | 6,371 | 1.000 | 1.000 | 0.017 | 0.0 | 23.4 | yes (#6b93d6) | no |
| 4 | Mars | planet | rocky | 3,390 | 1.524 | 1.881 | 0.093 | 1.9 | 25.2 | yes (thin, #c1440e) | no |
| 5 | Jupiter | planet | gas-giant | 69,911 | 5.203 | 11.86 | 0.049 | 1.3 | 3.1 | yes (#d4a060) | yes (faint) |
| 6 | Saturn | planet | gas-giant | 58,232 | 9.537 | 29.46 | 0.054 | 2.5 | 26.7 | yes (#e8d5a3) | yes (prominent) |
| 7 | Uranus | planet | ice | 25,362 | 19.19 | 84.01 | 0.047 | 0.8 | 97.8 | yes (#d1e7e7) | yes (faint) |
| 8 | Neptune | planet | ice | 24,622 | 30.07 | 164.8 | 0.009 | 1.8 | 28.3 | yes (#3f54ba) | yes (faint) |
| 9 | Pluto | dwarf-planet | ice | 1,188 | 39.48 | 247.9 | 0.249 | 17.2 | 122.5 | yes (thin, #c9b8a0) | no |
| 10 | Ceres | dwarf-planet | rocky | 473 | 2.77 | 4.60 | 0.076 | 10.6 | 4.0 | no | no |

**Sun**: G-class main-sequence star. Entity `mass: 100` (drives child orbital period calculation via existing physics), `size: 1`. Uses `defaultStarConfig('G')` with `radius: 0.5`, `temperature: 5778`, `coronaIntensity: 1.2`.

### Per-Planet Color Ramps

Hand-tuned to approximate real appearance with the procedural shader:

- **Mercury**: Gray/brown — `[#3d3832, #5e574e, #8a8078, #a09688]`
- **Venus**: Pale yellow/cream — `[#b89d6e, #d4bc8a, #e8d5a3, #f0e6c8]`
- **Earth**: Blue/green/brown/white — `[#1a3a5c, #2d6a4f, #7b6b43, #a8a8a8, #f0f0f0]`
- **Mars**: Red/rust/tan — `[#5c2a0e, #8b3a1a, #c1440e, #d4956a]`
- **Jupiter**: Cream/orange/brown bands — `[#8b6914, #c49b3a, #e8c56d, #d4a060, #8b5e3c]`
- **Saturn**: Pale gold/tan — `[#a08040, #c8a850, #e0d090, #d8c078, #b09848]`
- **Uranus**: Pale cyan/blue — `[#5f8f8f, #8ec4c4, #b0d8d8, #d1e7e7]`
- **Neptune**: Deep blue — `[#1a2a6c, #2d3fa0, #3f54ba, #5a6fd0]`
- **Pluto**: Beige/tan/brown — `[#7a6a5a, #9e8e7e, #c9b8a0, #a8967e]`

### Moon Tiers

Moons are tagged with a tier for the filter system:

**Tier 1 — Major (default visible, ~8):**
Moon (Earth), Io, Europa, Ganymede, Callisto (Jupiter), Titan (Saturn), Triton (Neptune), Charon (Pluto)

**Tier 2 — Notable (~13):**
Phobos, Deimos (Mars), Enceladus, Mimas, Rhea, Dione, Tethys, Iapetus (Saturn), Miranda, Ariel, Umbriel, Titania, Oberon (Uranus)

**Tier 3 — Minor (all remaining named moons, ~100+):**
All other officially named moons of Jupiter (~25+), Saturn (~40+), Uranus (~10+), Neptune (~10+), Pluto (Styx, Nix, Kerberos, Hydra).

Each moon entry in the data file includes: name, parent planet, orbital radius (km from planet), orbital period (days), radius (km), tier, and optionally eccentricity/inclination.

Moon display radii follow the same proportional scaling policy. Moons render using `PlanetComponent` with variant `'rocky'` or `'ice'` and appropriate color ramps.

### Asteroid Belt

- **Location**: 2.2–3.2 AU (6.6–9.6 scene units)
- **Instance count**: 3000
- **Rock geometry**: `DodecahedronGeometry(1, 0)` — 12-face low-poly
- **Materials**: 2-3 gray/brown variants for variety
- **Height spread**: 0.5 scene units (thin belt)
- **Rock sizes**: 0.005–0.03 scene units
- **Animation**: Per-instance orbital motion, Kepler-ish speed falloff by radius, per-rock tumble rotation

### Kuiper Belt

- **Location**: 30–50 AU (90–150 scene units)
- **Instance count**: 4000
- **Height spread**: 3.0 scene units (thicker, more scattered)
- **Rock sizes**: 0.008–0.05 scene units
- **More scattered/icy appearance** — slightly bluish tint vs. asteroid belt gray

### Comets

1-2 comets with highly eccentric orbits (e > 0.9):

- **Halley's Comet**: period ~75.3 years, eccentricity 0.967, inclination 162.3 deg
- **Comet Hale-Bopp** (optional): period ~2520 years, eccentricity 0.995

**Rendering:**
- **Nucleus**: Small sphere (`DodecahedronGeometry`, radius ~0.01), slightly emissive near perihelion
- **Tail**: `Points` geometry, 300-500 particles
  - Additive blending, `depthWrite: false`
  - Particles spawn at nucleus position, drift in anti-sunward direction
  - Per-particle lifetime with alpha fade
  - Tail length and brightness increase near perihelion (inversely proportional to distance from sun)
  - Color: blue-white (ion tail) with slight yellow (dust tail)

## New Files

| File | Purpose |
|------|---------|
| `src/lib/presets/SolarSystemData.ts` | All hardcoded physical + visual data for planets, moons, belts, comets |
| `src/lib/presets/SolarSystemLoader.ts` | Orchestrates creating all entities from the data on startup |
| `src/lib/presets/ScalePolicy.ts` | Scaling functions: `toSceneRadius(km)`, `toSceneOrbit(au)`, `toScenePeriod(days)` |
| `src/lib/generators/AsteroidBeltGenerator.ts` | InstancedMesh generator for asteroid/Kuiper belts |
| `src/lib/generators/CometGenerator.ts` | Nucleus + particle tail generator |
| `src/lib/stores/filterStore.svelte.ts` | Filter state (which object classes are visible) |
| `src/ui/panels/FilterPanel.svelte` | Toggle UI for object class visibility |

## Modified Files

| File | Changes |
|------|---------|
| `src/lib/ecs/types.ts` | Add `EntityType` entries, `AsteroidBeltComponent`, `CometComponent`, `PhysicalDataComponent` to Component union |
| `src/lib/stores/sceneStore.svelte.ts` | Import and call `SolarSystemLoader` on init when scene is empty; handle new entity types in `buildThreeObject`; integrate filter visibility in animation loop |
| `src/ui/layout/Viewport.svelte` | Call solar system loader after engine init |
| `src/lib/ecs/Serializer.ts` | Handle new component types in save/load |

## Filter Panel UI

Located in the system view area (near time controls or as a collapsible sidebar section).

| Filter | Default | Controls |
|--------|---------|----------|
| Planets | ON | Mercury through Neptune |
| Dwarf Planets | ON | Pluto, Ceres |
| Major Moons | ON | Tier 1 (~8 moons) |
| Notable Moons | OFF | Tier 2 (~13 moons) |
| Minor Moons | OFF | Tier 3 (~100+ moons) |
| Asteroid Belt | ON | Main belt InstancedMesh |
| Kuiper Belt | ON | Outer belt InstancedMesh |
| Comets | ON | All comets |
| Orbit Paths | ON | All orbital path lines |

**Implementation:**
- `filterStore.svelte.ts` exposes reactive state for each filter toggle
- On each animation tick, entities check their type + tier against filter state
- Filtered-out entities: `threeObject.visible = false` (cheap, no scene graph modification)
- Orbit path lines check the "Orbit Paths" filter independently
- Filter changes are immediate (no animation/transition needed)

## Default Scene Loading Flow

1. `Viewport.svelte` mounts → calls `registerAnimationTick()`
2. After engine init, check if scene is empty (`getEntities().length === 0`)
3. If empty, call `loadSolarSystem()` from `SolarSystemLoader.ts`
4. `loadSolarSystem()`:
   a. Creates Sun entity (G-class star)
   b. Iterates planet data → creates each planet as child of Sun
   c. Iterates moon data → creates each moon as child of its planet
   d. Creates asteroid belt entity as child of Sun
   e. Creates Kuiper belt entity as child of Sun
   f. Creates comet entities as children of Sun
   g. Applies initial filter state (minor moons hidden)
   h. Calls `enterSystemStudio(sunId)` to set camera
5. Scene is ready — user sees orbit paths with the Sun at center

## Performance Considerations

- **~150 entities** total (9 planets/dwarfs + ~130 moons + 2 belts + 2 comets + 1 star)
- **InstancedMesh** for belts: 3000 + 4000 = 7000 instances total, single draw call each
- **Orbit paths**: ~150 Line objects (512 points each). Minor moon orbit paths only created when their filter is enabled (lazy creation) to avoid 100+ line objects on startup
- **Comet particles**: 300-500 points, negligible
- **Filter visibility toggle**: `object.visible = false` prevents traversal — O(1) per entity per frame
- **Minor moon lazy loading**: Tier 3 moon entities are created in the ECS but their Three.js objects are only built when the "Minor Moons" filter is first enabled. This avoids ~100 mesh/orbit-line creations on startup.

## Out of Scope (Phase 2)

- Texture override system (BaseColorMap, BandProfileMap, FeatureMap blending)
- NASA texture maps for specific planets
- Jupiter GRS, Earth continents, Saturn hexagonal pole
- Per-planet custom shaders
- Dwarf planets beyond Pluto (Eris, Haumea, Makemake, Sedna)
