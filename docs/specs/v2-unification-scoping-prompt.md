# V2 Grand Unification — Scoping Session Prompt

Paste this into a new Claude Code session. Start on the **`v2-rebuild`** branch of `/Users/Michael/Documents/GitHub/celestial/`.

---

You are scoping the "grand unification" of the Celestial app. Two branches have diverged significantly and need to converge, with **v2-rebuild as the scaffold** (its architecture wins) and **main's features ported in**.

## Your Task

Read both branches, understand their architectures, and produce a phased porting plan. Do NOT write code — this is a read-only research and planning session.

## Branch Overview

### `v2-rebuild` (the scaffold — Svelte 5 + TypeScript + Vite + Three.js 0.175)
Architecture to preserve:
- **ECS**: `src/lib/ecs/` — SceneGraph, Serializer, entity/component types
- **Engine**: `src/lib/engine/Engine.ts` — render loop, scene management
- **LOD**: `src/lib/lod/BodyLODManager.ts` + `src/lib/impostor/` — 4-level LOD (point → billboard → low → high detail)
- **Generators**: `src/lib/generators/` — PlanetFactory, StarGenerator, GalaxyGenerator, NebulaGenerator, AlienTechGenerator, CometGenerator, etc.
- **Camera**: `src/lib/camera/CameraController.ts` — orbit, zoom, scale-aware navigation
- **Physics**: `src/lib/physics/PhysicsProperties.ts` — mass, radius, orbital mechanics
- **Shaders**: `src/lib/shaders/` — planet, star, atmosphere, corona, blackhole, nebula-volume, gpu-particle (+ includes: simplex3d, fbm, fresnel)
- **Stores**: `src/lib/stores/` — Svelte 5 rune-based reactive state (engine, scene, selection, filter, time, ui)
- **UI**: `src/ui/` — Svelte components for controls (Slider, Toggle, ColorPicker, etc.), panels (Planet, Star, EntityTree, Properties, etc.), layout (Sidebar, Viewport, StudioNav)

### `main` (the feature branch — vanilla JS + ES modules + Three.js r128 CDN)
Features to port:
- **Procedural skins**: 10 shader types in an uber-shader (`js/shaders/skin-shaders.js`) — Rocky, Gas Giant, Ice, Volcanic, Solar, Portal, Tech, Circuit, Alien, Ancient. Uses color ramp DataTexture from face color pair.
- **Effects system**: Pulsar beams, accretion disks, gamma rays, neutrino jets, lightning arcs, magnetic tentacles — each with multi-instance counts, turbulence, and dedicated color gradients (`js/phenomena.js`, `js/lightning.js`, `js/magnetic.js`)
- **3D gravity grid**: Spacetime deformation visualization — flat grid and 3D volumetric modes with probe, snow globe, relative motion (`js/grid3d.js`)
- **Particle swarm + black hole mode**: GPU-driven particle system with gravity, event horizon, absorption counter (`js/swarm.js`)
- **Context menu**: Right-click radial menu with tab navigation, draggable, push/pop sub-menu card stack, FX tile grid (`js/interaction.js`, `css/context-menu.css`)
- **CascadeSelect**: Custom flyout submenu dropdown with arbitrary nesting, viewport-aware flip (`js/cascade-select.js`, `css/cascade-select.css`)
- **Omega shape**: Dual shape system — second shape with independent geometry, skin, opacity, counter-spin, inter-dimensional ghost mode (`js/omega.js`, `js/geometry.js`)
- **Aura glow**: Sprite-based glow with reach, intensity, pulse rate, spike multiplier
- **Preset system**: 19 data-driven presets across 4 categories, full scene configuration bundles (`js/presets.js`)
- **Supernova / charge**: Charge-up → collapse → supernova → white dwarf respawn sequence
- **Save / load / reset / randomize**: Full state serialization to localStorage
- **Path / trail**: Waypoint pathing with bezier curves, trail sprites, direct/orbit modes
- **Quick spin**: Momentum-based free spin with axis memory

## What to Investigate

1. **Read v2's ECS types and SceneGraph** — understand how entities are composed from components. What component types exist? How are they created, updated, serialized?

2. **Read v2's Engine** — understand the render loop, update cycle, and how it dispatches to generators/managers. How would main's effects (pulsar, lightning, etc.) plug into this?

3. **Read v2's store pattern** — understand Svelte 5 runes reactivity. How do UI panels bind to entity state? How would main's 200+ state properties map to stores?

4. **Read v2's existing generators** — PlanetFactory, StarGenerator, etc. How do they create meshes, materials, and register with the scene graph? Main's skin system would need to integrate here.

5. **Read v2's LOD system** — BodyLODManager + impostor pipeline. How do LOD transitions work? Main's effects need to be LOD-aware (no lightning arcs on a 2px dot).

6. **Read main's state.js** — the flat state bag. Map each property group to the appropriate v2 component/store. Flag properties that don't have a v2 home yet.

7. **Read main's interaction.js** — the context menu and mouse handling. How would this integrate with v2's Svelte-based UI? Does v2 have any right-click handling?

8. **Identify what transfers directly**:
   - GLSL shader code (copy-paste between branches)
   - Preset data objects (JSON, architecture-independent)
   - Math/utility functions

9. **Identify what needs full rewriting**:
   - UI components (DOM manipulation → Svelte components)
   - State management (flat bag → ECS components + stores)
   - Event handlers (addEventListener → Svelte event directives)

## Deliverable

Write a porting plan to `docs/specs/v2-unification-plan.md` with:

1. **Architecture mapping**: Table showing main concept → v2 equivalent (existing or needs creation)
2. **Phased plan**: 4-6 phases ordered by dependency and value, each with:
   - What features it ports
   - What new ECS components it creates
   - What Svelte UI it builds
   - Estimated complexity (S/M/L/XL)
3. **First vertical slice**: The single best feature to port first as a proof-of-concept. Should touch ECS, shaders, UI, and stores to validate the integration pattern. Recommend which feature and why.
4. **Risk register**: Things that could go wrong (Three.js version differences, shader compatibility, state migration, etc.)
5. **What to NOT port**: Features on main that are superseded by better v2 implementations (e.g., main's flat state bag vs v2's ECS)

Do not write code. Do not make changes. Read, analyze, and write the plan document.
