# Celestial v2 — Cosmic Scene Builder

## Tech Stack
- Svelte 5 (runes) + Vite 8 + TypeScript + Three.js (npm) + TailwindCSS 4
- GLSL shaders via `vite-plugin-glsl` (supports `#include` directives)
- Dev server: `npm run dev` (port 5173)

## Architecture
- `src/lib/engine/` — Three.js Engine singleton (renderer, camera, OrbitControls, animation loop)
- `src/lib/ecs/` — Lightweight Entity-Component System (not full ECS — entities own component maps)
- `src/lib/generators/` — Procedural generators: Star, Planet, Nebula, Galaxy, AlienTech, OrbitalSystem
- `src/lib/shaders/` — GLSL vert/frag files with `includes/` for simplex noise, FBM, fresnel
- `src/lib/impostor/` — LOD system: ImpostorBaker, BillboardRenderer, ShroudTransition, LODManager
- `src/lib/stores/` — Svelte 5 rune stores bridging UI ↔ Three.js
- `src/ui/` — Svelte components: layout/, panels/, controls/, shared/
- `_legacy/` — v1 code preserved for reference (experiments with working shader code to port from)

## Critical Gotchas
- Svelte 5 runes (`$state`, `$derived`) only work in `.svelte` and `.svelte.ts` files — regular `.ts` files silently fail
- Import `.svelte.ts` stores with the `.svelte` suffix: `from './store.svelte'`
- Three.js auto-injects `cameraPosition` uniform in ShaderMaterial — never redeclare it in GLSL
- After editing GLSL files, clear Vite cache: `rm -rf node_modules/.vite` and restart dev server
- `FogExp2` density 0.008 hides stars at distance 200+ — use 0.0015 for visible starfield

## Conventions
- Entity generators return `THREE.Group` with `userData.update(dt, elapsed, camera)` for animation
- Tag meshes with `userData.entityId` for raycasting selection
- Glass-morphism UI: `bg-black/70 backdrop-blur-xl border border-white/10`
- Scene schema version: `2.0.0` — no backward compat with v1

## Branch: `v2-rebuild`
- PR #2 tracks the full rebuild (keep open, merge when ready)
- Plan file: `.claude/plans/ticklish-knitting-flamingo.md`

## What's Built (Phases 0-5 complete)
- Stars (7 spectral classes, FBM surface, corona, black hole variant)
- Planets (4 variants, gradient color ramp, atmosphere, rings)
- Nebulae (3 methods: sprites, volumetric shells, 40K GPU particles)
- Galaxy (25K spiral arm particles)
- Alien Tech (Dyson Sphere, Halo Construct)
- Orbital mechanics with visible path guides
- LOD/impostor system with shroud transitions
- Full UI: sidebar, toolbar, entity tree, properties panel, gradient editor, studio nav

## Next Session Priorities
- Generator-specific property panels (wire controls to shader uniforms)
- Gradient editor → planet color ramp live binding
- Random button (generate interesting presets per body type)
- "Dive into" cross-studio navigation (click impostor → shroud → enter child studio)
