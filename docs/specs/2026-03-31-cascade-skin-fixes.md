# Cascade Menu + Skin Rendering Fixes

## Context

The Celestial app just received a `CascadeSelect` flyout submenu component (replacing native `<select>` dropdowns) and 10 procedural skin types in a GLSL uber-shader. Three bugs were found during QA.

## Bug 1: Submenu disappears when mousing from parent into submenu

**Root cause:** The `.cascade-submenu` is positioned with `left: 100%; margin-left: 2px` — that 2px gap means the mouse briefly leaves `.cascade-parent` before entering `.cascade-submenu`, triggering CSS `:hover` loss and hiding the submenu.

**Files:** `css/cascade-select.css`, `js/cascade-select.js`

**Fix approach:** Two changes needed:
1. **CSS:** Remove `margin-left: 2px` (and `margin-right: 2px` for `.flip-left`). Add a transparent "bridge" zone via a `::before` pseudo-element on `.cascade-submenu` that extends a few pixels back toward the parent, maintaining hover continuity.
2. **JS (belt-and-suspenders):** Add a small delay (~100ms) before hiding submenus on mouseleave. Use `setTimeout` in a mouseleave handler on `.cascade-parent` to delay removing `.cascade-open`, and clear it on mouseenter. This handles edge cases where CSS hover alone isn't reliable (touch devices, fast mouse movement).

**CSS bridge approach:**
```css
.cascade-submenu::before {
    content: '';
    position: absolute;
    top: 0;
    right: 100%;   /* extends left from submenu back to parent */
    width: 10px;
    height: 100%;
}
.cascade-submenu.flip-left::before {
    right: auto;
    left: 100%;    /* extends right for flipped menus */
}
```

**Verification:** Slowly and quickly mouse from a parent item into its submenu. The submenu should remain visible throughout. Test both right-flyout and left-flyout (near viewport edge) configurations.

## Bug 2: Clicking menu item falls through to canvas, moving the object

**Root cause:** In `js/interaction.js` line 556-558, the mousedown handler checks if the click is "UI" via `e.target.closest('#sidebar') || e.target.closest('.ctx-anchor')`. But the cascade dropdown is appended to `document.body` (to escape overflow clipping), so it's NOT inside `#sidebar` or `.ctx-anchor`. The mousedown passes the UI guard and reaches the raycasting/navigation code.

**Files:** `js/interaction.js`, `js/cascade-select.js`

**Fix approach:** Two options (do BOTH for robustness):
1. **In `js/interaction.js` line 557:** Add `.cascade-dropdown` to the UI check:
   ```js
   const isUI = e.target.closest('#sidebar') || e.target.closest('.ctx-anchor') || e.target.closest('.cascade-dropdown');
   ```
2. **In `js/cascade-select.js`:** Add `mousedown` and `pointerdown` stopPropagation on the dropdown element when it's created:
   ```js
   this._dropdown.addEventListener('mousedown', (e) => e.stopPropagation());
   this._dropdown.addEventListener('pointerdown', (e) => e.stopPropagation());
   ```

**Also** add the same guard to the OTHER mousedown handler at line 435 (context menu close-on-click-outside):
```js
if (anchor && anchor.classList.contains('visible') && !anchor.contains(e.target) && !e.target.closest('.cascade-dropdown') && e.button !== 2) {
```

**Verification:** Open a cascade dropdown in the sidebar. Click on a menu item. The object should NOT move. Click on a parent category (non-leaf). The object should NOT move. Click outside the dropdown to close it — this SHOULD work normally.

## Bug 3: All skins make faces/edges disappear (shader compilation failure)

**Root cause:** In `js/shaders/skin-shaders.js`, the `runePattern2D` helper function (line ~102) declares a local variable named `cross`:
```glsl
float cross = min(abs(uv.x), abs(uv.y));
```

`cross` is a GLSL built-in function (vec3 cross product). While GLSL technically allows shadowing built-in names with local variables, many GPU drivers (especially on macOS/iOS/integrated GPUs) reject this as a compilation error. Since ALL skin types share the same uber-shader, a compilation error in ANY helper function prevents ALL skins from rendering — the mesh gets an invalid material and becomes invisible.

**Files:** `js/shaders/skin-shaders.js`

**Fix:** Rename the variable from `cross` to `crossDist`:
```glsl
float crossDist = min(abs(uv.x), abs(uv.y));
float crossGlow = (1.0 - smoothstep(0.0, 0.015, crossDist)) * step(0.65, h) * step(dist, 0.4);
```

**Additional verification step:** After renaming, audit the entire shader for other built-in name shadows. Search for local variables named: `cross`, `dot`, `length`, `distance`, `normalize`, `reflect`, `refract`, `mix`, `step`, `clamp`, `min`, `max`, `abs`, `sign`, `floor`, `ceil`, `fract`, `mod`, `pow`, `exp`, `log`, `sqrt`, `sin`, `cos`, `tan`, `atan`. Fix any found.

**Verification:** Select each skin type (Rocky, Gas Giant, Ice, Volcanic, Solar, Portal, Tech, Circuit, Alien, Ancient) on a sphere. Each should render a visible surface — no invisible meshes, no WebGL errors in console.

## Implementation Order

These three fixes are independent — they can be done in parallel or any order.

1. Bug 3 first (shader fix) — this is a one-line rename, fastest to fix, highest user impact
2. Bug 2 second (click fall-through) — two small edits in interaction.js + cascade-select.js
3. Bug 1 third (submenu hover) — CSS + JS timing changes

## Test Checklist

- [ ] Apply Rocky skin → sphere shows continental terrain (not invisible)
- [ ] Apply Tech skin → sphere shows panel grid
- [ ] Apply Circuit skin → sphere shows neon grid lines
- [ ] Apply Ancient skin → dodecahedron shows glowing runes
- [ ] Apply Portal skin → sphere shows starfield view-through
- [ ] Open cascade dropdown in sidebar → click item → object does NOT move
- [ ] Open cascade dropdown in context menu → click item → object does NOT move
- [ ] Hover parent category → submenu flies out → mouse to submenu → stays visible
- [ ] Near right viewport edge → submenu flips left → hover bridge still works
- [ ] Select "Death Star" preset → gray tech sphere appears
- [ ] Select "Tron Grid" preset → cyan circuit sphere appears
- [ ] Randomize multiple times → skins appear without errors
