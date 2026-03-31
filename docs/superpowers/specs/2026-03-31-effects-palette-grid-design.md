# Effects Palette Grid — Design Spec

**Date:** 2026-03-31
**Session:** Effects Palette Grid
**Branch:** main (sandbox-v1 prototype)

## Summary

Replace the checkbox-based FX tab in the context menu with a visual **effects tile grid** — a 3x3 palette of clickable tiles. Each tile represents an effect (pulsar, accretion disk, gamma rays, neutrinos, lightning, magnetic field, particle swarm, black hole mode, aura). Click a tile to toggle the effect on/off. Active tiles get a magenta glow/highlight. Tiles with detailed settings show a small gear icon that opens the existing sub-menu card.

The design is **data-driven**: a single `EFFECTS` array defines all tiles. Adding a new effect = adding one array entry. This is the foundation for an extensible "effects palette" — legos for decorating celestial objects.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Grid columns | 3 | ~75px tiles, fits 9 effects in 3 rows within 260px card |
| Tile content | Emoji + label | Simple, no asset dependencies, easy to extend |
| Settings access | Gear icon overlay | Click tile = toggle, click gear = open sub-menu. Clear affordance |
| Architecture | Data-driven (Approach A) | Adding new effect = one array entry. Supports "lego" extensibility goal |

## Data Model

### Effects Registry

A flat JS array where each object defines one tile:

```js
const EFFECTS = [
  { id: 'pulsar',    emoji: '\uD83D\uDCA0', label: 'Pulsar',     stateKey: 'isPulsarEnabled',    sidebarId: 'pulsarToggle' },
  { id: 'accretion', emoji: '\uD83C\uDF00', label: 'Accretion',  stateKey: 'isAccretionEnabled', sidebarId: 'accretionToggle' },
  { id: 'gamma',     emoji: '\u2622\uFE0F',  label: 'Gamma',      stateKey: 'isGammaEnabled',     sidebarId: 'gammaToggle' },
  { id: 'neutrino',  emoji: '\uD83D\uDD35', label: 'Neutrino',   stateKey: 'isNeutrinosEnabled', sidebarId: 'neutrinoToggle' },
  { id: 'lightning', emoji: '\u26A1',        label: 'Lightning',  stateKey: 'isLightningEnabled', sidebarId: 'lightningToggle', subMenuId: 'ctx-sub-lightning' },
  { id: 'magnetic',  emoji: '\uD83E\uDDF2', label: 'Magnetic',   stateKey: 'isMagneticEnabled',  sidebarId: 'magneticToggle',  subMenuId: 'ctx-sub-magnetic' },
  { id: 'swarm',     emoji: '\u2728',        label: 'Swarm',      stateKey: 'isSwarmEnabled',     sidebarId: 'swarmToggle',     subMenuId: 'ctx-sub-swarm' },
  { id: 'blackhole', emoji: '\u26AB',        label: 'Black Hole', stateKey: 'isBlackHoleMode',    sidebarId: 'blackHoleModeToggle' },
  { id: 'aura',      emoji: '\uD83D\uDD2E', label: 'Aura',       stateKey: 'isAuraEnabled',      sidebarId: 'auraToggle',      subMenuId: 'ctx-sub-aura' },
];
```

**Fields:**
- `id` — unique key, used as `data-effect` attribute and CSS targeting
- `emoji` — visual icon displayed in the tile
- `label` — text label below the emoji
- `stateKey` — the boolean property on `state` (from `js/state.js`) that this tile toggles
- `sidebarId` — the hidden sidebar checkbox element ID. Tile clicks fire `change` events on this element to reuse all existing sidebar event listeners
- `subMenuId` (optional) — if present, a gear icon is rendered. Clicking the gear calls `_openSub(subMenuId)` to open the existing sub-menu card

**To add a future effect:** Add one object to this array. If it has settings, create a sub-menu card in HTML and set `subMenuId`.

