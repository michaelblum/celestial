# Solar System Default Scene (Revised)

**Date:** 2026-03-29
**Scope:** Default scene loading, solar system data, debris volumes, comets, LOD-driven rendering, filter UI for overlays
**Phase:** Phase 1. Phase 2 (texture override system for planet-specific visuals) is separate.

## Overview

On startup, the app loads the real Solar System as the default scene: Sun, all 8 planets, Pluto, Ceres, all named moons (~130+), an asteroid belt, a Kuiper belt, and 1-2 comets. A **4-tier LOD system** governs what geometry is rendered for each body based on camera distance. A **filter panel** controls visibility of informational overlays (orbit paths, labels) — NOT body rendering.

## 1. Architecture Decisions

### Physical vs. Visual Data Decoupling

Every entity stores **real physical values** (km, AU, days) alongside **scene-unit values** for rendering. A single scaling policy function converts between them.

```ts
interface PhysicalDataComponent {
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

### Scaling Policy (`src/lib/presets/ScalePolicy.ts`)

Three separate scales — planet orbits, moon orbits, and body radii — because the real ratios span many orders of magnitude:

- **Planet orbit distances**: `1 AU = 3 scene units`
- **Moon orbit distances**: Custom compressed scale anchored to parent's visual radius.
  ```ts
  toSceneMoonOrbit(moonOrbitKm, parentRadiusKm) =
    toSceneRadius(parentRadiusKm) * 1.2 + Math.pow(moonOrbitKm, 0.3) * MOON_ORBIT_FACTOR
  ```
  This prevents moons from rendering inside their parent planets (Io's orbit of 421,700 km would be 0.0084 scene units in the solar scale — buried inside Jupiter's 0.44 visual radius).
- **Body radii**: `sceneRadius = Math.max(realKm * 0.0000063, 0.001)` — linear proportional with a minimum clamp to prevent sub-pixel/z-fighting issues for tiny bodies (Deimos at 6.2 km → 0.000039 without clamp).
- **Orbital periods**: `scenePeriod = realDays * (60 / 365.25)` (1 Earth year = 60 seconds of sim time)

`PlanetComponent.radius` and `OrbitalComponent.orbitRadius` use scene values. `PhysicalDataComponent` is stored as a component on the entity so it's serializable and available for future annotations/tooltips.

### New Entity Types

Add to `EntityType` in `types.ts`:
- `'dwarf-planet'` — Pluto, Ceres (renders via `PlanetComponent`, separate type for overlay filtering)
- `'debris-volume'` — Unified type for asteroid belt, Kuiper belt, planetary rings, Oort cloud
- `'comet'` — nucleus mesh + particle tail

### New Component Types

#### DebrisVolumeComponent (Data-Driven Profile Pattern)

The component is structured as a **Profile** with distinct sections, designed so each section maps directly to a future UI panel (e.g., "Debris Studio" sliders). This pattern will eventually extend to planets and stars.

```ts
interface DebrisVolumeProfile {
  // --- Section 1: Spatial Math ---
  // Defines the mathematical volume in spherical coordinates.
  // Controls placement, density distribution, and orbital motion.
  spatial: {
    minRadius: number            // inner edge (scene units)
    maxRadius: number            // outer edge (scene units)
    maxInclination: number       // radians: ~0 = flat ring, ~0.035 = thin belt, ~1.57 = shell
    densityCurve: 'uniform' | 'gaussian' | 'banded'
    densityPeak?: number         // where gaussian peaks (scene units, e.g., 2.7 AU for asteroids)
    orbitSpeed: number           // base angular speed
  }

  // --- Section 2: Far LOD Visuals (Macro) ---
  // Appearance of the static proxy mesh seen from system scale.
  // RingGeometry for belts/rings, Sprite for spherical shells.
  macroVisuals: {
    proxyType: 'ring' | 'sprite'
    color: string                // hex — dominant tint
    opacity: number              // 0-1 — how solid vs. dusty
    textureStyle: 'smooth' | 'banded' | 'dusty'  // drives the 1D gradient generation
    bandCount?: number           // for 'banded' style (e.g., Saturn's ring gaps)
  }

