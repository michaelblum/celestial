# Generator Property Panels — Design Spec

**Date:** 2026-03-28
**Scope:** Per-type property panels with live uniform binding and gradient editor integration

## Overview

Wire UI controls to Three.js shader uniforms and material properties so users can tweak entity appearance in real-time. Each entity type gets a dedicated panel component with controls specific to its generator.

## Architecture

### Uniform Bridge

A `syncComponentToThreeObject(entityId, componentType)` function in `sceneStore.svelte.ts` handles the UI → Three.js propagation:

- **Live updates** (~80% of properties): Patches `material.uniforms.X.value` or `MeshStandardMaterial` properties directly on the existing Three.js object. No mesh disposal/rebuild. Includes: star temperature/detail/corona, planet noise/roughness/atmosphere/colorRamp, nebula colors/density/intensity, alien-tech metalness/roughness/emissive.

- **Regenerate updates** (~20%): Disposes old Three.js object, calls generator fresh with updated config, swaps into scene graph and `threeObjects` map, re-registers with LOD manager. Required for: variant/type changes, spectral class, particle counts, geometry changes (radius, ring toggles).

Uses a per-entity-type lookup table mapping property names → uniform names + update strategy. Centralized in sceneStore, not scattered across panels.

### Update Flow

```
Panel control change
  → updateComponent(entityId, updatedComponent)  // ECS state
  → syncComponentToThreeObject(entityId, type)    // Three.js state
    → live: patch uniforms/material properties
    → regenerate: dispose → rebuild → swap → LOD re-register
```

## Panel Components

Six new files in `src/ui/panels/`:

### StarPanel.svelte (~120 lines)

| Control | Property | Type | Range | Strategy |
|---------|----------|------|-------|----------|
| SelectControl | spectralClass | enum | O/B/A/F/G/K/M | regenerate |
| SelectControl | variant | enum | main-sequence/red-giant/neutron/white-dwarf/black-hole | regenerate |
| SliderControl | temperature | float | 1000–40000 | live |
| SliderControl | surfaceDetail | float | 1–8 | live |
| SliderControl | coronaIntensity | float | 0–2 | live |
| SliderControl | coronaReach | float | 0–3 | live |
| SliderControl | radius | float | 0.2–5 | regenerate |

### PlanetPanel.svelte (~180 lines)

| Control | Property | Type | Range | Strategy |
|---------|----------|------|-------|----------|
| SelectControl | variant | enum | rocky/gas-giant/ice/volcanic | regenerate |
| GradientEditor | colorRamp | GradientStop[] | — | live (rebuild DataTexture) |
| SliderControl | noiseScale | float | 0.5–8 | live |
| SliderControl | noiseOctaves | int | 2–6 | live |
| SliderControl | roughness | float | 0–1 | live |
| ToggleSwitch | atmosphereEnabled | bool | — | regenerate |
| ColorPickerControl | atmosphereColor | hex | — | live |
| SliderControl | atmosphereDensity | float | 0–1 | live |
| ToggleSwitch | ringEnabled | bool | — | regenerate |
| SliderControl | ringInnerRadius | float | 1.2–3 | regenerate |
| SliderControl | ringOuterRadius | float | 2–4 | regenerate |
| SliderControl | radius | float | 0.2–5 | regenerate |

Gradient editor is the existing `GradientEditor.svelte`. On stop change, panel updates `colorRamp` component, then sync rebuilds the 256x1 DataTexture and assigns to `material.uniforms.colorRamp.value`.

### NebulaPanel.svelte (~100 lines)

| Control | Property | Type | Range | Strategy |
|---------|----------|------|-------|----------|
| SelectControl | method | enum | sprites/volumetric/particles | regenerate |
| SelectControl | style | enum | nebula/smoke/fire/plasma | regenerate |
| ColorPickerControl | colorPrimary | hex | — | live |
| ColorPickerControl | colorSecondary | hex | — | live |
| SliderControl | density | float | 0–2 | live |
| SliderControl | scale | float | 0.5–10 | regenerate |
| ColorPickerControl | lightColor | hex | — | live |
| SliderControl | lightIntensity | float | 0–5 | live |
| SliderControl | particleCount | int | 5000–40000 | regenerate |

