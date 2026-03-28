# Celestial

Interactive 3D polyhedron editor built with Three.js. A single self-contained HTML file — no build step, no dependencies to install.

**[Open it](index.html)** in any browser, or serve it locally:

```bash
open index.html
# or
python3 -m http.server 8000 && open http://localhost:8000
```

## Features

- **Platonic solids** — tetrahedron, cube, octahedron, dodecahedron, icosahedron
- **Full color control** — master color, per-element colors (faces, edges, aura)
- **Appearance** — face opacity, hollow core view, interior edges, specular highlights
- **Aura system** — pulsing glow with intensity, pulse rate, and spike amplitude
- **Camera** — perspective/orthographic toggle, FOV control
- **Z-depth scaling** — continuous slider, bounded range, discrete depth stops with animated transitions
- **Movement** — click-to-move with physics-based rotation, or auto-path with direct/curved modes
- **Presets** — Default, Black Hole, Pure Crystal, Neon Ghost
- **Editable values** — click any numeric display to type an exact value

## Presets

| Preset | Look |
|--------|------|
| Default | Purple translucent crystal with visible edges |
| Black Hole | Opaque black core, purple edge glow |
| Pure Crystal | Cyan translucent, white edges, subtle aura |
| Neon Ghost | Invisible faces, neon wireframe only |

## Tech

Single HTML file. Three.js r128 loaded from CDN. No framework, no bundler. Everything is vanilla JS with direct Three.js API calls.

## Files

- `index.html` — current version (the editor)
- `celestial-v1.html` — earlier version (historical reference)

## License

MIT