## HTML Changes

### What gets replaced in `#ctx-effects`

The entire contents of `<div id="ctx-effects" class="ctx-panel">` are replaced. The old markup (checkbox rows, aura sliders, sub-menu trigger buttons) is removed.

New contents:
1. `<h3>Effects</h3>` — kept
2. `<div class="fx-grid" id="fxGrid"></div>` — empty container, populated by JS
3. `<div class="ctx-divider"></div>`
4. Spin Speed slider — kept as a global control below the grid:
   ```html
   <label>Spin Speed</label>
   <input type="range" id="ctx-spin" min="0" max="0.1" step="0.001">
   ```

The aura-specific sliders (Reach, Intensity) move into the existing `ctx-sub-aura` sub-menu card, accessible via the aura tile's gear icon. This declutters the main panel.

### What stays unchanged

- All existing sub-menu cards (`ctx-sub-swarm`, `ctx-sub-lightning`, `ctx-sub-magnetic`, `ctx-sub-aura`, `ctx-sub-path`) — untouched
- All sidebar elements and their event listeners — untouched
- All other tabs (Shape, Look, World) — untouched

### Aura sub-menu card update

Move the Aura Reach and Aura Intensity sliders from the main FX panel into `ctx-sub-aura`. The sub-menu already has Pulse Rate and Spike Multiplier, so these join them as a complete aura settings card.

## CSS Changes

All new styles go in `css/context-menu.css`. No changes to existing rules.

### New rules

```css
/* ── FX Tile Grid ── */
.fx-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.fx-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 10px 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(209, 135, 255, 0.15);
  background: rgba(30, 15, 50, 0.6);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.fx-tile:hover {
  border-color: rgba(209, 135, 255, 0.4);
  background: rgba(40, 20, 65, 0.8);
}

/* Active tile — magenta glow */
.fx-tile.active {
  border-color: rgba(188, 19, 254, 0.8);
  background: rgba(188, 19, 254, 0.15);
  box-shadow: 0 0 12px rgba(188, 19, 254, 0.3),
              inset 0 0 8px rgba(188, 19, 254, 0.1);
}
.fx-tile.active .fx-tile-emoji {
  filter: drop-shadow(0 0 6px rgba(188, 19, 254, 0.6));
}
.fx-tile.active .fx-tile-label {
  color: #fff;
}

/* Emoji and label */
.fx-tile-emoji {
  font-size: 20px;
  line-height: 1;
  transition: filter 0.2s;
}
.fx-tile-label {
  font-size: 0.6rem;
  color: rgba(209, 135, 255, 0.7);
  text-align: center;
  line-height: 1.1;
  transition: color 0.2s;
}

/* Gear icon overlay */
.fx-tile-gear {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: rgba(209, 135, 255, 0.4);
  border-radius: 3px;
  transition: all 0.15s;
  z-index: 2;
}
.fx-tile-gear:hover {
  color: #fff;
  background: rgba(188, 19, 254, 0.4);
}
.fx-tile.active .fx-tile-gear {
  color: rgba(209, 135, 255, 0.7);
}
```

## JS Changes

### 1. Tile generation (`js/ui.js`)

A new function `buildFxGrid()` generates the tile DOM from the `EFFECTS` array and appends it to `#fxGrid`. Called once at init time, after the DOM is ready.

```
function buildFxGrid():
  for each fx in EFFECTS:
    create div.fx-tile[data-effect=fx.id]
      append span.fx-tile-emoji (fx.emoji)
      append span.fx-tile-label (fx.label)
      if fx.subMenuId:
        append span.fx-tile-gear (gear unicode)

    on tile click (not gear):
      toggle sidebar checkbox (fx.sidebarId) and dispatch change event
      (this reuses ALL existing sidebar listeners — no new state wiring)

    on gear click:
      call _openSub(fx.subMenuId)
```

### 2. Sync: sidebar state to tile active class (`js/interaction.js`)

