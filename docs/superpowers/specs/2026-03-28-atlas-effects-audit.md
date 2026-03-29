# Atlas Effects Audit — Techniques Worth Stealing

**Date:** 2026-03-28
**Source:** github.com/SurceBeats/Atlas (PolyForm Noncommercial — concepts only, no code)
**Purpose:** Reference for Celestial's planet taxonomy and shader development

## STEAL — Adapt These Techniques

### 1. Lava Flows (Voronoi Cracks + FBM)
- 3D Voronoi for crack patterns with multi-octave FBM for lava texture
- 4-layer FBM at different frequencies (6x, 12x, 24x, 48x) with weighted blend
- 3-color temperature gradient (core → hot → cool) with emissive glow
- Day/night lighting modulation
- **Use for:** Lava, volcanic, magma, molten core planet types

### 2. Starfield Atmospheric Scintillation
- Stars wobble, elongate, and dim when viewed through planet atmosphere
- Ray-sphere intersection computes atmosphere path length
- Tangent-direction elongation of point sprites simulates atmospheric seeing
- Separate attenuation sphere with Beer's law: `1 - exp(-density * path)`
- Turbulent twinkle via 3 sin layers at different frequencies
- **Use for:** Background starfield interaction with any planet that has atmosphere

### 3. Ring System Shadow
- Planet casts shadow on ring particles via geometric cone projection
- Projects particle position onto light axis, computes perpendicular distance
- Expanding cone shadow with `coneExpansion` factor
- Depth-based alpha for ring density
- **Use for:** Any planet with rings (gas giants, ice worlds)

### 4. Chromatic Dispersion (Crystalline)
- 3 separate `refract()` calls with different IOR offsets (R, G, B)
- Multi-normal rough reflection approximation (perturb normal 3 ways, blend results)
- Fresnel + cubemap reflection + refraction combined
- **Use for:** Crystalline, diamond, ice planet types

### 5. Probabilistic Voronoi Cracks
- Standard 2D Voronoi edge detection
- Two overlapping Voronoi layers at different scales for organic variation
- Seed-based per-cell `shouldDrawLine()` probability culling
- Creates natural sparse crack patterns instead of uniform grids
- **Use for:** Rocky, arid, desert, terrain crack overlays

## INSPIRE — Good Concepts, Rebuild as GPU Shaders

### 6. Cloud Patches → Single Sphere Cloud Layer
- **Atlas does:** N separate PlaneGeometry meshes projected onto sphere, each with FBM shader
- **We should do:** Single sphere ShaderMaterial with FBM cloud density, animated wind offset, day/night lighting
- **Features:** Cloud density from noise threshold, directional light response, radial edge mask

### 7. Landmasses → Fragment Shader Scalar Field
- **Atlas does:** CPU union-find clustering → triangle mesh grid → Laplacian smoothing
- **We should do:** Per-pixel scalar field in fragment shader — weighted distance from N seed points, threshold for land/ocean, noise-perturbed borders
- **Features:** Continent shapes, coastal detail, elevation-based color banding

### 8. Ocean Shader Feature Checklist
- Multi-layer sinusoidal waves (3+ layers, different frequencies/directions)
- Fractal noise for foam at wave crests
- Caustic pattern: `pow(max(sin(x) * sin(z), 0), 3)` for crossing wave interference
- Deep-ocean darkening based on depth/distance from land
- Fresnel reflection at glancing angles
- Landmass cutout mask (from scalar field above)
- Animated UV offset for surface flow

### 9. Gas Giant Storm Vortices
- Define storm centers as 3D positions on sphere
- Compute angular distance from each storm center
- Spiral function: `sin(angle * spiralFreq + angularDist * radialFreq - time * speed)`
- Layer with horizontal cloud bands
- **Features:** Configurable storm count, size, rotation speed

### 10. Phase-Transitioning Matter (Anomaly/Exotic)
- 6 visual states: solid, liquid, gas, energy, quantum, antimatter
- Each state has distinct particle behavior (shrink, flow, expand, pulse, uncertainty, inversion)
- Each state has distinct fragment shape (hard point, wavy, diffuse, interference, probability cloud, ring)
- Coherence factor drives transition smoothness
- **Use for:** Alien tech, anomaly entity types

### 11. Per-Planet-Type Post-Processing
- Stack of post-process passes selected by planet type
- Toxic worlds: green tint + chromatic aberration + godrays
- Lava worlds: bloom + heat shimmer
- Crystalline: prismatic aberration + high bloom
- **Implementation:** EffectComposer with type-specific ShaderPass chain

## Atlas Planet Type Taxonomy (27 types)

| Type | Key Visual Features |
|------|-------------------|
| Rocky | Terrain layers, mountains, craters (70%), clouds |
| Gas Giant | Cloud bands (3-20), storms (50%), polar hexagon (30%) |
| Icy | Crystals (20-30), cracks, ice caps (2-4), clouds |
| Oceanic | Ocean + landmass patches, rivers |
| Desert | Sand terrain, cracks, heat shimmer |
| Lava | Lava flows, eruptions, lava rivers |
| Volcanic | Eruptions, ash clouds, lava |
| Arid | Dry terrain, sparse features |
| Tundra | Frozen ground, sparse ice |
| Swamp | Dark water, vegetation patches |
| Forest | Dense vegetation, green terrain |
| Savannah | Grassland terrain, sparse trees |
| Cave | Dark surface, sparse features |
| Crystalline | Crystal formations, prismatic surface |
| Anomaly | Phase matter, geometric shapes, energy |
| Metallic | Reflective surface, industrial feel |
| Toxic | Green/purple haze, bubbles, radiation rings |
| Radioactive | Radiation rings, glow, energy emissions |
| Magma | Full magma flows, intense heat |
| Molten Core | Exposed molten interior |
| Carbon | Dark surface, carbon trails |
| Diamond | Prismatic, high refraction, brilliant |
| Super Earth | Large rocky with ocean + landmass |
| Sub Earth | Small rocky, sparse features |
| Frozen Gas Giant | Cold gas giant, ice crystal bands |
| Nebulous | Gaseous, diffuse, low density |
| Aquifer | Water-rich, underground water features |
| Exotic | Geometric shapes, energy, anomalous |
