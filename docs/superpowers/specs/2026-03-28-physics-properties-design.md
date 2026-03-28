# Physics Properties + Emergent Behavior — Design Spec

**Date:** 2026-03-28
**Scope:** Make size/mass/velocity real properties with consistent relationships. Derived properties (density, gravity, luminosity, escape velocity) computed automatically and drive visual behavior.

## Overview

Every entity has three fundamental properties: size, mass, and velocity. Everything else — density, gravity, luminosity, orbital dynamics, black hole thresholds — is derived from these three. When a user drags a mass slider, the star gets brighter, its planets orbit faster, and if mass/size crosses a threshold, it becomes a black hole. No stored state for derived values. Pure functions compute them on demand.

## 1. The Three Fundamentals

Added to every Entity. Editable via the Properties panel.

| Property | Meaning | Unit | Examples |
|----------|---------|------|----------|
| `size` | Diameter | Relative (1.0 = Earth) | Moon: 0.27, Earth: 1.0, Jupiter: 11, Sun: 109, Red Giant: 500 |
| `mass` | Amount of matter | Relative (1.0 = Earth) | Moon: 0.012, Earth: 1.0, Jupiter: 318, Sun: 333000 |
| `velocity` | Speed of travel | Relative (1.0 = Earth orbital) | Stationary: 0, Earth orbit: 1.0, Mercury: 1.6 |

`size` and `mass` already exist on Entity. `velocity` is new — added to the Entity interface alongside them. Default: 0 for root entities, derived from orbital config for children.

## 2. Derived Properties

Pure functions in a new `src/lib/physics/PhysicsProperties.ts` file. No state, no Three.js. Just math.

### density(mass, size)

```
density = mass / (size ^ 3)
```

Determines object character:
- < 0.5: gas cloud / nebula
- 0.5–2.0: gas giant
- 2.0–6.0: rocky planet
- 6.0–100: dense star
- 100–10000: white dwarf / neutron star
- > 10000: black hole territory

### gravity(mass, size)

```
gravity = mass / (size ^ 2)
```

Proportional surface gravity. Drives:
- Orbital speed of children: higher gravity = faster orbits
- Atmosphere retention hint (future)
- Visual weight/influence radius

### escapeVelocity(mass, size)

```
escapeVelocity = sqrt(mass / size) * scaleFactor
```

If an orbiting entity's velocity exceeds this relative to its parent, the orbit is unstable.

### luminosity(mass)

Stars only. Simplified mass-luminosity relation:

```
luminosity = mass ^ 3.5  (normalized so Sun-mass = 1.0)
```

This is actually close to the real astrophysical relationship. Drives:
- Corona intensity: `coronaIntensity = clamp(luminosity * 0.3, 0.1, 3.0)`
- Surface temperature shift: brighter = hotter
- Light emission radius

### isBlackHole(mass, size)

```
ratio = mass / size
return ratio > BLACK_HOLE_THRESHOLD  (threshold ≈ 50000)
```

When this returns true, the star auto-switches to black-hole variant.

### orbitalPeriod(parentMass, orbitRadius)

```
period = sqrt(orbitRadius ^ 3 / parentMass) * scaleFactor
```

Inspired by Kepler's third law. Replaces the manually-set `period` on OrbitalComponent. When the parent's mass changes, all children automatically orbit faster or slower.

## 3. Emergent Behaviors

### Star mass changes

When a star's `mass` slider moves:
1. `luminosity` recalculates → corona intensity and temperature update live
2. `gravity` recalculates → all child orbital periods recalculate → planets orbit faster/slower
3. If `isBlackHole(mass, size)` flips to true → star auto-regenerates as black hole variant
4. If it flips back to false → regenerates as normal star

### Planet size changes (mass constant)

1. `density` recalculates → could inform future variant auto-detection
2. Bounding sphere resizes → collision boundaries update
3. Atmosphere mesh scales proportionally

### Velocity exceeds escape velocity

If a child entity's velocity > `escapeVelocity(parentMass, parentSize)`:
- Visual indicator (orbit path turns red or dashed)
- Entity is not forcibly removed — user can create "escaping" scenarios intentionally

### Orbital period auto-derivation

The `period` field on `OrbitalComponent` becomes **derived** rather than stored:
- Computed from `orbitalPeriod(parentMass, orbitRadius)`
- The OrbitalPanel still shows the period value but as read-only
- Users control orbital behavior through mass (of parent) and orbit radius (of child)

## 4. File Changes

| File | Action | Notes |
|------|--------|-------|
| `src/lib/physics/PhysicsProperties.ts` | Create | Pure functions: density, gravity, escapeVelocity, luminosity, isBlackHole, orbitalPeriod |
| `src/lib/ecs/types.ts` | Modify | Add `velocity: number` to Entity interface |
| `src/lib/ecs/SceneGraph.ts` | Modify | Default velocity per entity type |
| `src/lib/stores/sceneStore.svelte.ts` | Modify | Animation tick uses derived orbital period instead of stored period; star luminosity drives corona uniforms |
| `src/ui/panels/PropertiesPanel.svelte` | Modify | Add velocity slider to Physics section; show derived properties as read-only |
| `src/ui/panels/StarPanel.svelte` | Modify | Show luminosity (derived, read-only); auto-detect black hole from mass/size |
| `src/ui/panels/PlanetPanel.svelte` | Modify | Show density (derived, read-only) |
| `src/ui/panels/OrbitalPanel.svelte` | Modify | Period becomes read-only (derived from parent mass + orbit radius) |

## 5. Derived Properties Display

In the Properties panel, derived values display as read-only formatted text (not sliders). Styled differently from editable controls — dimmer, no interactive elements:

```
PHYSICS
Mass          [====●========] 333000
Size          [====●========] 109
Velocity      [====●========] 0

DERIVED
Density         25.7
Gravity         28.0
Luminosity      3.8 × 10¹⁹
```

For stars, luminosity appears in the Star panel section. For planets, density appears in the Planet panel section. Escape velocity and other contextual values show where relevant.

## 6. Thresholds and Constants

Defined as named constants in `PhysicsProperties.ts`:

```typescript
const BLACK_HOLE_THRESHOLD = 50000    // mass/size ratio
const NEUTRON_STAR_THRESHOLD = 5000   // mass/size ratio
const ORBITAL_SCALE_FACTOR = 10       // tuning factor for orbital period feel
const LUMINOSITY_EXPONENT = 3.5       // mass-luminosity relation
```

These are tuning knobs — not sacred physics constants. They get adjusted until the behavior feels right.

## 7. Out of Scope

- Scale-dependent visibility / culling (separate spec)
- Real-world unit annotations (km, kg, m/s display — separate spec)
- N-body simulation between siblings (too complex for now)
- Space-time deformation sandbox (separate spec)
- Collision/impact physics (future)
- Automatic variant detection from density (future — e.g. high density planet auto-becomes rocky)