`_syncContextMenu()` already syncs checkbox state. We replace the FX checkbox sync block with tile-aware sync:

```
function _syncFxTiles():
  for each fx in EFFECTS:
    tile = querySelector([data-effect=fx.id])
    sidebarEl = getElementById(fx.sidebarId)
    if sidebarEl.checked: tile.classList.add('active')
    else: tile.classList.remove('active')
```

Called from `_syncContextMenu()` in place of the old `s('ctx-pulsar', 'pulsarToggle')` etc. lines.

### 3. ProxyInput cleanup (`js/ui.js`)

The old `proxyInput('ctx-pulsar', 'pulsarToggle')` etc. lines for the 9 effect toggle checkboxes are removed — tiles handle this directly by dispatching change events on the sidebar elements.

The sub-menu slider `proxyInput` calls (swarm count, lightning length, etc.) remain unchanged — those are still wired via proxy inputs inside the sub-menu cards.

### 4. EFFECTS array location

The `EFFECTS` array is defined at the top of `js/ui.js` (or in a small `js/fx-registry.js` if we want it importable elsewhere). For now, `js/ui.js` is simpler — one file, no new imports.

### 5. Cross-module concern: `_openSub` access

`_openSub()` is defined in `js/interaction.js` as a module-scoped function. Gear click handlers need to call it. Two options:
- **Option A (preferred):** Wire gear click handlers from `interaction.js` after `buildFxGrid()` runs — same pattern as the existing `.ctx-trigger[data-ctx-open]` listener setup. Query `.fx-tile-gear[data-gear]` elements and attach `_openSub` calls.
- **Option B:** Export `_openSub` from `interaction.js` and import it in `ui.js`.

Option A keeps `_openSub` private and follows the existing pattern where `interaction.js` owns all sub-menu navigation wiring.

## Data Flow

```
Tile click
  -> find sidebarEl by fx.sidebarId
  -> set sidebarEl.checked = !sidebarEl.checked
  -> dispatch 'change' event on sidebarEl
  -> existing sidebar listener fires: state[stateKey] = checked
  -> tile reads state back, toggles .active class

Gear click
  -> _openSub(fx.subMenuId)
  -> existing sub-menu card slides in (deck-of-cards)
  -> sub-menu controls still use proxyInput for their sliders

Context menu opens
  -> _syncContextMenu() calls _syncFxTiles()
  -> reads sidebar checkbox state -> sets .active on tiles
```

## What Moves Where

| Element | From | To |
|---------|------|----|
| Effect checkboxes (9) | `#ctx-effects` main panel | Replaced by tile grid |
| Aura Reach slider | `#ctx-effects` main panel | `#ctx-sub-aura` sub-menu card |
| Aura Intensity slider | `#ctx-effects` main panel | `#ctx-sub-aura` sub-menu card |
| Spin Speed slider | `#ctx-effects` main panel | Stays in main panel (below grid) |
| Sub-menu trigger buttons (5) | `#ctx-effects` main panel | Removed (replaced by gear icons on tiles) |

## Extensibility

Adding a new effect (e.g. a Shadertoy technique):

1. Add a state flag to `js/state.js`: `isNewEffectEnabled: false`
2. Add a sidebar toggle in the sidebar HTML (hidden or visible)
3. Add one entry to the `EFFECTS` array with the matching `stateKey` and `sidebarId`
4. If it has settings: add a sub-menu card in HTML, set `subMenuId` in the array entry
5. Write the effect module in `js/new-effect.js`

Steps 1, 2, and 5 are the same as today. Step 3 is the only new thing — one line.

## Constraints

- Card width: 260px, max-height: 420px
- 3-column grid with 6px gaps
- No live canvas thumbnails — emoji + label only
- All existing sub-menu cards and their internal wiring remain intact
- Glassmorphic dark purple theme: bg `rgba(20,10,30,0.95)`, accent `#bc13fe`, labels `#d187ff`