  // --- Section 3: Near LOD Visuals (Micro) ---
  // Appearance of individual rocks/particles in the local bubble.
  microVisuals: {
    microRenderType: 'mesh'      // Phase 1: solid rocks. Phase 2+: 'sprite' for gas/nebula
    geometryType: 'dodecahedron' | 'icosahedron' | 'tetrahedron'
    instanceCount: number        // rocks in the local bubble (2000-4000)
    minSize: number              // scene units
    maxSize: number              // scene units
    colorPalette: string[]       // hex array — rocks randomly pick from this
    roughness: number            // 0-1 — material roughness
    tumbleSpeed: number          // per-rock self-rotation speed
  }
}

interface DebrisVolumeComponent {
  type: 'debris-volume'
  variant: 'asteroid-belt' | 'kuiper-belt' | 'planetary-ring' | 'oort-cloud'
  profile: DebrisVolumeProfile
}
```

Each profile section is independently editable — a future "Debris Studio" UI can bind sliders directly to `profile.spatial.*`, `profile.macroVisuals.*`, and `profile.microVisuals.*` without flattening or remapping.

#### CometComponent

```ts
interface CometComponent {
  type: 'comet'
  nucleusRadius: number      // scene units
  tailLength: number         // scene units
  tailParticleCount: number  // 200-500
  tailColor: string          // hex
  coreColor: string          // hex
}
```

### The Unified Debris Volume

The key insight: asteroid belts, Kuiper belts, planetary rings, and the Oort cloud are all the **same structure in spherical coordinates** — differing only in `maxInclination`:

| Structure | maxInclination | Shape |
|-----------|---------------|-------|
| Planetary rings | ~0 rad | Perfectly flat disk |
| Asteroid belt | ~0.035 rad (~2°) | Thin torus |
| Kuiper belt | ~0.17 rad (~10°) | Fat torus |
| Oort cloud | ~1.57 rad (90°) | Spherical shell |

A single `DebrisVolumeGenerator` handles all of these with a `densityCurve` parameter for radial tapering (e.g., asteroid belt peaks at ~2.7 AU, Oort cloud tapers at edges).

## 2. LOD System (Rendering Governor)

The LOD system — not the filter UI — decides what geometry is drawn for each body. 4 tiers based on camera distance:

### LOD Level 3: Points Cloud (Macro Scale)
- **When**: Body is sub-pixel or very far from camera
- **Tech**: Single `THREE.Points` object with a custom `THREE.ShaderMaterial`, batching ALL distant bodies into **1 draw call**
- **Buffer attributes**: The Points geometry carries three per-vertex buffer attributes that the ECS updates each frame:
  - `position` (vec3) — orbital position in world space
  - `color` (vec3) — body's characteristic color (Mars = red, Earth = blue, Titan = orange, etc.)
  - `size` (float) — apparent size hint based on body's real radius (gas giants get slightly larger points than rocky moons)
- **ShaderMaterial**: The vertex shader reads `size` to set `gl_PointSize` (with distance attenuation). The fragment shader reads `color` and applies a soft radial falloff for a luminous dot appearance (not a hard square pixel).
- **Behavior**: ECS calculates orbital positions on CPU (~0.1ms for 150 bodies), updates position/color/size buffers, then sets `geometry.attributes.position.needsUpdate = true` (and color/size on first frame or when bodies transition in/out of the cloud).

### LOD Level 2: Billboard / Sprite (Mid Scale)
- **When**: Body is a few pixels wide (e.g., zooming toward Jupiter, its moons become visible discs)
- **Tech**: `THREE.Sprite` or shared `THREE.InstancedMesh` of camera-facing planes
- **Behavior**: Body removed from Points cloud, drawn as a tiny colored circle with basic glow

### LOD Level 1: Low-Poly 3D (Near Scale)
- **When**: Body takes up ~5% of screen
- **Tech**: `DodecahedronGeometry` or `IcosahedronGeometry`
- **Behavior**: Real 3D with lighting. No procedural shader yet.

### LOD Level 0: Hero Shader (Studio Scale)
- **When**: Camera is in the body's local space (entering body studio)
- **Tech**: High-poly sphere with the full procedural shader (noise, color ramp, atmosphere, rings)
- **Behavior**: Only 1-3 hero shaders active at once (the focused body + nearest moons)

### LOD for Debris Volumes

Debris volumes have their own 3-tier LOD, independent of the body LOD:

1. **Far LOD**: A static proxy mesh.
   - Belts/rings: `THREE.RingGeometry` with 1D gradient texture (bands, gaps, dust).
   - Oort cloud: `THREE.Sprite` with radial gradient billboard.
   - **Cost**: 1 draw call, 2 triangles. Zero CPU per frame.

2. **Mid LOD**: Static proxy stays visible as volumetric background. Additionally spawn a **Local Bubble** `InstancedMesh` of ~2000-4000 rocks around the camera within the volume's bounds.

3. **Near LOD (Treadmill)**: Camera is inside the volume. Rocks that fall behind the camera frustum are pooled and repositioned ahead of the camera with randomized scale/rotation/noise-seed — creating the illusion of an infinite field without melting the GPU. Rock positions are clamped to the volume's allowed radius and inclination bounds.

## 3. Filter UI (Overlay Governor)

The filter panel controls **informational overlays only** — orbit path lines and future UI labels/annotations. It does NOT control body rendering (that's the LOD system's job).

| Filter | Default | Controls |
|--------|---------|----------|
| Planet Orbits | ON | Orbit path lines for Mercury–Neptune |
| Dwarf Planet Orbits | ON | Orbit paths for Pluto, Ceres |
| Major Moon Orbits | ON | Orbit paths for Tier 1 moons (~8) |
| Notable Moon Orbits | OFF | Orbit paths for Tier 2 moons (~13) |
| Minor Moon Orbits | OFF | Orbit paths for Tier 3 moons (~100+) |
| Comet Orbits | ON | Orbit paths for comets |

**Implementation** (`filterStore.svelte.ts`):
- Reactive state for each overlay toggle
- Orbit path `Line` objects check filter state: `orbitLine.visible = isFilterVisible(entity)`
- Filter changes are immediate (no transition)
- Future: labels, annotations, distance markers would also respect these filters

**Animation loop optimization**: When orbit paths are filtered out, skip their update logic entirely:

```ts
for (const [id, obj] of threeObjects) {
  const entity = getEntity(id)

  // LOD system decides body rendering (always runs)
  lodManager.updateEntity(id, obj, camera)

  // Filter only affects overlays (orbit lines, labels)
  const orbitLine = obj.getObjectByName('orbit-path')
  if (orbitLine) {
    orbitLine.visible = isOverlayVisible(entity)
  }

  // Always update orbital position (LOD needs it even for Points cloud)
  if (entity?.components['orbital']) {
    const orbital = entity.components['orbital'] as OrbitalComponent
    obj.position.copy(getOrbitalPosition(orbital, simElapsed))
  }
}
```

## 4. Solar System Data

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

**Sun**: G-class main-sequence star. Entity `mass: 100` (drives child orbital period calculation via existing Kepler physics — ensure `Math.sqrt(G * M / r)` is calibrated for M=100 at scene distances), `size: 1`. Uses `defaultStarConfig('G')` with `radius: 0.5`, `temperature: 5778`, `coronaIntensity: 1.2`.

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
- **Ceres**: Dark gray — `[#3a3a3a, #555555, #6e6e6e, #888888]`

### Moon Tiers

**Tier 1 — Major (~8):**
Moon (Earth), Io, Europa, Ganymede, Callisto (Jupiter), Titan (Saturn), Triton (Neptune), Charon (Pluto)

**Tier 2 — Notable (~13):**
Phobos, Deimos (Mars), Enceladus, Mimas, Rhea, Dione, Tethys, Iapetus (Saturn), Miranda, Ariel, Umbriel, Titania, Oberon (Uranus)

**Tier 3 — Minor (all remaining named moons, ~100+):**
All other officially named moons of Jupiter (~25+), Saturn (~40+), Uranus (~10+), Neptune (~10+), Pluto (Styx, Nix, Kerberos, Hydra).

Each moon entry: name, parent planet, orbital radius (km), orbital period (days), radius (km), tier, eccentricity, inclination.

Moon display radii follow the proportional scaling policy with the 0.001 minimum clamp. Moons render via `PlanetComponent` with variant `'rocky'` or `'ice'`.

### Debris Volume Profiles

Each debris volume uses the profile structure. Key parameters per volume:

**Asteroid Belt** (`variant: 'asteroid-belt'`):
- `spatial`: minRadius 2.2 AU, maxRadius 3.2 AU, maxInclination 0.035 rad (~2°), densityCurve `'gaussian'`, densityPeak 2.7 AU
- `macroVisuals`: proxyType `'ring'`, color `#777777`, opacity 0.3, textureStyle `'dusty'`
- `microVisuals`: microRenderType `'mesh'`, geometryType `'dodecahedron'`, instanceCount 3000, minSize 0.005, maxSize 0.03, colorPalette `['#666666', '#7a7060', '#8a7a6a']`, roughness 1.0

**Kuiper Belt** (`variant: 'kuiper-belt'`):
- `spatial`: minRadius 30 AU, maxRadius 50 AU, maxInclination 0.17 rad (~10°), densityCurve `'gaussian'`
- `macroVisuals`: proxyType `'ring'`, color `#8899aa`, opacity 0.15, textureStyle `'dusty'`
- `microVisuals`: microRenderType `'mesh'`, geometryType `'dodecahedron'`, instanceCount 4000, minSize 0.008, maxSize 0.05, colorPalette `['#8899aa', '#99aabb', '#7788aa']`, roughness 0.8

**Saturn's Rings** (`variant: 'planetary-ring'`):
- `spatial`: minRadius 0.1*, maxRadius 0.22*, maxInclination ~0 rad, densityCurve `'banded'`, bandCount 5
- `macroVisuals`: proxyType `'ring'`, color `#e8d5a3`, opacity 0.7, textureStyle `'banded'`
- `microVisuals`: microRenderType `'mesh'`, geometryType `'icosahedron'`, instanceCount 2000, minSize 0.001, maxSize 0.008, colorPalette `['#f0e8d8', '#e8dcc8', '#d8ccb8']`, roughness 0.3

**Uranus's Rings** (`variant: 'planetary-ring'`):
- `spatial`: minRadius 0.06*, maxRadius 0.08*, maxInclination ~0 rad, densityCurve `'banded'`
- `macroVisuals`: proxyType `'ring'`, color `#aabbcc`, opacity 0.1, textureStyle `'banded'`
- `microVisuals`: microRenderType `'mesh'`, geometryType `'icosahedron'`, instanceCount 500, minSize 0.001, maxSize 0.005, colorPalette `['#c0d0e0', '#b0c0d0']`, roughness 0.4

*Ring radii are in scene units relative to parent planet.

Saturn's rings get the full `debris-volume` treatment: textured RingGeometry from far, local bubble of icy rocks when zoomed in. This replaces the existing simple `ringEnabled` approach on PlanetComponent.

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

## 5. New Files

| File | Purpose |
|------|---------|
| `src/lib/presets/SolarSystemData.ts` | All hardcoded physical + visual data for planets, moons, debris volumes, comets |
| `src/lib/presets/SolarSystemLoader.ts` | Orchestrates creating all entities from the data on startup |
| `src/lib/presets/ScalePolicy.ts` | `toSceneRadius(km)`, `toSceneOrbit(au)`, `toSceneMoonOrbit(km, parentKm)`, `toScenePeriod(days)` |
| `src/lib/generators/DebrisVolumeGenerator.ts` | Unified generator: spherical-coord placement, far proxy mesh, local bubble InstancedMesh, treadmill recycling |
| `src/lib/generators/CometGenerator.ts` | Nucleus + particle tail generator |
| `src/lib/lod/BodyLODManager.ts` | 4-tier LOD: Points cloud → Sprite → Low-poly → Hero shader. Manages transitions, Points batch object |
| `src/lib/stores/filterStore.svelte.ts` | Overlay filter state (orbit paths, labels) |
| `src/ui/panels/FilterPanel.svelte` | Toggle UI for orbit path / overlay visibility |

## 6. Modified Files

| File | Changes |
|------|---------|
| `src/lib/ecs/types.ts` | Add `EntityType` entries (`dwarf-planet`, `debris-volume`, `comet`), `DebrisVolumeComponent`, `CometComponent`, `PhysicalDataComponent` to Component union |
| `src/lib/stores/sceneStore.svelte.ts` | Import and call `SolarSystemLoader` on init; handle new entity types in `buildThreeObject`; delegate rendering decisions to `BodyLODManager`; overlay filter integration |
| `src/ui/layout/Viewport.svelte` | Call solar system loader after engine init |
| `src/lib/ecs/Serializer.ts` | Handle new component types in save/load |
| `src/lib/generators/PlanetGenerator.ts` | Remove `ringEnabled`/ring params from PlanetComponent (rings become debris-volume children) |

## 7. Default Scene Loading Flow

1. `Viewport.svelte` mounts → engine init → checks if scene is empty
2. If empty, `SolarSystemLoader.loadSolarSystem()` runs:
   a. Creates Sun entity (G-class star)
   b. Creates all planets + dwarf planets as children of Sun
   c. Creates all moons as children of their respective planets (all tiers, ECS data + Points cloud entries)
   d. Creates debris volume entities: asteroid belt, Kuiper belt as children of Sun; Saturn/Uranus rings as children of their planets
   e. Creates comet entities as children of Sun
   f. Initializes `BodyLODManager` with all entity positions
   g. Applies default overlay filter state (minor moon orbits hidden)
   h. Calls `enterSystemStudio(sunId)` to set camera
3. Scene is ready — user sees orbit paths with the Sun at center, all bodies rendered as Points at system scale

## 8. Performance Budget (Non-Gaming Laptop Target)

- **ECS orbital updates**: ~150 `Math.sin/cos` calls per frame = ~0.1-0.2ms CPU. Always runs.
- **Points cloud**: 1 draw call for all distant bodies. Negligible GPU.
- **Hero shaders**: 1-3 active at any time (focused body + close neighbors). Dominant GPU cost.
- **Debris far proxies**: 4 RingGeometry/Sprite objects = 4 draw calls. Negligible.
- **Debris local bubbles**: 2000-4000 InstancedMesh rocks when camera is near a belt = 1 draw call each. Per-frame matrix updates only when camera is inside the volume.
- **Orbit path lines**: ~20-30 visible by default (planets + major moons). Minor moon orbit lines only created when filter is toggled ON. 512 points each.
- **Draw call budget**: ~10-20 total at system scale (1 Points + 4 debris proxies + orbit lines). Well within laptop GPU limits.

## 9. Relationship to Existing LOD System

The existing `LODManager` in `src/lib/impostor/LODManager.ts` was designed for the "dive into one entity" use case (billboard impostors). It is currently **disabled** (billboard transitions commented out). The solar system requires a different LOD paradigm (many simultaneously visible bodies at vastly different scales).

**Approach**: Build `BodyLODManager` as a **new, parallel** LOD system. The existing `LODManager` remains for future use (dive-into transitions). The two systems can coexist — `BodyLODManager` handles system-scale rendering, `LODManager` handles studio-scale impostor transitions.

## Out of Scope (Phase 2+)

- Texture override system (BaseColorMap, BandProfileMap, FeatureMap blending)
- NASA texture maps for specific planets
- Jupiter GRS, Earth continents, Saturn hexagonal pole
- Per-planet custom shaders
- Dwarf planets beyond Pluto (Eris, Haumea, Makemake, Sedna)
- ~~Oort cloud as debris-volume~~ — **MOVED IN-SCOPE**: The legacy `OortCloudGenerator.ts` is dead code (imported but never called). Delete it and add an Oort cloud entry to `DEBRIS_VOLUMES` using the unified `DebrisVolumeProfile` with `maxInclination: 1.57`. The 2D `OortCloudOverlay.svelte` stays — it's a scale-transition UX effect, not a debris volume.
- Active-system scoping (`getEntitiesBySystem()` for multi-system universes)
- **Gaseous Debris Volumes**: The `DebrisVolumeGenerator` is designed to support nebulas and gas clouds by setting `microVisuals.microRenderType: 'sprite'` instead of `'mesh'`. This swaps the near-LOD local bubble from solid rock `InstancedMesh` to translucent, additive-blending billboard planes — same spatial math, same treadmill recycling, different micro render. The existing Nebula generator could eventually be replaced by this unified approach.
- Data-Driven Profile Pattern for `PlanetComponent` and `StarComponent` (refactoring their flat property lists into sectioned profiles matching the `DebrisVolumeProfile` pattern)