### GalaxyPanel.svelte (~100 lines)

All properties require particle regeneration. Debounce 200ms on all controls.

| Control | Property | Type | Range | Strategy |
|---------|----------|------|-------|----------|
| SliderControl | armCount | int | 2–6 | regenerate |
| SliderControl | twist | float | 0.2–1.0 | regenerate |
| SliderControl | spread | float | 1–5 | regenerate |
| SliderControl | starCount | int | 5000–50000 (step 1000) | regenerate |
| SliderControl | radius | float | 3–20 | regenerate |
| SliderControl | bulgeSize | float | 0–0.5 | regenerate |
| ColorPickerControl | innerColor | hex | — | regenerate |
| ColorPickerControl | outerColor | hex | — | regenerate |

### AlienTechPanel.svelte (~80 lines)

| Control | Property | Type | Range | Strategy |
|---------|----------|------|-------|----------|
| SelectControl | variant | enum | dyson-sphere/halo-construct | regenerate |
| SliderControl | metalness | float | 0–1 | live |
| SliderControl | roughness | float | 0–1 | live |
| ColorPickerControl | emissiveColor | hex | — | live |
| SliderControl | emissiveIntensity | float | 0–3 | live |
| SliderControl | radius | float | 1–5 | regenerate |
| SliderControl | detail | int | 1–4 | regenerate |

### OrbitalPanel.svelte (~80 lines)

Shown as additional section in PropertiesPanel when entity has orbital component.

| Control | Property | Type | Range | Strategy |
|---------|----------|------|-------|----------|
| SliderControl | orbitRadius | float | 1–50 | live (update path + position) |
| SliderControl | period | float | 5–100 | live |
| SliderControl | inclination | float | 0–360 | live (rebuild orbit path) |
| SliderControl | eccentricity | float | 0–0.9 | live (rebuild orbit path) |

## New Shared Control

### ColorPickerControl.svelte

Wraps `<input type="color">` with label styling consistent with SliderControl/ToggleSwitch. Props: `label`, `value` (bindable hex string).

## PropertiesPanel Changes

After the existing transform section, add a type switch:

```svelte
{#if entity.type === 'star'}
  <StarPanel {entity} />
{:else if entity.type === 'planet' || entity.type === 'moon'}
  <PlanetPanel {entity} />
{:else if entity.type === 'nebula'}
  <NebulaPanel {entity} />
{:else if entity.type === 'galaxy'}
  <GalaxyPanel {entity} />
{:else if entity.type === 'alien-tech'}
  <AlienTechPanel {entity} />
{/if}

{#if entity.components.orbital}
  <OrbitalPanel {entity} />
{/if}
```

## Extensibility

The per-type panel pattern supports future additions:
- New galaxy variants: add option to GalaxyPanel's SelectControl + builder case in GalaxyGenerator
- New alien tech types (polyhedra + effects): add variant option + builder in AlienTechGenerator
- New entity types: create a new panel component + generator, add case to PropertiesPanel switch

No framework or registry needed — just Svelte components and generator functions.

## Files Changed

- `src/lib/stores/sceneStore.svelte.ts` — add `syncComponentToThreeObject()`
- `src/ui/panels/PropertiesPanel.svelte` — add type switch, import panels
- **New:** `src/ui/panels/StarPanel.svelte`
- **New:** `src/ui/panels/PlanetPanel.svelte`
- **New:** `src/ui/panels/NebulaPanel.svelte`
- **New:** `src/ui/panels/GalaxyPanel.svelte`
- **New:** `src/ui/panels/AlienTechPanel.svelte`
- **New:** `src/ui/panels/OrbitalPanel.svelte`
- **New:** `src/ui/controls/ColorPickerControl.svelte`

## Out of Scope

- Random preset button (future enhancement on top of this)
- "Dive into" cross-studio navigation (separate feature)
- 2D space-time deformation sandbox (future)
- 3D voxel grid sandbox (future)
