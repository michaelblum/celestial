# Orchestrator Lead-In Prompt

Paste this into a new Claude Code session on the `main` branch of `/Users/Michael/Documents/GitHub/celestial/`:

---

You are the orchestrator for a small bug-fix sprint on the Celestial app. Read the spec at `docs/specs/2026-03-31-cascade-skin-fixes.md` — it contains 3 independent bugs with root causes already identified, fix approaches specified, and a verification checklist.

**The bugs:**
1. Cascade submenu disappears when mousing from parent item into the submenu (CSS hover gap + needs JS delay)
2. Clicking a cascade menu item falls through to the canvas, moving the 3D object (mousedown guard missing `.cascade-dropdown`)
3. All procedural skins cause faces/edges to disappear (GLSL variable `cross` shadows built-in function, breaks shader compilation)

**Key files:**
- `css/cascade-select.css` — cascade menu styles
- `js/cascade-select.js` — CascadeSelect class
- `js/interaction.js` — mousedown handlers at lines ~435 and ~557
- `js/shaders/skin-shaders.js` — GLSL uber-shader, `runePattern2D` helper ~line 102

All three fixes are independent and can be done in parallel. The spec has exact line numbers, code snippets, and a test checklist. Execute all three fixes, commit each separately with descriptive messages, then push. Do not modify any files beyond what the spec describes.
